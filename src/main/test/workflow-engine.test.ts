import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkflowTraceEvent, WorkflowTraceEventSchema } from '@core'
import {
  AbortReason,
  AgentChunk,
  AgentProcessStartedChunk,
  AgentNodeData,
  AgentResult,
  IpcChannels,
  Workflow,
  WorkflowEdge,
  WorkflowReviewActionPayload,
  WorkflowNode
} from '@shared'
import { IAgentAdapter } from '../adapters/base.adapter'
import { ArtifactGateService } from '../services/artifact-gate-service'
import { memoryManager } from '../services/memory-manager'
import { RunStateStore } from '../services/run-state-store'
import { WorkflowEngine, WorkflowEventSender } from '../services/workflow-engine'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
}

interface AdapterBehavior {
  output?: string
  waitFor?: Promise<void>
  onStart?: () => void
  onExecute?: (ctx: {
    nodeId: string
    prompt: string
    workspacePath: string
  }) => Promise<void> | void
  runnerSessionId?: string
  abortable?: boolean
  processStarted?: Omit<AgentProcessStartedChunk, 'type' | 'timestamp'>
  processTelemetry?: AgentResult['processTelemetry']
}

class FakeSender implements WorkflowEventSender {
  public readonly events: Array<{ channel: string; payload: unknown }> = []

  public send(channel: string, payload: unknown): void {
    this.events.push({ channel, payload })
  }
}

class FakeAdapter implements IAgentAdapter {
  public readonly executeCalls: Array<{ nodeId: string; prompt: string; workspacePath: string }> =
    []
  public readonly abortCalls: Array<{ nodeId: string; reason: AbortReason }> = []

  private readonly abortReasons = new Map<string, AbortReason>()
  private readonly abortResolvers = new Map<string, () => void>()

  public constructor(private readonly behaviors: Record<string, AdapterBehavior> = {}) {}

  public async *execute(
    nodeId: string,
    _nodeData: AgentNodeData,
    prompt: string,
    workspacePath: string
  ): AsyncGenerator<AgentChunk, AgentResult, void> {
    this.executeCalls.push({ nodeId, prompt, workspacePath })
    const behavior = this.behaviors[nodeId] ?? {}
    behavior.onStart?.()

    if (behavior.processStarted) {
      yield {
        type: 'process-started',
        ...behavior.processStarted,
        timestamp: Date.now()
      }
    }

    yield {
      type: 'stdout',
      content: `${nodeId}: started\n`,
      timestamp: Date.now()
    }

    await behavior.onExecute?.({ nodeId, prompt, workspacePath })

    if (behavior.abortable) {
      if (!this.abortReasons.has(nodeId)) {
        await new Promise<void>((resolve) => {
          this.abortResolvers.set(nodeId, resolve)
        })
      }
    }

    if (behavior.waitFor) {
      await behavior.waitFor
    }

    const abortReason = this.abortReasons.get(nodeId)
    if (abortReason) {
      return {
        success: false,
        error: 'Execution aborted.',
        exitCode: 1,
        abortReason,
        processTelemetry: behavior.processTelemetry
          ? {
              ...behavior.processTelemetry,
              aborted: true,
              abortReason
            }
          : undefined
      }
    }

    return {
      success: true,
      output: behavior.output ?? `Output for ${nodeId}`,
      exitCode: 0,
      runnerSessionId: behavior.runnerSessionId,
      processTelemetry: behavior.processTelemetry
    }
  }

  public async abort(nodeId: string, reason: AbortReason): Promise<void> {
    this.abortCalls.push({ nodeId, reason })
    this.abortReasons.set(nodeId, reason)
    this.abortResolvers.get(nodeId)?.()
  }
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })
  return { promise, resolve }
}

function createNode(id: string, data: Partial<AgentNodeData> = {}): WorkflowNode {
  return {
    id,
    type: 'agentNode',
    label: id,
    position: { x: 0, y: 0 },
    data: {
      provider: 'codex',
      model: 'gpt-5.5',
      prompt: `Run ${id}`,
      ...data
    }
  }
}

function createWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[] = [],
  executionMode: Workflow['executionMode'] = 'auto'
): Workflow {
  return {
    id: 'workflow-1',
    name: 'Workflow 1',
    executionMode,
    nodes,
    edges
  }
}

async function readSingleRunState(workspacePath: string): Promise<{
  runId: string
  flowContextId?: string
  status: string
  executionMode: 'auto' | 'manual'
  currentNodeIds: string[]
  awaitingReviewNodeIds: string[]
  nodes: Record<
    string,
    {
      status: string
      outputArtifactPaths: string[]
      attempts?: number
      humanReview?: boolean
      reviewStatus?: string
      reviewSource?: string
    }
  >
}> {
  const runsDir = join(workspacePath, '.fluxion', 'runs')
  const files = await readdir(runsDir)
  const fileName = files.find((file) => file.endsWith('.json'))!
  return JSON.parse(await readFile(join(runsDir, fileName), 'utf8')) as {
    runId: string
    flowContextId?: string
    status: string
    executionMode: 'auto' | 'manual'
    currentNodeIds: string[]
    awaitingReviewNodeIds: string[]
    nodes: Record<
      string,
      {
        status: string
        outputArtifactPaths: string[]
        attempts?: number
        humanReview?: boolean
        reviewStatus?: string
        reviewSource?: string
      }
    >
  }
}

async function readTrace(workspacePath: string, runId: string): Promise<WorkflowTraceEvent[]> {
  const tracePath = join(workspacePath, '.fluxion', 'runs', `${runId}.trace.jsonl`)
  const content = await readFile(tracePath, 'utf8')
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => WorkflowTraceEventSchema.parse(JSON.parse(line) as unknown))
}

function traceKeys(trace: WorkflowTraceEvent[]): string[] {
  return trace.map((event) => `${event.nodeId ?? 'workflow'}:${event.type}`)
}

function expectTraceOrder(trace: WorkflowTraceEvent[], expectedKeys: string[]): void {
  const keys = traceKeys(trace)
  let previousIndex = -1

  for (const key of expectedKeys) {
    const index = keys.indexOf(key)
    expect(index).toBeGreaterThan(previousIndex)
    previousIndex = index
  }
}

function expectNoTraceType(
  trace: WorkflowTraceEvent[],
  type: WorkflowTraceEvent['type'],
  nodeId?: string
): void {
  expect(
    trace.some((event) => event.type === type && (nodeId === undefined || event.nodeId === nodeId))
  ).toBe(false)
}

function reviewAction(runId: string, nodeId: string): WorkflowReviewActionPayload {
  return {
    workflowId: 'workflow-1',
    runId,
    nodeId
  }
}

describe('WorkflowEngine', () => {
  let workspacePath: string

  beforeEach(async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-engine-'))
  })

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true })
  })

  it('runs a simple DAG end-to-end and persists run state', async () => {
    const adapter = new FakeAdapter({
      'node-a': {
        output: 'Node A output',
        runnerSessionId: 'session-a',
        processStarted: {
          pid: 1234,
          displayCommand: 'node codex.js',
          startedAt: '2026-05-10T00:00:00.000Z'
        },
        processTelemetry: {
          pid: 1234,
          displayCommand: 'node codex.js',
          startedAt: '2026-05-10T00:00:00.000Z',
          completedAt: '2026-05-10T00:00:01.000Z',
          durationMs: 1000,
          exitCode: 0,
          aborted: false,
          stdoutBytes: 12,
          stderrBytes: 0
        }
      },
      'node-b': {
        output: 'Node B output',
        runnerSessionId: 'session-b'
      }
    })
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    const sender = new FakeSender()
    const workflow = createWorkflow(
      [createNode('node-a'), createNode('node-b')],
      [{ id: 'edge-a-b', source: 'node-a', target: 'node-b' }]
    )

    await engine.start(workflow, workspacePath, sender)

    const runState = await readSingleRunState(workspacePath)
    expect(runState.status).toBe('completed')
    expect(runState.flowContextId).toBe(runState.runId)
    expect(runState.currentNodeIds).toEqual([])
    expect(runState.nodes['node-a']?.status).toBe('completed')
    expect(runState.nodes['node-b']?.status).toBe('completed')
    expect(runState.nodes['node-a']).not.toHaveProperty('processTelemetry')
    expect(adapter.executeCalls.map((call) => call.nodeId)).toEqual(['node-a', 'node-b'])
    expect(adapter.executeCalls[1]?.prompt).toContain('Output from Node node-a (codex / gpt-5.5)')

    const completedEvent = sender.events.find(
      (event) => event.channel === IpcChannels.WORKFLOW_COMPLETED
    )
    expect(completedEvent).toMatchObject({
      payload: expect.objectContaining({
        workflowId: 'workflow-1',
        success: true
      })
    })

    const trace = await readTrace(workspacePath, runState.runId)
    expect(trace.every((event) => event.flowContextId === runState.flowContextId)).toBe(true)
    const eventKeys = traceKeys(trace)
    expect(eventKeys[0]).toBe('workflow:workflow.started')
    expect(eventKeys.at(-1)).toBe('workflow:workflow.completed')
    expectTraceOrder(trace, [
      'workflow:workflow.started',
      'node-a:node.ready',
      'node-a:node.running',
      'node-a:node.process_spawned',
      'node-a:node.process_exited',
      'node-a:node.output_saved',
      'node-b:node.ready',
      'node-b:node.running',
      'node-b:node.output_saved',
      'workflow:workflow.completed'
    ])
    expect(trace.find((event) => event.type === 'node.process_spawned')).toMatchObject({
      nodeId: 'node-a',
      data: {
        pid: 1234,
        displayCommand: 'node codex.js'
      }
    })
    expect(
      trace.some(
        (event) =>
          event.nodeId === 'node-a' &&
          event.type === 'node.process_exited' &&
          event.data?.stdoutBytes === 12
      )
    ).toBe(true)
    expect(
      trace.find((event) => event.nodeId === 'node-b' && event.type === 'node.context_compiled')
    ).toMatchObject({
      data: {
        contextBytes: expect.any(Number),
        contextChars: expect.any(Number),
        contextHash: expect.any(String),
        sources: expect.arrayContaining([
          expect.objectContaining({
            type: 'short-term',
            path: '.fluxion/memory/short-term/workflow-1/node-a.md',
            included: true,
            nodeId: 'node-a',
            runId: runState.runId,
            bytes: expect.any(Number),
            hash: expect.any(String)
          })
        ])
      }
    })
    expect(
      trace.find((event) => event.nodeId === 'node-a' && event.type === 'node.output_saved')
    ).toMatchObject({
      data: {
        outputFilePath: '.fluxion/memory/short-term/workflow-1/node-a.md',
        historyOutputFilePath: `.fluxion/memory/short-term/workflow-1/.history/${runState.runId}/node-a/attempt-1.md`,
        attempt: 1
      }
    })
    const memoryContextReady = sender.events.find(
      (event) =>
        event.channel === IpcChannels.MEMORY_CONTEXT_READY &&
        (event.payload as { nodeId?: string }).nodeId === 'node-b'
    )
    expect(memoryContextReady?.payload).toEqual({
      nodeId: 'node-b',
      compiledContext: expect.any(String)
    })
  })

  it('tracks currentNodeIds for parallel nodes while the batch is running', async () => {
    const startedA = createDeferred<void>()
    const startedB = createDeferred<void>()
    const releaseA = createDeferred<void>()
    const releaseB = createDeferred<void>()
    const adapter = new FakeAdapter({
      'node-a': {
        onStart: () => startedA.resolve(),
        waitFor: releaseA.promise
      },
      'node-b': {
        onStart: () => startedB.resolve(),
        waitFor: releaseB.promise
      }
    })
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    const sender = new FakeSender()
    const workflow = createWorkflow([createNode('node-a'), createNode('node-b')])

    const runPromise = engine.start(workflow, workspacePath, sender)
    await Promise.all([startedA.promise, startedB.promise])

    const runStateWhileRunning = await readSingleRunState(workspacePath)
    expect(runStateWhileRunning.currentNodeIds).toEqual(['node-a', 'node-b'])

    const traceWhileRunning = await readTrace(workspacePath, runStateWhileRunning.runId)
    const runningNodeIds = traceWhileRunning
      .filter((event) => event.type === 'node.running')
      .map((event) => event.nodeId)
      .sort()
    expect(runningNodeIds).toEqual(['node-a', 'node-b'])
    expectNoTraceType(traceWhileRunning, 'workflow.completed')

    releaseA.resolve()
    releaseB.resolve()
    await runPromise

    const runStateAfter = await readSingleRunState(workspacePath)
    expect(runStateAfter.currentNodeIds).toEqual([])
    expect(runStateAfter.status).toBe('completed')
  })

  it('fails before adapter execution when a required artifact is missing', async () => {
    const adapter = new FakeAdapter()
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    const sender = new FakeSender()
    const workflow = createWorkflow([
      createNode('node-a', {
        requires: [{ path: 'docs/input.md' }]
      })
    ])

    await engine.start(workflow, workspacePath, sender)

    const runState = await readSingleRunState(workspacePath)
    expect(adapter.executeCalls).toHaveLength(0)
    expect(runState.status).toBe('failed')
    expect(runState.nodes['node-a']?.status).toBe('failed')

    const trace = await readTrace(workspacePath, runState.runId)
    expectTraceOrder(trace, [
      'workflow:workflow.started',
      'node-a:node.ready',
      'node-a:node.failed',
      'workflow:workflow.failed'
    ])
    expectNoTraceType(trace, 'node.running', 'node-a')
    expectNoTraceType(trace, 'workflow.completed')
    expect(trace.at(-1)).toMatchObject({ type: 'workflow.failed' })
  })

  it('fails a node when declared produced artifacts are missing and does not run downstream nodes', async () => {
    const adapter = new FakeAdapter({
      'node-a': {
        output: 'A output'
      },
      'node-b': {
        output: 'B output'
      }
    })
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    const sender = new FakeSender()
    const workflow = createWorkflow(
      [
        createNode('node-a', {
          produces: [{ path: 'docs/output.md' }]
        }),
        createNode('node-b')
      ],
      [{ id: 'edge-a-b', source: 'node-a', target: 'node-b' }]
    )

    await engine.start(workflow, workspacePath, sender)

    const runState = await readSingleRunState(workspacePath)
    expect(adapter.executeCalls.map((call) => call.nodeId)).toEqual(['node-a'])
    expect(runState.status).toBe('failed')
    expect(runState.nodes['node-a']?.status).toBe('failed')
    expect(runState.nodes['node-b']?.status).toBe('pending')

    const trace = await readTrace(workspacePath, runState.runId)
    expectTraceOrder(trace, [
      'workflow:workflow.started',
      'node-a:node.ready',
      'node-a:node.running',
      'node-a:node.execution_started',
      'node-a:node.execution_completed',
      'node-a:node.failed',
      'workflow:workflow.failed'
    ])
    expectNoTraceType(trace, 'node.produces_validated', 'node-a')
    expectNoTraceType(trace, 'node.output_saved', 'node-a')
    expectNoTraceType(trace, 'node.ready', 'node-b')
    expectNoTraceType(trace, 'node.running', 'node-b')
    expectNoTraceType(trace, 'workflow.completed')
  })

  it('marks active nodes as aborted when the workflow is aborted', async () => {
    const started = createDeferred<void>()
    const adapter = new FakeAdapter({
      'node-a': {
        abortable: true,
        onStart: () => started.resolve(),
        processStarted: {
          pid: 5678,
          displayCommand: 'node codex.js',
          startedAt: '2026-05-10T00:00:00.000Z'
        },
        processTelemetry: {
          pid: 5678,
          displayCommand: 'node codex.js',
          startedAt: '2026-05-10T00:00:00.000Z',
          completedAt: '2026-05-10T00:00:03.000Z',
          durationMs: 3000,
          exitCode: 1,
          aborted: true,
          abortReason: AbortReason.USER_REQUESTED,
          stdoutBytes: 0,
          stderrBytes: 0
        }
      }
    })
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    const sender = new FakeSender()
    const workflow = createWorkflow([createNode('node-a')])

    const runPromise = engine.start(workflow, workspacePath, sender)
    await started.promise
    await engine.abort()
    await runPromise

    const runState = await readSingleRunState(workspacePath)
    expect(runState.status).toBe('aborted')
    expect(runState.nodes['node-a']?.status).toBe('aborted')
    expect(adapter.abortCalls).toEqual([{ nodeId: 'node-a', reason: AbortReason.USER_REQUESTED }])

    const trace = await readTrace(workspacePath, runState.runId)
    expectTraceOrder(trace, [
      'node-a:node.process_spawned',
      'node-a:node.process_exited',
      'node-a:node.aborted',
      'workflow:workflow.aborted'
    ])
    expect(trace.find((event) => event.type === 'node.process_spawned')).toMatchObject({
      nodeId: 'node-a',
      data: {
        pid: 5678,
        displayCommand: 'node codex.js'
      }
    })
    expect(trace.find((event) => event.type === 'node.process_exited')).toMatchObject({
      nodeId: 'node-a',
      data: {
        durationMs: 3000,
        exitCode: 1,
        stdoutBytes: 0,
        stderrBytes: 0,
        aborted: true,
        abortReason: AbortReason.USER_REQUESTED
      }
    })
    expect(trace.at(-1)).toMatchObject({ type: 'workflow.aborted' })
  })

  it('creates a fresh run scoped to downstream nodes when resuming from a node', async () => {
    const adapter = new FakeAdapter({
      'node-b': {
        output: 'Node B output'
      },
      'node-c': {
        output: 'Node C output'
      }
    })
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    const sender = new FakeSender()
    const workflow = createWorkflow(
      [createNode('node-a'), createNode('node-b'), createNode('node-c')],
      [
        { id: 'edge-a-b', source: 'node-a', target: 'node-b' },
        { id: 'edge-b-c', source: 'node-b', target: 'node-c' }
      ]
    )

    await engine.start(workflow, workspacePath, sender, 'node-b')

    const runState = await readSingleRunState(workspacePath)
    expect(Object.keys(runState.nodes).sort()).toEqual(['node-b', 'node-c'])
    expect(adapter.executeCalls.map((call) => call.nodeId)).toEqual(['node-b', 'node-c'])
  })

  it('records produced artifact paths when the node creates its declared outputs', async () => {
    const adapter = new FakeAdapter({
      'node-a': {
        output: 'A output',
        onExecute: async ({ workspacePath }) => {
          await mkdir(join(workspacePath, 'docs'), { recursive: true })
          await writeFile(join(workspacePath, 'docs', 'output.md'), 'artifact', 'utf8')
        }
      }
    })
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    const sender = new FakeSender()
    const workflow = createWorkflow([
      createNode('node-a', {
        produces: [{ path: 'docs/output.md' }]
      })
    ])

    await engine.start(workflow, workspacePath, sender)

    const runState = await readSingleRunState(workspacePath)
    expect(runState.nodes['node-a']?.status).toBe('completed')
    expect(runState.nodes['node-a']?.outputArtifactPaths).toEqual(['docs/output.md'])
  })

  it('pauses at a human review checkpoint and resumes downstream after approval', async () => {
    const adapter = new FakeAdapter({
      'node-a': {
        output: 'Review this output'
      },
      'node-b': {
        output: 'Downstream output'
      }
    })
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    const sender = new FakeSender()
    const workflow = createWorkflow(
      [createNode('node-a', { humanReview: true }), createNode('node-b')],
      [{ id: 'edge-a-b', source: 'node-a', target: 'node-b' }]
    )

    await engine.start(workflow, workspacePath, sender)

    let runState = await readSingleRunState(workspacePath)
    expect(runState.status).toBe('awaiting_review')
    expect(runState.executionMode).toBe('auto')
    expect(runState.awaitingReviewNodeIds).toEqual(['node-a'])
    expect(runState.nodes['node-a']?.status).toBe('awaiting_review')
    expect(runState.nodes['node-a']?.reviewStatus).toBe('pending')
    expect(runState.nodes['node-a']?.reviewSource).toBe('node')
    expect(adapter.executeCalls.map((call) => call.nodeId)).toEqual(['node-a'])
    expect(
      sender.events.some((event) => event.channel === IpcChannels.WORKFLOW_REVIEW_REQUIRED)
    ).toBe(true)
    expect(sender.events.some((event) => event.channel === IpcChannels.WORKFLOW_COMPLETED)).toBe(
      false
    )

    let trace = await readTrace(workspacePath, runState.runId)
    expectTraceOrder(trace, [
      'workflow:workflow.started',
      'node-a:node.ready',
      'node-a:node.running',
      'node-a:node.output_saved',
      'node-a:node.review_requested'
    ])
    expect(trace.find((event) => event.type === 'node.review_requested')).toMatchObject({
      nodeId: 'node-a',
      data: {
        reviewSource: 'node'
      }
    })
    expectNoTraceType(trace, 'node.ready', 'node-b')
    expectNoTraceType(trace, 'workflow.completed')

    await engine.approveReview(reviewAction(runState.runId, 'node-a'))

    runState = await readSingleRunState(workspacePath)
    expect(runState.status).toBe('completed')
    expect(runState.awaitingReviewNodeIds).toEqual([])
    expect(runState.nodes['node-a']?.reviewStatus).toBe('approved')
    expect(runState.nodes['node-b']?.status).toBe('completed')
    expect(adapter.executeCalls.map((call) => call.nodeId)).toEqual(['node-a', 'node-b'])

    trace = await readTrace(workspacePath, runState.runId)
    expectTraceOrder(trace, [
      'node-a:node.review_requested',
      'node-a:node.review_approved',
      'node-b:node.ready',
      'node-b:node.running',
      'workflow:workflow.completed'
    ])
    expect(trace.at(-1)).toMatchObject({ type: 'workflow.completed' })
  })

  it('rejects a review checkpoint and finalizes the workflow as rejected', async () => {
    const adapter = new FakeAdapter({
      'node-a': {
        output: 'Needs manual review'
      }
    })
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    const sender = new FakeSender()
    const workflow = createWorkflow([createNode('node-a', { humanReview: true })])

    await engine.start(workflow, workspacePath, sender)
    const runState = await readSingleRunState(workspacePath)

    await engine.rejectReview({
      ...reviewAction(runState.runId, 'node-a'),
      comment: 'output is not acceptable'
    })

    const finalState = await readSingleRunState(workspacePath)
    expect(finalState.status).toBe('rejected')
    expect(finalState.nodes['node-a']?.status).toBe('rejected')
    expect(finalState.nodes['node-a']?.reviewStatus).toBe('rejected')

    const completedEvent = [...sender.events]
      .reverse()
      .find((event) => event.channel === IpcChannels.WORKFLOW_COMPLETED)
    expect(completedEvent).toMatchObject({
      payload: expect.objectContaining({
        success: false,
        error: expect.stringContaining('Review rejected')
      })
    })
  })

  it('hydrates a paused review runtime after restart and resumes downstream after approval', async () => {
    const initialStore = new RunStateStore()
    const adapterBeforeRestart = new FakeAdapter({
      'node-a': {
        output: 'Review this output'
      },
      'node-b': {
        output: 'Downstream output before restart'
      }
    })
    const engineBeforeRestart = WorkflowEngine.createForTesting({
      adapter: adapterBeforeRestart,
      memoryManager,
      runStateStore: initialStore,
      artifactGateService: new ArtifactGateService()
    })
    const workflow = createWorkflow(
      [createNode('node-a', { humanReview: true }), createNode('node-b')],
      [{ id: 'edge-a-b', source: 'node-a', target: 'node-b' }]
    )

    await engineBeforeRestart.start(workflow, workspacePath, new FakeSender())
    const pausedState = await initialStore.readRun(
      workspacePath,
      (await readSingleRunState(workspacePath)).runId
    )
    expect(pausedState.status).toBe('awaiting_review')

    const adapterAfterRestart = new FakeAdapter({
      'node-b': {
        output: 'Downstream output after restart'
      }
    })
    const engineAfterRestart = WorkflowEngine.createForTesting({
      adapter: adapterAfterRestart,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    const recoveredSender = new FakeSender()
    engineAfterRestart.hydratePausedReviewRuntime(
      workflow,
      workspacePath,
      recoveredSender,
      pausedState
    )

    await engineAfterRestart.approveReview(reviewAction(pausedState.runId, 'node-a'))

    const finalState = await readSingleRunState(workspacePath)
    expect(finalState.status).toBe('completed')
    expect(finalState.nodes['node-a']?.reviewStatus).toBe('approved')
    expect(finalState.nodes['node-b']?.status).toBe('completed')
    expect(adapterAfterRestart.executeCalls.map((call) => call.nodeId)).toEqual(['node-b'])

    const trace = await readTrace(workspacePath, pausedState.runId)
    expectTraceOrder(trace, [
      'node-a:node.review_requested',
      'node-a:node.review_approved',
      'node-b:node.ready',
      'node-b:node.running',
      'workflow:workflow.completed'
    ])
    expect(trace.find((event) => event.type === 'node.review_approved')).toMatchObject({
      data: {
        recoveredAfterRestart: true
      }
    })
  })

  it('hydrates a parallel review parent and unlocks a shared downstream node correctly', async () => {
    const initialStore = new RunStateStore()
    const adapterBeforeRestart = new FakeAdapter({
      'node-a': {
        output: 'Completed parent'
      },
      'node-b': {
        output: 'Review parent'
      },
      'node-c': {
        output: 'Shared downstream before restart'
      }
    })
    const engineBeforeRestart = WorkflowEngine.createForTesting({
      adapter: adapterBeforeRestart,
      memoryManager,
      runStateStore: initialStore,
      artifactGateService: new ArtifactGateService()
    })
    const workflow = createWorkflow(
      [createNode('node-a'), createNode('node-b', { humanReview: true }), createNode('node-c')],
      [
        { id: 'edge-a-c', source: 'node-a', target: 'node-c' },
        { id: 'edge-b-c', source: 'node-b', target: 'node-c' }
      ]
    )

    await engineBeforeRestart.start(workflow, workspacePath, new FakeSender())
    const pausedState = await initialStore.readRun(
      workspacePath,
      (await readSingleRunState(workspacePath)).runId
    )
    expect(pausedState.nodes['node-a']?.status).toBe('completed')
    expect(pausedState.nodes['node-b']?.status).toBe('awaiting_review')
    expect(pausedState.nodes['node-c']?.status).toBe('pending')

    const adapterAfterRestart = new FakeAdapter({
      'node-c': {
        output: 'Shared downstream after restart'
      }
    })
    const engineAfterRestart = WorkflowEngine.createForTesting({
      adapter: adapterAfterRestart,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    engineAfterRestart.hydratePausedReviewRuntime(
      workflow,
      workspacePath,
      new FakeSender(),
      pausedState
    )

    await engineAfterRestart.approveReview(reviewAction(pausedState.runId, 'node-b'))

    const finalState = await readSingleRunState(workspacePath)
    expect(finalState.status).toBe('completed')
    expect(finalState.nodes['node-c']?.status).toBe('completed')
    expect(adapterAfterRestart.executeCalls.map((call) => call.nodeId)).toEqual(['node-c'])
  })

  it('rejects a recovered review checkpoint and finalizes the workflow as rejected', async () => {
    const initialStore = new RunStateStore()
    const engineBeforeRestart = WorkflowEngine.createForTesting({
      adapter: new FakeAdapter({
        'node-a': {
          output: 'Needs review'
        }
      }),
      memoryManager,
      runStateStore: initialStore,
      artifactGateService: new ArtifactGateService()
    })
    const workflow = createWorkflow([createNode('node-a', { humanReview: true })])

    await engineBeforeRestart.start(workflow, workspacePath, new FakeSender())
    const pausedState = await initialStore.readRun(
      workspacePath,
      (await readSingleRunState(workspacePath)).runId
    )
    const engineAfterRestart = WorkflowEngine.createForTesting({
      adapter: new FakeAdapter(),
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    const recoveredSender = new FakeSender()
    engineAfterRestart.hydratePausedReviewRuntime(
      workflow,
      workspacePath,
      recoveredSender,
      pausedState
    )

    await engineAfterRestart.rejectReview({
      ...reviewAction(pausedState.runId, 'node-a'),
      comment: 'Not acceptable'
    })

    const finalState = await readSingleRunState(workspacePath)
    expect(finalState.status).toBe('rejected')
    expect(finalState.nodes['node-a']?.reviewStatus).toBe('rejected')
    const trace = await readTrace(workspacePath, pausedState.runId)
    expect(trace.find((event) => event.type === 'node.review_rejected')).toMatchObject({
      data: {
        recoveredAfterRestart: true
      }
    })
    expect(
      recoveredSender.events.some((event) => event.channel === IpcChannels.WORKFLOW_COMPLETED)
    ).toBe(true)
  })

  it('reruns a recovered review node and pauses again with a new attempt', async () => {
    const initialStore = new RunStateStore()
    const engineBeforeRestart = WorkflowEngine.createForTesting({
      adapter: new FakeAdapter({
        'node-a': {
          output: 'First review output'
        }
      }),
      memoryManager,
      runStateStore: initialStore,
      artifactGateService: new ArtifactGateService()
    })
    const workflow = createWorkflow([createNode('node-a', { humanReview: true })])

    await engineBeforeRestart.start(workflow, workspacePath, new FakeSender())
    const pausedState = await initialStore.readRun(
      workspacePath,
      (await readSingleRunState(workspacePath)).runId
    )

    const engineAfterRestart = WorkflowEngine.createForTesting({
      adapter: new FakeAdapter({
        'node-a': {
          output: 'Second review output'
        }
      }),
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    engineAfterRestart.hydratePausedReviewRuntime(
      workflow,
      workspacePath,
      new FakeSender(),
      pausedState
    )

    await engineAfterRestart.rerunReviewNode(reviewAction(pausedState.runId, 'node-a'))

    const rerunState = await readSingleRunState(workspacePath)
    expect(rerunState.status).toBe('awaiting_review')
    expect(rerunState.nodes['node-a']?.attempts).toBe(2)
    expect(rerunState.nodes['node-a']?.reviewStatus).toBe('pending')
    expect(
      await readFile(
        join(workspacePath, '.fluxion', 'memory', 'short-term', 'workflow-1', 'node-a.md'),
        'utf8'
      )
    ).toContain('Second review output')

    const trace = await readTrace(workspacePath, pausedState.runId)
    expect(trace.find((event) => event.type === 'node.rerun_requested')).toMatchObject({
      data: {
        recoveredAfterRestart: true
      }
    })
  })

  it('aborts a recovered paused review run as aborted', async () => {
    const initialStore = new RunStateStore()
    const engineBeforeRestart = WorkflowEngine.createForTesting({
      adapter: new FakeAdapter({
        'node-a': {
          output: 'Needs review'
        }
      }),
      memoryManager,
      runStateStore: initialStore,
      artifactGateService: new ArtifactGateService()
    })
    const workflow = createWorkflow([createNode('node-a', { humanReview: true })])

    await engineBeforeRestart.start(workflow, workspacePath, new FakeSender())
    const pausedState = await initialStore.readRun(
      workspacePath,
      (await readSingleRunState(workspacePath)).runId
    )

    const engineAfterRestart = WorkflowEngine.createForTesting({
      adapter: new FakeAdapter(),
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    engineAfterRestart.hydratePausedReviewRuntime(
      workflow,
      workspacePath,
      new FakeSender(),
      pausedState
    )

    await engineAfterRestart.abort(undefined, AbortReason.USER_REQUESTED)

    const finalState = await readSingleRunState(workspacePath)
    expect(finalState.status).toBe('aborted')
    expect(finalState.nodes['node-a']?.status).toBe('aborted')
  })

  it('reruns a paused review node and overwrites its saved output before re-pausing', async () => {
    let executionCount = 0
    const adapter = new FakeAdapter({
      'node-a': {
        onExecute: async () => {
          executionCount += 1
        },
        get output() {
          return executionCount === 1 ? 'First review output' : 'Second review output'
        }
      } as AdapterBehavior
    })
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    const sender = new FakeSender()
    const workflow = createWorkflow([createNode('node-a', { humanReview: true })])

    await engine.start(workflow, workspacePath, sender)
    let runState = await readSingleRunState(workspacePath)
    const outputPath = join(
      workspacePath,
      '.fluxion',
      'memory',
      'short-term',
      'workflow-1',
      'node-a.md'
    )
    expect(await readFile(outputPath, 'utf8')).toContain('First review output')
    const attemptOnePath = join(
      workspacePath,
      '.fluxion',
      'memory',
      'short-term',
      'workflow-1',
      '.history',
      runState.runId,
      'node-a',
      'attempt-1.md'
    )
    expect(await readFile(attemptOnePath, 'utf8')).toContain('First review output')

    await engine.rerunReviewNode(reviewAction(runState.runId, 'node-a'))

    runState = await readSingleRunState(workspacePath)
    expect(runState.status).toBe('awaiting_review')
    expect(runState.nodes['node-a']?.status).toBe('awaiting_review')
    expect(runState.nodes['node-a']?.attempts).toBe(2)
    expect(adapter.executeCalls.map((call) => call.nodeId)).toEqual(['node-a', 'node-a'])
    expect(await readFile(outputPath, 'utf8')).toContain('Second review output')
    const attemptTwoPath = join(
      workspacePath,
      '.fluxion',
      'memory',
      'short-term',
      'workflow-1',
      '.history',
      runState.runId,
      'node-a',
      'attempt-2.md'
    )
    expect(await readFile(attemptTwoPath, 'utf8')).toContain('Second review output')
    const trace = await readTrace(workspacePath, runState.runId)
    expect(
      trace.find(
        (event) =>
          event.nodeId === 'node-a' &&
          event.type === 'node.output_saved' &&
          event.data?.attempt === 2
      )
    ).toMatchObject({
      data: {
        historyOutputFilePath: `.fluxion/memory/short-term/workflow-1/.history/${runState.runId}/node-a/attempt-2.md`
      }
    })
  })

  it('pauses every completed node in manual execution mode and resumes only after approval', async () => {
    const adapter = new FakeAdapter({
      'node-a': {
        output: 'Manual review output A'
      },
      'node-b': {
        output: 'Manual review output B'
      }
    })
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    const sender = new FakeSender()
    const workflow = createWorkflow(
      [createNode('node-a'), createNode('node-b')],
      [{ id: 'edge-a-b', source: 'node-a', target: 'node-b' }],
      'manual'
    )

    await engine.start(workflow, workspacePath, sender)

    let runState = await readSingleRunState(workspacePath)
    expect(runState.executionMode).toBe('manual')
    expect(runState.status).toBe('awaiting_review')
    expect(runState.awaitingReviewNodeIds).toEqual(['node-a'])
    expect(runState.nodes['node-a']?.reviewSource).toBe('manual')
    expect(runState.nodes['node-a']?.humanReview).toBe(false)
    expect(adapter.executeCalls.map((call) => call.nodeId)).toEqual(['node-a'])

    let trace = await readTrace(workspacePath, runState.runId)
    expectTraceOrder(trace, [
      'workflow:workflow.started',
      'node-a:node.ready',
      'node-a:node.running',
      'node-a:node.output_saved',
      'node-a:node.review_requested'
    ])
    expect(
      trace.find((event) => event.nodeId === 'node-a' && event.type === 'node.review_requested')
    ).toMatchObject({
      data: {
        reviewSource: 'manual'
      }
    })
    expectNoTraceType(trace, 'node.ready', 'node-b')
    expectNoTraceType(trace, 'workflow.completed')

    await engine.approveReview(reviewAction(runState.runId, 'node-a'))

    runState = await readSingleRunState(workspacePath)
    expect(runState.status).toBe('awaiting_review')
    expect(runState.awaitingReviewNodeIds).toEqual(['node-b'])
    expect(runState.nodes['node-b']?.reviewSource).toBe('manual')
    expect(adapter.executeCalls.map((call) => call.nodeId)).toEqual(['node-a', 'node-b'])

    trace = await readTrace(workspacePath, runState.runId)
    expectTraceOrder(trace, [
      'node-a:node.review_requested',
      'node-a:node.review_approved',
      'node-b:node.ready',
      'node-b:node.running',
      'node-b:node.output_saved',
      'node-b:node.review_requested'
    ])
    expect(
      trace.find((event) => event.nodeId === 'node-b' && event.type === 'node.review_requested')
    ).toMatchObject({
      data: {
        reviewSource: 'manual'
      }
    })
    expectNoTraceType(trace, 'workflow.completed')

    await engine.approveReview(reviewAction(runState.runId, 'node-b'))

    const finalState = await readSingleRunState(workspacePath)
    expect(finalState.status).toBe('completed')
    expect(finalState.awaitingReviewNodeIds).toEqual([])

    trace = await readTrace(workspacePath, finalState.runId)
    expectTraceOrder(trace, [
      'node-b:node.review_requested',
      'node-b:node.review_approved',
      'workflow:workflow.completed'
    ])
    expect(trace.at(-1)).toMatchObject({ type: 'workflow.completed' })
  })

  it('re-pauses a rerun review node in manual execution mode', async () => {
    let executionCount = 0
    const adapter = new FakeAdapter({
      'node-a': {
        onExecute: async () => {
          executionCount += 1
        },
        get output() {
          return executionCount === 1 ? 'First manual output' : 'Second manual output'
        }
      } as AdapterBehavior
    })
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    const sender = new FakeSender()
    const workflow = createWorkflow([createNode('node-a')], [], 'manual')

    await engine.start(workflow, workspacePath, sender)
    const runState = await readSingleRunState(workspacePath)

    await engine.rerunReviewNode(reviewAction(runState.runId, 'node-a'))

    const rerunState = await readSingleRunState(workspacePath)
    expect(rerunState.status).toBe('awaiting_review')
    expect(rerunState.nodes['node-a']?.status).toBe('awaiting_review')
    expect(rerunState.nodes['node-a']?.reviewSource).toBe('manual')
    expect(rerunState.nodes['node-a']?.attempts).toBe(2)
  })

  it('rejects a manual review checkpoint and finalizes the workflow as rejected', async () => {
    const adapter = new FakeAdapter({
      'node-a': {
        output: 'Manual review output'
      }
    })
    const engine = WorkflowEngine.createForTesting({
      adapter,
      memoryManager,
      runStateStore: new RunStateStore(),
      artifactGateService: new ArtifactGateService()
    })
    const sender = new FakeSender()
    const workflow = createWorkflow([createNode('node-a')], [], 'manual')

    await engine.start(workflow, workspacePath, sender)
    const runState = await readSingleRunState(workspacePath)

    await engine.rejectReview(reviewAction(runState.runId, 'node-a'))

    const finalState = await readSingleRunState(workspacePath)
    expect(finalState.status).toBe('rejected')
    expect(finalState.nodes['node-a']?.reviewSource).toBe('manual')
  })
})
