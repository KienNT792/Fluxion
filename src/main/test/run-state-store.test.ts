import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Workflow } from '@shared'
import { RunStateStore } from '../services/run-state-store'

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
          provider: 'codex',
          model: 'gpt-5.5',
          prompt: 'Run A'
        }
      },
      {
        id: 'node-b',
        type: 'agentNode',
        label: 'Node B',
        position: { x: 0, y: 0 },
        data: {
          provider: 'codex',
          model: 'gpt-5.5',
          prompt: 'Run B'
        }
      }
    ],
    edges: []
  }
}

async function readRunJson(workspacePath: string): Promise<unknown> {
  const runsDir = join(workspacePath, '.fluxion', 'runs')
  const files = await readdir(runsDir)
  const filePath = join(runsDir, files[0]!)
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown
}

describe('RunStateStore', () => {
  let workspacePath: string

  beforeEach(async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-run-state-'))
  })

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true })
  })

  it('initializes a run file with scoped nodes', async () => {
    const store = new RunStateStore()
    await store.initializeRun({
      workspacePath,
      workflow: createWorkflow(),
      executionNodeIds: new Set(['node-a']),
      runId: 'run-1'
    })

    const state = await store.readRun(workspacePath, 'run-1')
    expect(state.status).toBe('running')
    expect(state.executionMode).toBe('auto')
    expect(Object.keys(state.nodes)).toEqual(['node-a'])
    expect(state.nodes['node-a']).toMatchObject({
      status: 'pending',
      attempts: 0,
      runner: 'codex',
      model: 'gpt-5.5',
      humanReview: false,
      outputArtifactPaths: []
    })
    expect(state.awaitingReviewNodeIds).toEqual([])
  })

  it('preserves concurrent updates for parallel nodes', async () => {
    const store = new RunStateStore()
    await store.initializeRun({
      workspacePath,
      workflow: createWorkflow(),
      executionNodeIds: new Set(['node-a', 'node-b']),
      runId: 'run-2'
    })

    await Promise.all([
      store.markNodeRunning(workspacePath, 'run-2', 'node-a'),
      store.markNodeRunning(workspacePath, 'run-2', 'node-b')
    ])

    let state = await store.readRun(workspacePath, 'run-2')
    expect(state.currentNodeIds).toEqual(['node-a', 'node-b'])
    expect(state.nodes['node-a']?.status).toBe('running')
    expect(state.nodes['node-b']?.status).toBe('running')

    await Promise.all([
      store.markNodeCompleted(workspacePath, 'run-2', 'node-a', {
        outputArtifactPaths: ['docs/a.md']
      }),
      store.markNodeCompleted(workspacePath, 'run-2', 'node-b', {
        outputArtifactPaths: ['docs/b.md']
      })
    ])

    state = await store.readRun(workspacePath, 'run-2')
    expect(state.currentNodeIds).toEqual([])
    expect(state.nodes['node-a']?.status).toBe('completed')
    expect(state.nodes['node-b']?.status).toBe('completed')
    expect(state.nodes['node-a']?.outputArtifactPaths).toEqual(['docs/a.md'])
    expect(state.nodes['node-b']?.outputArtifactPaths).toEqual(['docs/b.md'])
  })

  it('rejects invalid final states without corrupting the persisted file', async () => {
    const store = new RunStateStore()
    await store.initializeRun({
      workspacePath,
      workflow: createWorkflow(),
      executionNodeIds: new Set(['node-a']),
      runId: 'run-3'
    })

    await expect(store.finalizeWorkflow(workspacePath, 'run-3', 'idle' as never)).rejects.toThrow()

    const state = await store.readRun(workspacePath, 'run-3')
    expect(state.status).toBe('running')

    const persisted = (await readRunJson(workspacePath)) as { status: string }
    expect(persisted.status).toBe('running')
  })

  it('transitions nodes through awaiting review, approval, rejection, and rerun reset', async () => {
    const store = new RunStateStore()
    const workflow = createWorkflow()
    workflow.nodes[0]!.data.humanReview = true

    await store.initializeRun({
      workspacePath,
      workflow,
      executionNodeIds: new Set(['node-a']),
      runId: 'run-4'
    })

    await store.markNodeRunning(workspacePath, 'run-4', 'node-a')
    let state = await store.markNodeAwaitingReview(workspacePath, 'run-4', 'node-a', {
      outputArtifactPaths: ['docs/review.md'],
      reviewSource: 'node'
    })
    expect(state.status).toBe('awaiting_review')
    expect(state.awaitingReviewNodeIds).toEqual(['node-a'])
    expect(state.nodes['node-a']).toMatchObject({
      status: 'awaiting_review',
      humanReview: true,
      reviewStatus: 'pending',
      reviewSource: 'node',
      outputArtifactPaths: ['docs/review.md']
    })

    state = await store.markReviewApproved(workspacePath, 'run-4', 'node-a', {
      comment: 'looks good'
    })
    expect(state.status).toBe('running')
    expect(state.awaitingReviewNodeIds).toEqual([])
    expect(state.nodes['node-a']).toMatchObject({
      status: 'completed',
      reviewStatus: 'approved',
      reviewComment: 'looks good'
    })

    await store.markNodeAwaitingReview(workspacePath, 'run-4', 'node-a')
    state = await store.resetNodeForRerun(workspacePath, 'run-4', 'node-a')
    expect(state.nodes['node-a']).toMatchObject({
      status: 'pending',
      reviewStatus: undefined,
      reviewSource: undefined,
      outputArtifactPaths: []
    })

    await store.markNodeAwaitingReview(workspacePath, 'run-4', 'node-a')
    state = await store.markReviewRejected(workspacePath, 'run-4', 'node-a', {
      comment: 'needs changes'
    })
    expect(state.status).toBe('rejected')
    expect(state.nodes['node-a']).toMatchObject({
      status: 'rejected',
      reviewStatus: 'rejected',
      reviewSource: 'node',
      reviewComment: 'needs changes'
    })
  })

  it('records manual execution mode review checkpoints without mutating node-level humanReview', async () => {
    const store = new RunStateStore()
    await store.initializeRun({
      workspacePath,
      workflow: createWorkflow(),
      executionNodeIds: new Set(['node-a']),
      runId: 'run-5',
      executionMode: 'manual'
    })

    await store.markNodeRunning(workspacePath, 'run-5', 'node-a')
    const state = await store.markNodeAwaitingReview(workspacePath, 'run-5', 'node-a', {
      reviewSource: 'manual'
    })

    expect(state.executionMode).toBe('manual')
    expect(state.nodes['node-a']).toMatchObject({
      humanReview: false,
      reviewSource: 'manual',
      reviewStatus: 'pending'
    })
  })

  it('lists valid awaiting-review runs newest first and skips invalid files', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const store = new RunStateStore()
    const workflow = createWorkflow()

    await store.initializeRun({
      workspacePath,
      workflow,
      executionNodeIds: new Set(['node-a']),
      runId: 'run-old'
    })
    await store.initializeRun({
      workspacePath,
      workflow,
      executionNodeIds: new Set(['node-b']),
      runId: 'run-new'
    })
    await store.initializeRun({
      workspacePath,
      workflow,
      executionNodeIds: new Set(['node-a']),
      runId: 'run-completed'
    })

    await store.markNodeRunning(workspacePath, 'run-old', 'node-a', '2026-05-15T01:00:00.000Z')
    await store.markNodeAwaitingReview(workspacePath, 'run-old', 'node-a', {
      completedAt: '2026-05-15T01:01:00.000Z',
      reviewSource: 'node'
    })
    await store.markNodeRunning(workspacePath, 'run-new', 'node-b', '2026-05-15T02:00:00.000Z')
    await store.markNodeAwaitingReview(workspacePath, 'run-new', 'node-b', {
      completedAt: '2026-05-15T02:01:00.000Z',
      reviewSource: 'node'
    })
    await store.markNodeRunning(
      workspacePath,
      'run-completed',
      'node-a',
      '2026-05-15T03:00:00.000Z'
    )
    await store.markNodeCompleted(workspacePath, 'run-completed', 'node-a', {
      completedAt: '2026-05-15T03:01:00.000Z'
    })
    await store.finalizeWorkflow(
      workspacePath,
      'run-completed',
      'completed',
      '2026-05-15T03:02:00.000Z'
    )

    await mkdir(join(workspacePath, '.fluxion', 'runs'), { recursive: true })
    await writeFile(join(workspacePath, '.fluxion', 'runs', 'corrupt.json'), '{', 'utf8')

    const runs = await store.listAwaitingReviewRuns(workspacePath)

    expect(runs.map((run) => run.runId)).toEqual(['run-new', 'run-old'])
    expect(runs.every((run) => run.status === 'awaiting_review')).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Skipping invalid run state file:'),
      expect.any(Error)
    )
    warnSpy.mockRestore()
  })
})
