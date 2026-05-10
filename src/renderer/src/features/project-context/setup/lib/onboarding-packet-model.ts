import type {
  OnboardingPacket,
  OnboardingSuggestedContextPatch,
  ProjectContextDraft
} from '@shared'

export type OnboardingPacketTab = 'summary' | 'architecture' | 'commands' | 'risks' | 'evidence'

export interface OnboardingGenerationAvailability {
  deterministicDisabled: boolean
  codexDisabled: boolean
}

const LIST_FIELDS = [
  'stableRules',
  'verificationCommands',
  'importantPaths',
  'focusAreas',
  'nonGoals',
  'openQuestions',
  'primaryStack',
  'languages',
  'frameworks',
  'packageManagers',
  'buildSystems',
  'testFrameworks',
  'entrypoints',
  'moduleBoundaries',
  'generatedOrIgnoredPaths',
  'riskFlags',
  'recommendedFirstActions'
] as const satisfies readonly (keyof OnboardingSuggestedContextPatch)[]

const SCALAR_FIELDS = [
  'projectGoal',
  'targetUsers',
  'architectureSummary',
  'firstMilestone'
] as const satisfies readonly (keyof OnboardingSuggestedContextPatch)[]

function uniqueList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

export function buildOnboardingContextPatch(
  draft: ProjectContextDraft,
  packet: OnboardingPacket
): Partial<ProjectContextDraft> {
  const patch: Partial<ProjectContextDraft> = {}
  const suggested = packet.suggestedContextPatch

  for (const field of SCALAR_FIELDS) {
    const value = suggested[field]
    if (typeof value === 'string' && value.trim()) {
      patch[field] = value.trim() as never
    }
  }

  for (const field of LIST_FIELDS) {
    const values = suggested[field]
    if (!Array.isArray(values) || values.length === 0) {
      continue
    }

    const current = draft[field]
    const currentList = Array.isArray(current) ? current : []
    patch[field] = uniqueList([...currentList, ...values]) as never
  }

  if (packet.sourceEvidence.length > 0) {
    const seen = new Set(draft.sourceEvidence.map((evidence) => evidence.id ?? ''))
    patch.sourceEvidence = [
      ...draft.sourceEvidence,
      ...packet.sourceEvidence
        .map((evidence, index) => ({
          id: `onboarding-${evidence.id || index + 1}`,
          field: 'architectureSummary' as const,
          sourcePath: evidence.sourcePath,
          confidence: evidence.confidence,
          detectorId: 'fluxion-onboarding',
          note: evidence.note,
          confidenceReason: evidence.note,
          matchedSignals: evidence.matchedSignals
        }))
        .filter((evidence) => {
          if (seen.has(evidence.id)) {
            return false
          }
          seen.add(evidence.id)
          return true
        })
    ]
  }

  return patch
}

export function countOnboardingSuggestions(packet: OnboardingPacket | null): number {
  if (!packet) {
    return 0
  }

  return Object.values(packet.suggestedContextPatch).filter((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value?.trim())
  ).length
}

export function getOnboardingGenerationAvailability({
  isCodexReady,
  isGenerating
}: {
  isCodexReady: boolean
  isGenerating: boolean
}): OnboardingGenerationAvailability {
  return {
    deterministicDisabled: isGenerating,
    codexDisabled: isGenerating || !isCodexReady
  }
}
