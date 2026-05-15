import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import matter from 'gray-matter'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyProjectContextDraft, normalizeProjectContextDraft, Workflow } from '@shared'
import { memoryManager } from '../services/memory-manager'
import { RunStateStore } from '../services/run-state-store'
import { workspaceService } from '../services/workspace.service'

function createWorkflow(id: string, name: string): Workflow {
  return {
    id,
    name,
    executionMode: 'auto',
    nodes: [
      {
        id: 'review-node',
        type: 'agentNode',
        label: 'Review node',
        position: { x: 0, y: 0 },
        data: {
          provider: 'codex',
          model: 'gpt-5.5',
          prompt: 'Review this',
          humanReview: true
        }
      }
    ],
    edges: [],
    createdAt: '2026-05-15T00:00:00.000Z',
    updatedAt: '2026-05-15T00:00:00.000Z'
  }
}

describe('workspaceService project context', () => {
  let workspacePath: string

  afterEach(async () => {
    if (workspacePath) {
      await rm(workspacePath, { recursive: true, force: true })
    }
  })

  it('saves project context.json and global-context.md together', async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-context-save-'))
    const draft = normalizeProjectContextDraft({
      ...createEmptyProjectContextDraft('existing', 'Fluxion'),
      projectGoal: 'Build a Windows-first workflow desktop app',
      targetUsers: 'Developers running local agent workflows',
      primaryStack: ['Electron', 'React', 'TypeScript'],
      architectureSummary: 'Split across main, preload, and renderer layers',
      firstMilestone: 'Ship context setup',
      stableRules: ['Prefer Windows-safe commands'],
      verificationCommands: ['npm run typecheck'],
      importantPaths: ['src/main', 'src/renderer'],
      focusAreas: ['workflow execution'],
      openQuestions: ['How should retries be surfaced?']
    })

    const result = await workspaceService.saveProjectContext(workspacePath, draft, 'final')
    const contextJson = JSON.parse(
      await readFile(join(workspacePath, '.fluxion', 'context.json'), 'utf8')
    )
    const globalContext = matter(
      await readFile(join(workspacePath, '.fluxion', 'memory', 'global-context.md'), 'utf8')
    )
    const compiledContext = await memoryManager.compileContext(workspacePath, 'workflow-1', [])

    expect(result.contextStatus).toBe('ready')
    expect(contextJson.projectGoal).toBe('Build a Windows-first workflow desktop app')
    expect(globalContext.content).toContain('# Project Brief')
    expect(globalContext.content).toContain('Prefer Windows-safe commands')
    expect(compiledContext).toContain('[GLOBAL CONTEXT]')
    expect(compiledContext).toContain('Build a Windows-first workflow desktop app')
  })

  it('maps legacy context files into legacy status until resaved', async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-context-legacy-'))
    await mkdir(join(workspacePath, '.fluxion'), { recursive: true })
    await writeFile(
      join(workspacePath, '.fluxion', 'context.json'),
      JSON.stringify(
        {
          objective: 'Migrate the desktop onboarding flow',
          language: 'TypeScript, React',
          architecture: 'Electron main and renderer',
          styleGuide: 'Prefer Windows-safe commands',
          focusAreas: 'Context setup, workflow runtime'
        },
        null,
        2
      ),
      'utf8'
    )

    const context = await workspaceService.getContext(workspacePath)

    expect(context).not.toBeNull()
    expect(context?.contextStatus).toBe('legacy')
    expect(context?.projectGoal).toBe('Migrate the desktop onboarding flow')
    expect(context?.primaryStack).toEqual(['TypeScript', 'React'])
  })

  it('upserts context onboarding metadata when context.json does not exist yet', async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-context-onboarding-upsert-'))

    const result = await workspaceService.updateContextOnboarding(workspacePath, {
      incompleteBannerDismissedAt: '2026-05-07T02:00:00.000Z'
    })
    const contextJson = JSON.parse(
      await readFile(join(workspacePath, '.fluxion', 'context.json'), 'utf8')
    )
    const globalContext = await readFile(
      join(workspacePath, '.fluxion', 'memory', 'global-context.md'),
      'utf8'
    )

    expect(result.contextStatus).toBe('incomplete')
    expect(contextJson.contextOnboarding.incompleteBannerDismissedAt).toBe(
      '2026-05-07T02:00:00.000Z'
    )
    expect(globalContext).toContain('# Project Brief')
  })

  it('patches context onboarding without losing existing project context fields', async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-context-onboarding-patch-'))
    const draft = normalizeProjectContextDraft({
      ...createEmptyProjectContextDraft('existing', 'Fluxion'),
      projectGoal: 'Build a Windows-first workflow desktop app',
      primaryStack: ['Electron', 'React', 'TypeScript'],
      architectureSummary: 'Split across main, preload, and renderer layers',
      verificationCommands: ['npm run typecheck'],
      contextStatus: 'ready'
    })
    const saved = await workspaceService.saveProjectContext(workspacePath, draft, 'final')

    const result = await workspaceService.updateContextOnboarding(workspacePath, {
      legacyWorkflowDecision: 'keep',
      legacyWorkflowDecisionAt: '2026-05-07T03:00:00.000Z'
    })

    expect(result.context.projectGoal).toBe('Build a Windows-first workflow desktop app')
    expect(result.context.primaryStack).toEqual(['Electron', 'React', 'TypeScript'])
    expect(result.context.contextOnboarding.legacyWorkflowDecision).toBe('keep')
    expect(result.context.lastReviewedAt).toBe(saved.context.lastReviewedAt)
  })

  it('migrates legacy workflow.json into workflows with a backup and onboarding decision', async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-legacy-workflow-migrate-'))
    await mkdir(join(workspacePath, '.fluxion'), { recursive: true })
    await writeFile(
      join(workspacePath, '.fluxion', 'workflow.json'),
      JSON.stringify(
        {
          id: 'legacy-workflow',
          name: 'Legacy Workflow',
          executionMode: 'auto',
          nodes: [],
          edges: [],
          createdAt: '2026-05-07T00:00:00.000Z',
          updatedAt: '2026-05-07T00:00:00.000Z'
        },
        null,
        2
      ),
      'utf8'
    )

    const result = await workspaceService.migrateLegacyWorkflow(workspacePath)
    const context = await workspaceService.getContext(workspacePath)

    await expect(access(join(workspacePath, '.fluxion', 'workflow.json'))).rejects.toThrow()
    expect(JSON.parse(await readFile(result.workflowFilePath, 'utf8')).name).toBe('Legacy Workflow')
    expect(JSON.parse(await readFile(result.backupFilePath, 'utf8')).id).toBe('legacy-workflow')
    expect(context?.contextOnboarding.legacyWorkflowDecision).toBe('migrated')
  })

  it('emits loading events in order while opening a workspace', async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-workspace-load-events-'))
    const sendSpy = vi.fn()
    const sender = { send: sendSpy } as unknown as Electron.WebContents

    await workspaceService.loadWorkspace(workspacePath, sender)
    await workspaceService.dispose()

    const loadingCalls = sendSpy.mock.calls.filter(([channel]) => channel === 'workspace:loading')
    expect(loadingCalls.map(([, payload]) => payload.step)).toEqual([
      'init',
      'init',
      'loadWorkflows',
      'loadWorkflows',
      'loadContext',
      'loadContext',
      'watcher',
      'watcher',
      'ready'
    ])
  })

  it('loads the workflow that owns the newest paused review run and returns recovery metadata', async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-workspace-review-recovery-'))
    const workflowsDir = join(workspacePath, '.fluxion', 'workflows')
    await mkdir(workflowsDir, { recursive: true })
    const olderWorkflow = createWorkflow('workflow-old', 'Older Workflow')
    const newestWorkflow = createWorkflow('workflow-new', 'Newest Workflow')
    await writeFile(
      join(workflowsDir, 'older.fluxion.json'),
      JSON.stringify(olderWorkflow, null, 2),
      'utf8'
    )
    await writeFile(
      join(workflowsDir, 'newest.fluxion.json'),
      JSON.stringify(newestWorkflow, null, 2),
      'utf8'
    )
    await memoryManager.saveNodeOutput(workspacePath, newestWorkflow.id, {
      runId: 'run-new',
      nodeId: 'review-node',
      runner: 'codex',
      model: 'gpt-5.5',
      status: 'completed',
      startedAt: '2026-05-15T02:00:00.000Z',
      completedAt: '2026-05-15T02:01:00.000Z',
      content: 'Pending output'
    })

    const store = new RunStateStore()
    await store.initializeRun({
      workspacePath,
      workflow: olderWorkflow,
      executionNodeIds: new Set(['review-node']),
      runId: 'run-old'
    })
    await store.markNodeRunning(workspacePath, 'run-old', 'review-node')
    await store.markNodeAwaitingReview(workspacePath, 'run-old', 'review-node', {
      completedAt: '2026-05-15T01:01:00.000Z',
      reviewSource: 'node'
    })
    await store.initializeRun({
      workspacePath,
      workflow: newestWorkflow,
      executionNodeIds: new Set(['review-node']),
      runId: 'run-new'
    })
    await store.markNodeRunning(workspacePath, 'run-new', 'review-node')
    await store.markNodeAwaitingReview(workspacePath, 'run-new', 'review-node', {
      completedAt: '2026-05-15T02:01:00.000Z',
      reviewSource: 'node'
    })

    const payload = await workspaceService.loadWorkspace(workspacePath, {
      send: vi.fn()
    } as unknown as Electron.WebContents)
    await workspaceService.dispose()

    expect(payload.workflow.id).toBe('workflow-new')
    expect(payload.activeWorkflowId).toBe('workflow-new')
    expect(payload.recoveredReview).toMatchObject({
      workflowId: 'workflow-new',
      runId: 'run-new',
      nodeIds: ['review-node'],
      executionMode: 'auto',
      nodeAttemptCounts: {
        'review-node': 1
      }
    })
    expect(payload.recoveredReview?.nodeOutputPaths['review-node']).toContain(
      join('.fluxion', 'memory', 'short-term', 'workflow-new', 'review-node.md')
    )
  })

  it('emits a loading error event when opening fails', async () => {
    workspacePath = join(tmpdir(), `fluxion-workspace-load-file-${Date.now()}`)
    await writeFile(workspacePath, 'not a directory', 'utf8')
    const sendSpy = vi.fn()
    const sender = { send: sendSpy } as unknown as Electron.WebContents

    await expect(workspaceService.loadWorkspace(workspacePath, sender)).rejects.toThrow()

    const loadingCalls = sendSpy.mock.calls.filter(([channel]) => channel === 'workspace:loading')
    const lastPayload = loadingCalls[loadingCalls.length - 1]?.[1]
    expect(lastPayload).toMatchObject({
      step: 'init',
      status: 'error'
    })
  })
})
