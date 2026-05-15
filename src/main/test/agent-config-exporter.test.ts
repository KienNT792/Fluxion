import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it } from 'vitest'
import { createEmptyProjectContextDraft, normalizeProjectContextDraft } from '@shared'
import type { ProjectContextCommand, ProjectContextDraft } from '@shared'
import { agentConfigPreviewService } from '../services/agent-config/agent-config-preview.service'

function createReadyContext(): ProjectContextDraft {
  return normalizeProjectContextDraft({
    ...createEmptyProjectContextDraft('existing', 'Fluxion'),
    contextStatus: 'ready',
    projectGoal: 'Build a local workflow orchestration app',
    targetUsers: 'Developers',
    primaryStack: ['Electron', 'React', 'TypeScript'],
    architectureSummary: 'Electron main, preload, and renderer layers.',
    firstMilestone: 'Ship ContextInit',
    verificationCommands: ['npm run typecheck'],
    importantPaths: ['src/main', 'src/renderer'],
    stableRules: ['Prefer Windows-safe commands.']
  })
}

describe('agent config export', () => {
  let workspacePath: string

  afterEach(async () => {
    if (workspacePath) {
      await rm(workspacePath, { recursive: true, force: true })
    }
  })

  it('lists Codex with Claude and Gemini scaffolds', () => {
    const exporters = agentConfigPreviewService.listExporters()

    expect(exporters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'codex', status: 'ready' }),
        expect.objectContaining({ id: 'claude', status: 'notImplemented' }),
        expect.objectContaining({ id: 'gemini', status: 'notImplemented' })
      ])
    )
  })

  it('creates and applies a Codex AGENTS.md preview', async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-agent-config-'))
    const preview = await agentConfigPreviewService.createPreview(
      workspacePath,
      'codex',
      createReadyContext()
    )

    expect(preview.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'create',
          relativePath: 'AGENTS.md'
        })
      ])
    )

    await agentConfigPreviewService.applyPreview(preview)

    const agents = await readFile(join(workspacePath, 'AGENTS.md'), 'utf8')
    expect(agents).toContain('<!-- BEGIN FLUXION CONTEXT -->')
    expect(agents).toContain('Build a local workflow orchestration app')
    expect(agents).toContain('npm run typecheck')
  })

  it('updates an existing Fluxion-marked AGENTS.md section', async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-agent-config-update-'))
    await writeFile(
      join(workspacePath, 'AGENTS.md'),
      [
        '# Team Instructions',
        '',
        '<!-- BEGIN FLUXION CONTEXT -->',
        'old generated content',
        '<!-- END FLUXION CONTEXT -->',
        '',
        'Keep this manual note.',
        ''
      ].join('\n'),
      'utf8'
    )

    const preview = await agentConfigPreviewService.createPreview(
      workspacePath,
      'codex',
      createReadyContext()
    )

    expect(preview.operations[0]?.action).toBe('update')
    await agentConfigPreviewService.applyPreview(preview)

    const agents = await readFile(join(workspacePath, 'AGENTS.md'), 'utf8')
    expect(agents).not.toContain('old generated content')
    expect(agents).toContain('Keep this manual note.')
    expect(agents).toContain('Prefer Windows-safe commands.')
  })

  it('keeps Codex AGENTS.md export compact and focused on stable context', async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-agent-config-compact-'))
    const commands: ProjectContextCommand[] = Array.from({ length: 12 }, (_, index) => ({
      id: `command-${index + 1}`,
      label: `Command ${index + 1}`,
      command: `npm run task-${index + 1}`,
      cwd: '.',
      category: 'test',
      risk: 'safe',
      confidence: 'medium',
      evidenceIds: []
    }))
    const context = normalizeProjectContextDraft({
      ...createReadyContext(),
      stableRules: Array.from({ length: 12 }, (_, index) => `Durable rule ${index + 1}`),
      importantPaths: Array.from({ length: 12 }, (_, index) => `src/module-${index + 1}`),
      riskFlags: Array.from({ length: 12 }, (_, index) => `Risk flag ${index + 1}`),
      commandCatalog: commands,
      sourceEvidence: [
        {
          id: 'onboarding-evidence-1',
          field: 'architectureSummary',
          sourcePath: '.fluxion/memory/long-term/onboarding.md',
          confidence: 'high',
          note: 'Long onboarding packet detail that should stay out of AGENTS export.'
        }
      ]
    })

    const preview = await agentConfigPreviewService.createPreview(workspacePath, 'codex', context)
    const agents = preview.operations.find(
      (operation) => operation.relativePath === 'AGENTS.md'
    )?.content
    const agentsContent = agents ?? ''

    expect(agentsContent).toContain('## Project Overview')
    expect(agentsContent).toContain('## Architecture Boundaries')
    expect(agentsContent).toContain('## Commands')
    expect(agentsContent).toContain('## Durable Rules')
    expect(agentsContent).toContain('## Important Paths')
    expect(agentsContent).toContain('## Risk Flags')
    expect(agentsContent).toContain('more omitted; see Fluxion context or onboarding memory')
    expect(agentsContent).not.toContain('Long onboarding packet detail')
    expect(agentsContent.length).toBeLessThan(3500)
  })

  it('can preview advanced Codex config without requiring Claude or Gemini support', async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-agent-config-advanced-'))
    const preview = await agentConfigPreviewService.createPreview(
      workspacePath,
      'codex',
      createReadyContext(),
      { includeAdvancedConfig: true }
    )

    expect(
      preview.operations.map((operation) => operation.relativePath.replaceAll('\\', '/'))
    ).toEqual(expect.arrayContaining(['AGENTS.md', '.codex/config.toml']))
    expect(preview.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('trusted projects')])
    )
  })
})
