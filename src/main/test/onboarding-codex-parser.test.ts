import { describe, expect, it } from 'vitest'
import { ONBOARDING_PACKET_VERSION, OnboardingPacket } from '@shared'
import { parseCodexOnboardingOutput } from '../services/onboarding/onboarding-codex-parser'
import type { OnboardingLogger } from '../services/onboarding/onboarding-logger'

function createPacket(overrides: Partial<OnboardingPacket> = {}): OnboardingPacket {
  return {
    version: ONBOARDING_PACKET_VERSION,
    projectName: 'Fixture',
    generatedAt: '2026-01-02T00:00:00.000Z',
    generationMode: 'deterministic',
    projectSummary: 'Fixture packet.',
    stack: ['TypeScript'],
    components: [],
    architectureMap: ['Root application'],
    commands: [],
    risks: [],
    openQuestions: [],
    suggestedContextPatch: {
      projectGoal: 'Build a fixture project.'
    },
    suggestedStableRules: ['Keep changes scoped.'],
    artifactRecommendations: [
      {
        kind: 'memory',
        label: 'Save onboarding packet',
        relativePath: '.fluxion/memory/long-term/onboarding.md',
        rationale: 'Keep details out of compact context.'
      }
    ],
    sourceEvidence: [
      {
        id: 'evidence-1',
        sourcePath: 'README.md',
        confidence: 'high',
        note: 'README provided.',
        matchedSignals: []
      }
    ],
    diagnostics: {
      generatedAt: '2026-01-02T00:00:00.000Z',
      mode: 'deterministic',
      filesRead: 1,
      truncatedFiles: [],
      warnings: []
    },
    ...overrides
  }
}

function createLogger(): { logger: OnboardingLogger; calls: string[] } {
  const calls: string[] = []
  const record = (event: string, metadata?: Record<string, unknown>): void => {
    calls.push(JSON.stringify({ event, metadata }))
  }

  return {
    calls,
    logger: {
      info: record,
      warn: record,
      error: record
    }
  }
}

describe('onboarding-codex-parser', () => {
  it('normalizes command enum aliases and casing before schema validation', () => {
    const fallbackPacket = createPacket()
    const rawPacket = createPacket({
      generationMode: 'codex-assisted',
      commands: [
        {
          id: 'command-1',
          label: 'Verify',
          command: 'npm run test',
          cwd: '.',
          category: 'VERIFY' as never,
          risk: 'HIGH' as never,
          confidence: 'medium',
          evidenceIds: []
        }
      ],
      diagnostics: {
        generatedAt: '2026-01-02T00:00:00.000Z',
        mode: 'codex-assisted',
        model: 'gpt-5.5',
        filesRead: 1,
        truncatedFiles: [],
        warnings: []
      }
    })
    const { calls, logger } = createLogger()

    const packet = parseCodexOnboardingOutput(
      JSON.stringify(rawPacket),
      fallbackPacket,
      {
        generatedAt: '2026-01-03T00:00:00.000Z',
        mode: 'codex-assisted',
        model: 'gpt-5.5',
        filesRead: 1,
        truncatedFiles: [],
        warnings: []
      },
      logger
    )

    expect(packet.commands[0]).toMatchObject({
      category: 'test',
      risk: 'needs-approval'
    })
    expect(packet.diagnostics.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Normalized invalid onboarding command category'),
        expect.stringContaining('Normalized invalid onboarding command risk')
      ])
    )
    expect(calls.join('\n')).toContain('codex.output-normalized')
  })

  it('logs parse failures without raw output content', () => {
    const fallbackPacket = createPacket()
    const { calls, logger } = createLogger()

    expect(() =>
      parseCodexOnboardingOutput(
        'not json OPENAI_API_KEY=secret',
        fallbackPacket,
        {
          generatedAt: '2026-01-03T00:00:00.000Z',
          mode: 'codex-assisted',
          model: 'gpt-5.5',
          filesRead: 1,
          truncatedFiles: [],
          warnings: []
        },
        logger
      )
    ).toThrow(/non-JSON output/)

    const logged = calls.join('\n')
    expect(logged).toContain('codex.parse-json.failed')
    expect(logged).not.toContain('OPENAI_API_KEY')
    expect(logged).not.toContain('secret')
  })

  it('keeps strict schema validation for non-normalizable packet shape errors', () => {
    const fallbackPacket = createPacket()
    const invalidPacket = {
      ...createPacket({ generationMode: 'codex-assisted' }),
      commands: [
        {
          id: 'command-1',
          label: 'Verify',
          cwd: '.',
          category: 'test',
          risk: 'safe',
          confidence: 'medium',
          evidenceIds: []
        }
      ]
    }

    expect(() =>
      parseCodexOnboardingOutput(JSON.stringify(invalidPacket), fallbackPacket, {
        generatedAt: '2026-01-03T00:00:00.000Z',
        mode: 'codex-assisted',
        model: 'gpt-5.5',
        filesRead: 1,
        truncatedFiles: [],
        warnings: []
      })
    ).toThrow(/expected packet shape/)
  })
})
