import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import matter from 'gray-matter'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyProjectContextDraft, normalizeProjectContextDraft } from '@shared'
import { memoryManager } from '../services/memory-manager'
import { workspaceService } from '../services/workspace.service'

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
