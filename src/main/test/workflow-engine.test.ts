import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AbortReason,
  AgentChunk,
  AgentNodeData,
  AgentResult,
  IpcChannels,
  Workflow,
  WorkflowEdge,
  WorkflowReviewActionPayload,
  WorkflowNode,
} from '@shared';
import { IAgentAdapter } from '../adapters/base.adapter';
import { ArtifactGateService } from '../services/artifact-gate-service';
import { memoryManager } from '../services/memory-manager';
import { RunStateStore } from '../services/run-state-store';
import { WorkflowEngine, WorkflowEventSender } from '../services/workflow-engine';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
}

interface AdapterBehavior {
  output?: string;
  waitFor?: Promise<void>;
  onStart?: () => void;
  onExecute?: (ctx: { nodeId: string; prompt: string; workspacePath: string }) => Promise<void> | void;
  runnerSessionId?: string;
  abortable?: boolean;
}

class FakeSender implements WorkflowEventSender {
  public readonly events: Array<{ channel: string; payload: unknown }> = [];

  public send(channel: string, payload: unknown): void {
    this.events.push({ channel, payload });
  }
}

class FakeAdapter implements IAgentAdapter {
  public readonly executeCalls: Array<{ nodeId: string; prompt: string; workspacePath: string }> = [];
  public readonly abortCalls: Array<{ nodeId: string; reason: AbortReason }> = [];

  private readonly abortReasons = new Map<string, AbortReason>();
  private readonly abortResolvers = new Map<string, () => void>();

  public constructor(private readonly behaviors: Record<string, AdapterBehavior> = {}) {}

  public async *execute(
    nodeId: string,
    _nodeData: AgentNodeData,
    prompt: string,
    workspacePath: string
  ): AsyncGenerator<AgentChunk, AgentResult, void> {
    this.executeCalls.push({ nodeId, prompt, workspacePath });
    const behavior = this.behaviors[nodeId] ?? {};
    behavior.onStart?.();

    yield {
      type: 'stdout',
      content: `${nodeId}: started\n`,
      timestamp: Date.now(),
    };

    await behavior.onExecute?.({ nodeId, prompt, workspacePath });

    if (behavior.abortable) {
      if (!this.abortReasons.has(nodeId)) {
        await new Promise<void>((resolve) => {
          this.abortResolvers.set(nodeId, resolve);
        });
      }
    }

    if (behavior.waitFor) {
      await behavior.waitFor;
    }

    const abortReason = this.abortReasons.get(nodeId);
    if (abortReason) {
      return {
        success: false,
        error: 'Execution aborted.',
        exitCode: 1,
        abortReason,
      };
    }

    return {
      success: true,
      output: behavior.output ?? `Output for ${nodeId}`,
      exitCode: 0,
      runnerSessionId: behavior.runnerSessionId,
    };
  }

  public async abort(nodeId: string, reason: AbortReason): Promise<void> {
    this.abortCalls.push({ nodeId, reason });
    this.abortReasons.set(nodeId, reason);
    this.abortResolvers.get(nodeId)?.();
  }
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

function createNode(id: string, data: Partial<AgentNodeData> = {}): WorkflowNode {
  return {
    id,
    type: 'agentNode',
    label: id,
    position: { x: 0, y: 0 },
    data: {
      provider: 'openai',
      model: 'gpt-5.5',
      prompt: `Run ${id}`,
      ...data,
    },
  };
}

function createWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[] = []): Workflow {
  return {
    id: 'workflow-1',
    name: 'Workflow 1',
    nodes,
    edges,
  };
}

async function readSingleRunState(workspacePath: string): Promise<{
  runId: string;
  status: string;
  currentNodeIds: string[];
  awaitingReviewNodeIds: string[];
  nodes: Record<
    string,
    {
      status: string;
      outputArtifactPaths: string[];
      attempts?: number;
      reviewStatus?: string;
    }
  >;
}> {
  const runsDir = join(workspacePath, '.fluxion', 'runs');
  const files = await readdir(runsDir);
  const fileName = files[0]!;
  return JSON.parse(await readFile(join(runsDir, fileName), 'utf8')) as {
    runId: string;
    status: string;
    currentNodeIds: string[];
    awaitingReviewNodeIds: string[];
    nodes: Record<
      string,
      {
        status: string;
        outputArtifactPaths: string[];
        attempts?: number;
        reviewStatus?: string;
      }
    >;
  };
}

function reviewAction(runId: string, nodeId: string): WorkflowReviewActionPayload {
  return {
    workflowId: 'workflow-1',
    runId,
    nodeId,
  };
}

describe('WorkflowEngine', () => {
  let workspacePath: string;

  beforeEach(async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-engine-'));
  });

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true });
  });

  it('runs a simple DAG end-to-end and persists run state', async () => {
    const adapter = new FakeAdapter({
      'node-a': {
        output: 'Node A output',
        runnerSessionId: 'session-a',
      },
      'node-b': {
        output: 'Node B output',
        runnerSessionId: 'session-b',
      },
    });
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService(),
    });
    const sender = new FakeSender();
    const workflow = createWorkflow(
      [createNode('node-a'), createNode('node-b')],
      [{ id: 'edge-a-b', source: 'node-a', target: 'node-b' }]
    );

    await engine.start(workflow, workspacePath, sender);

    const runState = await readSingleRunState(workspacePath);
    expect(runState.status).toBe('completed');
    expect(runState.currentNodeIds).toEqual([]);
    expect(runState.nodes['node-a']?.status).toBe('completed');
    expect(runState.nodes['node-b']?.status).toBe('completed');
    expect(adapter.executeCalls.map((call) => call.nodeId)).toEqual(['node-a', 'node-b']);
    expect(adapter.executeCalls[1]?.prompt).toContain('Output from Node node-a (codex / gpt-5.5)');

    const completedEvent = sender.events.find(
      (event) => event.channel === IpcChannels.WORKFLOW_COMPLETED
    );
    expect(completedEvent).toMatchObject({
      payload: expect.objectContaining({
        workflowId: 'workflow-1',
        success: true,
      }),
    });
  });

  it('tracks currentNodeIds for parallel nodes while the batch is running', async () => {
    const startedA = createDeferred<void>();
    const startedB = createDeferred<void>();
    const releaseA = createDeferred<void>();
    const releaseB = createDeferred<void>();
    const adapter = new FakeAdapter({
      'node-a': {
        onStart: () => startedA.resolve(),
        waitFor: releaseA.promise,
      },
      'node-b': {
        onStart: () => startedB.resolve(),
        waitFor: releaseB.promise,
      },
    });
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService(),
    });
    const sender = new FakeSender();
    const workflow = createWorkflow([createNode('node-a'), createNode('node-b')]);

    const runPromise = engine.start(workflow, workspacePath, sender);
    await Promise.all([startedA.promise, startedB.promise]);

    const runStateWhileRunning = await readSingleRunState(workspacePath);
    expect(runStateWhileRunning.currentNodeIds).toEqual(['node-a', 'node-b']);

    releaseA.resolve();
    releaseB.resolve();
    await runPromise;

    const runStateAfter = await readSingleRunState(workspacePath);
    expect(runStateAfter.currentNodeIds).toEqual([]);
    expect(runStateAfter.status).toBe('completed');
  });

  it('fails before adapter execution when a required artifact is missing', async () => {
    const adapter = new FakeAdapter();
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService(),
    });
    const sender = new FakeSender();
    const workflow = createWorkflow([
      createNode('node-a', {
        requires: [{ path: 'docs/input.md' }],
      }),
    ]);

    await engine.start(workflow, workspacePath, sender);

    const runState = await readSingleRunState(workspacePath);
    expect(adapter.executeCalls).toHaveLength(0);
    expect(runState.status).toBe('failed');
    expect(runState.nodes['node-a']?.status).toBe('failed');
  });

  it('fails a node when declared produced artifacts are missing and does not run downstream nodes', async () => {
    const adapter = new FakeAdapter({
      'node-a': {
        output: 'A output',
      },
      'node-b': {
        output: 'B output',
      },
    });
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService(),
    });
    const sender = new FakeSender();
    const workflow = createWorkflow(
      [
        createNode('node-a', {
          produces: [{ path: 'docs/output.md' }],
        }),
        createNode('node-b'),
      ],
      [{ id: 'edge-a-b', source: 'node-a', target: 'node-b' }]
    );

    await engine.start(workflow, workspacePath, sender);

    const runState = await readSingleRunState(workspacePath);
    expect(adapter.executeCalls.map((call) => call.nodeId)).toEqual(['node-a']);
    expect(runState.status).toBe('failed');
    expect(runState.nodes['node-a']?.status).toBe('failed');
    expect(runState.nodes['node-b']?.status).toBe('pending');
  });

  it('marks active nodes as aborted when the workflow is aborted', async () => {
    const started = createDeferred<void>();
    const adapter = new FakeAdapter({
      'node-a': {
        abortable: true,
        onStart: () => started.resolve(),
      },
    });
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService(),
    });
    const sender = new FakeSender();
    const workflow = createWorkflow([createNode('node-a')]);

    const runPromise = engine.start(workflow, workspacePath, sender);
    await started.promise;
    await engine.abort();
    await runPromise;

    const runState = await readSingleRunState(workspacePath);
    expect(runState.status).toBe('aborted');
    expect(runState.nodes['node-a']?.status).toBe('aborted');
    expect(adapter.abortCalls).toEqual([
      { nodeId: 'node-a', reason: AbortReason.USER_REQUESTED },
    ]);
  });

  it('creates a fresh run scoped to downstream nodes when resuming from a node', async () => {
    const adapter = new FakeAdapter({
      'node-b': {
        output: 'Node B output',
      },
      'node-c': {
        output: 'Node C output',
      },
    });
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService(),
    });
    const sender = new FakeSender();
    const workflow = createWorkflow(
      [createNode('node-a'), createNode('node-b'), createNode('node-c')],
      [
        { id: 'edge-a-b', source: 'node-a', target: 'node-b' },
        { id: 'edge-b-c', source: 'node-b', target: 'node-c' },
      ]
    );

    await engine.start(workflow, workspacePath, sender, 'node-b');

    const runState = await readSingleRunState(workspacePath);
    expect(Object.keys(runState.nodes).sort()).toEqual(['node-b', 'node-c']);
    expect(adapter.executeCalls.map((call) => call.nodeId)).toEqual(['node-b', 'node-c']);
  });

  it('records produced artifact paths when the node creates its declared outputs', async () => {
    const adapter = new FakeAdapter({
      'node-a': {
        output: 'A output',
        onExecute: async ({ workspacePath }) => {
          await mkdir(join(workspacePath, 'docs'), { recursive: true });
          await writeFile(join(workspacePath, 'docs', 'output.md'), 'artifact', 'utf8');
        },
      },
    });
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService(),
    });
    const sender = new FakeSender();
    const workflow = createWorkflow([
      createNode('node-a', {
        produces: [{ path: 'docs/output.md' }],
      }),
    ]);

    await engine.start(workflow, workspacePath, sender);

    const runState = await readSingleRunState(workspacePath);
    expect(runState.nodes['node-a']?.status).toBe('completed');
    expect(runState.nodes['node-a']?.outputArtifactPaths).toEqual(['docs/output.md']);
  });

  it('pauses at a human review checkpoint and resumes downstream after approval', async () => {
    const adapter = new FakeAdapter({
      'node-a': {
        output: 'Review this output',
      },
      'node-b': {
        output: 'Downstream output',
      },
    });
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService(),
    });
    const sender = new FakeSender();
    const workflow = createWorkflow(
      [
        createNode('node-a', { humanReview: true }),
        createNode('node-b'),
      ],
      [{ id: 'edge-a-b', source: 'node-a', target: 'node-b' }]
    );

    await engine.start(workflow, workspacePath, sender);

    let runState = await readSingleRunState(workspacePath);
    expect(runState.status).toBe('awaiting_review');
    expect(runState.awaitingReviewNodeIds).toEqual(['node-a']);
    expect(runState.nodes['node-a']?.status).toBe('awaiting_review');
    expect(runState.nodes['node-a']?.reviewStatus).toBe('pending');
    expect(adapter.executeCalls.map((call) => call.nodeId)).toEqual(['node-a']);
    expect(
      sender.events.some((event) => event.channel === IpcChannels.WORKFLOW_REVIEW_REQUIRED)
    ).toBe(true);
    expect(
      sender.events.some((event) => event.channel === IpcChannels.WORKFLOW_COMPLETED)
    ).toBe(false);

    await engine.approveReview(reviewAction(runState.runId, 'node-a'));

    runState = await readSingleRunState(workspacePath);
    expect(runState.status).toBe('completed');
    expect(runState.awaitingReviewNodeIds).toEqual([]);
    expect(runState.nodes['node-a']?.reviewStatus).toBe('approved');
    expect(runState.nodes['node-b']?.status).toBe('completed');
    expect(adapter.executeCalls.map((call) => call.nodeId)).toEqual(['node-a', 'node-b']);
  });

  it('rejects a review checkpoint and finalizes the workflow as rejected', async () => {
    const adapter = new FakeAdapter({
      'node-a': {
        output: 'Needs manual review',
      },
    });
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService(),
    });
    const sender = new FakeSender();
    const workflow = createWorkflow([createNode('node-a', { humanReview: true })]);

    await engine.start(workflow, workspacePath, sender);
    const runState = await readSingleRunState(workspacePath);

    await engine.rejectReview({
      ...reviewAction(runState.runId, 'node-a'),
      comment: 'output is not acceptable',
    });

    const finalState = await readSingleRunState(workspacePath);
    expect(finalState.status).toBe('rejected');
    expect(finalState.nodes['node-a']?.status).toBe('rejected');
    expect(finalState.nodes['node-a']?.reviewStatus).toBe('rejected');

    const completedEvent = [...sender.events]
      .reverse()
      .find((event) => event.channel === IpcChannels.WORKFLOW_COMPLETED);
    expect(completedEvent).toMatchObject({
      payload: expect.objectContaining({
        success: false,
        error: expect.stringContaining('Review rejected'),
      }),
    });
  });

  it('reruns a paused review node and overwrites its saved output before re-pausing', async () => {
    let executionCount = 0;
    const adapter = new FakeAdapter({
      'node-a': {
        onExecute: async () => {
          executionCount += 1;
        },
        get output() {
          return executionCount === 1 ? 'First review output' : 'Second review output';
        },
      } as AdapterBehavior,
    });
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService(),
    });
    const sender = new FakeSender();
    const workflow = createWorkflow([createNode('node-a', { humanReview: true })]);

    await engine.start(workflow, workspacePath, sender);
    let runState = await readSingleRunState(workspacePath);
    const outputPath = join(
      workspacePath,
      '.fluxion',
      'memory',
      'short-term',
      'workflow-1',
      'node-a.md'
    );
    expect(await readFile(outputPath, 'utf8')).toContain('First review output');

    await engine.rerunReviewNode(reviewAction(runState.runId, 'node-a'));

    runState = await readSingleRunState(workspacePath);
    expect(runState.status).toBe('awaiting_review');
    expect(runState.nodes['node-a']?.status).toBe('awaiting_review');
    expect(runState.nodes['node-a']?.attempts).toBe(2);
    expect(adapter.executeCalls.map((call) => call.nodeId)).toEqual(['node-a', 'node-a']);
    expect(await readFile(outputPath, 'utf8')).toContain('Second review output');
  });
});
