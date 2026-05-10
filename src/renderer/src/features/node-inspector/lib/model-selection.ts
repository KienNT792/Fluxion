import { CODEX_DEFAULT_REASONING_LEVEL, ReasoningLevel } from '@shared'

const REASONING_LEVELS = new Set<string>(['low', 'medium', 'high', 'xhigh'])

export interface ReasoningModelSelection {
  defaultReasoningLevel?: string
  supportedReasoningLevels: string[]
}

function toReasoningLevel(value: string | undefined): ReasoningLevel | undefined {
  return value && REASONING_LEVELS.has(value) ? (value as ReasoningLevel) : undefined
}

export function getNextReasoningLevelForModel(
  currentReasoningLevel: ReasoningLevel | undefined,
  nextModel: ReasoningModelSelection | undefined,
  supportsReasoning: boolean
): ReasoningLevel | undefined {
  if (!nextModel) {
    return currentReasoningLevel
  }

  if (!supportsReasoning) {
    return undefined
  }

  const preferredLevel = currentReasoningLevel ?? CODEX_DEFAULT_REASONING_LEVEL
  if (nextModel.supportedReasoningLevels.includes(preferredLevel)) {
    return preferredLevel
  }

  return toReasoningLevel(nextModel.defaultReasoningLevel) ?? CODEX_DEFAULT_REASONING_LEVEL
}
