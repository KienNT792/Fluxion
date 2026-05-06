import { mkdtemp, readdir, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Workflow } from '@shared';
import { RunStateStore } from '../services/run-state-store';

function createWorkflow(): Workflow {
  return {
    id: 'workflow-1',
    name: 'Workflow 1',
    nodes: [
      {
        id: 'node-a',
        type: 'agentNode',
        label: 'Node A',
        position: { x: 0, y: 0 },
        data: {
          provider: 'openai',
          model: 'gpt-5.5',
          prompt: 'Run A',
        },
      },
      {
        id: 'node-b',
        type: 'agentNode',
        label: 'Node B',
        position: { x: 0, y: 0 },
        data: {
          provider: 'openai',
          model: 'gpt-5.5',
          prompt: 'Run B',
        },
      },
    ],
    edges: [],
  };
}

async function readRunJson(workspacePath: string): Promise<unknown> {
  const runsDir = join(workspacePath, '.fluxion', 'runs');
  const files = await readdir(runsDir);
  const filePath = join(runsDir, files[0]!);
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

describe('RunStateStore', () => {
  let workspacePath: string;

  beforeEach(async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-run-state-'));
  });

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true });
  });

  it('initializes a run file with scoped nodes', async () => {
    const store = new RunStateStore();
    await store.initializeRun({
      workspacePath,
      workflow: createWorkflow(),
      executionNodeIds: new Set(['node-a']),
      runId: 'run-1',
    });

    const state = await store.readRun(workspacePath, 'run-1');
    expect(state.status).toBe('running');
    expect(Object.keys(state.nodes)).toEqual(['node-a']);
    expect(state.nodes['node-a']).toMatchObject({
      status: 'pending',
      attempts: 0,
      runner: 'codex',
      model: 'gpt-5.5',
      outputArtifactPaths: [],
    });
  });

  it('preserves concurrent updates for parallel nodes', async () => {
    const store = new RunStateStore();
    await store.initializeRun({
      workspacePath,
      workflow: createWorkflow(),
      executionNodeIds: new Set(['node-a', 'node-b']),
      runId: 'run-2',
    });

    await Promise.all([
      store.markNodeRunning(workspacePath, 'run-2', 'node-a'),
      store.markNodeRunning(workspacePath, 'run-2', 'node-b'),
    ]);

    let state = await store.readRun(workspacePath, 'run-2');
    expect(state.currentNodeIds).toEqual(['node-a', 'node-b']);
    expect(state.nodes['node-a']?.status).toBe('running');
    expect(state.nodes['node-b']?.status).toBe('running');

    await Promise.all([
      store.markNodeCompleted(workspacePath, 'run-2', 'node-a', {
        outputArtifactPaths: ['docs/a.md'],
      }),
      store.markNodeCompleted(workspacePath, 'run-2', 'node-b', {
        outputArtifactPaths: ['docs/b.md'],
      }),
    ]);

    state = await store.readRun(workspacePath, 'run-2');
    expect(state.currentNodeIds).toEqual([]);
    expect(state.nodes['node-a']?.status).toBe('completed');
    expect(state.nodes['node-b']?.status).toBe('completed');
    expect(state.nodes['node-a']?.outputArtifactPaths).toEqual(['docs/a.md']);
    expect(state.nodes['node-b']?.outputArtifactPaths).toEqual(['docs/b.md']);
  });

  it('rejects invalid final states without corrupting the persisted file', async () => {
    const store = new RunStateStore();
    await store.initializeRun({
      workspacePath,
      workflow: createWorkflow(),
      executionNodeIds: new Set(['node-a']),
      runId: 'run-3',
    });

    await expect(
      store.finalizeWorkflow(workspacePath, 'run-3', 'idle' as never)
    ).rejects.toThrow();

    const state = await store.readRun(workspacePath, 'run-3');
    expect(state.status).toBe('running');

    const persisted = (await readRunJson(workspacePath)) as { status: string };
    expect(persisted.status).toBe('running');
  });
});
