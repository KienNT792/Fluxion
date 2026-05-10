import { describe, expect, it } from 'vitest'
import { ONBOARDING_PACKET_VERSION, OnboardingPacketSchema } from './onboarding.types'

describe('OnboardingPacketSchema', () => {
  it('validates the Fluxion onboarding packet contract', () => {
    const packet = OnboardingPacketSchema.parse({
      version: ONBOARDING_PACKET_VERSION,
      projectName: 'Fluxion',
      generatedAt: '2026-01-02T00:00:00.000Z',
      generationMode: 'deterministic',
      projectSummary: 'Desktop orchestration for Codex workflows.',
      stack: ['Electron', 'React', 'TypeScript'],
      components: [
        {
          id: 'root',
          name: 'Fluxion',
          role: 'Electron app root',
          type: 'desktop',
          rootPath: '.',
          technologies: ['TypeScript'],
          evidenceIds: ['evidence-1']
        }
      ],
      architectureMap: ['Electron main/preload/renderer layers'],
      commands: [
        {
          id: 'command-1',
          label: 'Typecheck',
          command: 'npm run typecheck',
          cwd: '.',
          category: 'typecheck',
          risk: 'safe',
          confidence: 'high',
          evidenceIds: ['evidence-1']
        }
      ],
      risks: ['No packaging smoke command detected.'],
      openQuestions: ['Which workflow should be active first?'],
      suggestedContextPatch: {
        projectGoal: 'Build repeatable Codex workflow orchestration.',
        stableRules: ['Keep runtime logic out of the renderer.']
      },
      suggestedStableRules: ['Keep runtime logic out of the renderer.'],
      artifactRecommendations: [
        {
          kind: 'memory',
          label: 'Save onboarding packet',
          relativePath: '.fluxion/memory/long-term/onboarding.md',
          rationale: 'Keep detailed evidence outside compact context.'
        }
      ],
      sourceEvidence: [
        {
          id: 'evidence-1',
          sourcePath: 'README.md',
          confidence: 'high',
          note: 'README describes the product.',
          matchedSignals: ['Codex workflows']
        }
      ],
      diagnostics: {
        generatedAt: '2026-01-02T00:00:00.000Z',
        mode: 'deterministic',
        filesRead: 1,
        truncatedFiles: [],
        warnings: []
      }
    })

    expect(packet.projectName).toBe('Fluxion')
    expect(packet.commands[0]?.command).toBe('npm run typecheck')
  })
})
