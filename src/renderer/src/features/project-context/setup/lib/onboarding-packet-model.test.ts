import { describe, expect, it } from 'vitest'
import {
  normalizeProjectContextDraft,
  ONBOARDING_PACKET_VERSION,
  type OnboardingPacket
} from '@shared'
import {
  buildOnboardingContextPatch,
  countOnboardingSuggestions,
  getOnboardingGenerationAvailability
} from './onboarding-packet-model'

function createPacket(): OnboardingPacket {
  return {
    version: ONBOARDING_PACKET_VERSION,
    projectName: 'Fluxion',
    generatedAt: '2026-01-02T00:00:00.000Z',
    generationMode: 'deterministic',
    projectSummary: 'A workflow app.',
    stack: ['Electron'],
    components: [],
    architectureMap: [],
    commands: [],
    risks: [],
    openQuestions: [],
    suggestedContextPatch: {
      projectGoal: 'Build visual Codex workflows.',
      stableRules: ['Prefer Windows-safe commands.'],
      importantPaths: ['src/main']
    },
    suggestedStableRules: ['Prefer Windows-safe commands.'],
    artifactRecommendations: [],
    sourceEvidence: [
      {
        id: 'evidence-1',
        sourcePath: 'README.md',
        confidence: 'high',
        note: 'README states the goal.',
        matchedSignals: ['Codex']
      }
    ],
    diagnostics: {
      generatedAt: '2026-01-02T00:00:00.000Z',
      mode: 'deterministic',
      filesRead: 1,
      truncatedFiles: [],
      warnings: []
    },
    skillAssets: []
  }
}

describe('onboarding-packet-model', () => {
  it('applies packet suggestions to the context draft without dropping existing lists', () => {
    const draft = normalizeProjectContextDraft({
      workspaceType: 'existing',
      projectName: 'Fluxion',
      focusAreas: ['runtime'],
      importantPaths: ['src/renderer'],
      sourceEvidence: []
    })
    const patch = buildOnboardingContextPatch(draft, createPacket())

    expect(patch.projectGoal).toBe('Build visual Codex workflows.')
    expect(patch.importantPaths).toEqual(['src/renderer', 'src/main'])
    expect(patch.focusAreas).toBeUndefined()
    expect(patch.sourceEvidence).toEqual([
      expect.objectContaining({
        detectorId: 'fluxion-onboarding',
        sourcePath: 'README.md'
      })
    ])
  })

  it('counts non-empty packet suggestions', () => {
    expect(countOnboardingSuggestions(createPacket())).toBe(3)
    expect(countOnboardingSuggestions(null)).toBe(0)
  })

  it('keeps deterministic onboarding available when Codex is unavailable', () => {
    expect(
      getOnboardingGenerationAvailability({ isCodexReady: false, isGenerating: false })
    ).toEqual({
      deterministicDisabled: false,
      codexDisabled: true
    })
    expect(getOnboardingGenerationAvailability({ isCodexReady: true, isGenerating: true })).toEqual(
      {
        deterministicDisabled: true,
        codexDisabled: true
      }
    )
  })
})
