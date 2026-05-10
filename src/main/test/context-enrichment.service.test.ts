import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { RunnerContext, RunnerEvent, RunnerResult } from '@core'
import { normalizeProjectContextDraft } from '@shared'
import {
  ContextEnrichmentService,
  parseContextEnrichmentOutput
} from '../services/context-enrichment.service'

class FakeContextEnrichmentRunner {
  public capturedContext: RunnerContext | null = null

  public constructor(private readonly output: string) {}

  public async *run(ctx: RunnerContext): AsyncGenerator<RunnerEvent, RunnerResult, void> {
    this.capturedContext = ctx
    yield {
      type: 'status',
      content: 'fake codex started',
      timestamp: Date.now()
    }
    return {
      success: true,
      output: this.output,
      exitCode: 0
    }
  }
}

async function writeWorkspaceFile(
  workspacePath: string,
  relativePath: string,
  content: string
): Promise<void> {
  const fullPath = join(workspacePath, relativePath)
  await mkdir(dirname(fullPath), { recursive: true })
  await writeFile(fullPath, content, 'utf8')
}

describe('context-enrichment.service', () => {
  const workspaces: string[] = []

  afterEach(async () => {
    await Promise.all(
      workspaces.map((workspacePath) => rm(workspacePath, { recursive: true, force: true }))
    )
  })

  async function createWorkspace(): Promise<string> {
    const workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-context-enrich-'))
    workspaces.push(workspacePath)
    return workspacePath
  }

  it('parses strict or fenced JSON enrichment output', () => {
    const result = parseContextEnrichmentOutput(
      [
        '```json',
        JSON.stringify({
          fields: {
            projectGoal: 'Build repeatable Codex workflows.',
            focusAreas: ['runtime reliability', 'context setup']
          },
          evidence: [
            {
              field: 'projectGoal',
              sourcePath: 'README.md',
              confidence: 'high',
              note: 'README describes the product goal.'
            }
          ]
        }),
        '```'
      ].join('\n'),
      {
        generatedAt: '2026-01-02T00:00:00.000Z',
        model: 'gpt-5.5',
        filesRead: 1,
        truncatedFiles: [],
        warnings: []
      }
    )

    expect(result.suggestedFields).toEqual({
      projectGoal: 'Build repeatable Codex workflows.',
      focusAreas: ['runtime reliability', 'context setup']
    })
    expect(result.sourceEvidence).toEqual([
      expect.objectContaining({
        field: 'projectGoal',
        sourcePath: 'README.md',
        confidence: 'high',
        detectorId: 'codex-context-enrichment'
      })
    ])
  })

  it('runs Codex enrichment with read-only non-interactive permissions', async () => {
    const workspacePath = await createWorkspace()
    await writeWorkspaceFile(
      workspacePath,
      'README.md',
      '# Fluxion\n\nWindows-first desktop orchestration for Codex workflows.'
    )
    await writeWorkspaceFile(
      workspacePath,
      'package.json',
      JSON.stringify({
        name: 'fluxion',
        scripts: { typecheck: 'tsc --noEmit' },
        dependencies: { electron: '^39.0.0', react: '^19.0.0' }
      })
    )

    const runner = new FakeContextEnrichmentRunner(
      JSON.stringify({
        fields: {
          projectGoal: 'Fluxion turns repeatable Codex CLI work into visual workflows.',
          stableRules: ['Keep Codex CLI as the primary runtime path.']
        },
        evidence: [
          {
            field: 'projectGoal',
            sourcePath: 'README.md',
            confidence: 'high',
            note: 'README states the product purpose.'
          }
        ]
      })
    )
    const service = new ContextEnrichmentService({
      runner,
      now: () => new Date('2026-01-02T00:00:00.000Z')
    })
    const draft = normalizeProjectContextDraft({
      workspaceType: 'existing',
      projectName: 'Fluxion',
      projectGoal: '',
      sourceEvidence: []
    })

    const result = await service.enrich({ workspacePath, draft })

    expect(result.suggestedFields.projectGoal).toContain('Codex CLI')
    expect(result.diagnostics).toMatchObject({
      generatedAt: '2026-01-02T00:00:00.000Z',
      model: 'gpt-5.5',
      filesRead: 2
    })
    expect(runner.capturedContext?.node.data.codex).toMatchObject({
      sandboxMode: 'read-only',
      approvalPolicy: 'never'
    })
    expect(runner.capturedContext?.prompt).toContain('Return strict JSON only')
    expect(runner.capturedContext?.prompt).toContain('Windows-first desktop orchestration')
  })
})
