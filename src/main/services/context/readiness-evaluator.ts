import { ProjectContextDraft, ProjectContextReadiness, WorkspaceContextType } from '@shared'

type ReadinessInput = Pick<
  ProjectContextDraft,
  | 'workspaceType'
  | 'projectGoal'
  | 'targetUsers'
  | 'kickoffIntent'
  | 'primaryStack'
  | 'languages'
  | 'frameworks'
  | 'architectureSummary'
  | 'firstMilestone'
  | 'importantPaths'
  | 'verificationCommands'
  | 'riskFlags'
  | 'recommendedFirstActions'
>

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim())
}

function hasItems(values: string[] | undefined): boolean {
  return Boolean(values?.length)
}

function hasStackSignal(input: ReadinessInput): boolean {
  return hasItems(input.primaryStack) || hasItems(input.languages) || hasItems(input.frameworks)
}

function hasStructureSignal(input: ReadinessInput): boolean {
  return hasText(input.architectureSummary) || hasItems(input.importantPaths)
}

function hasVerificationSignal(input: ReadinessInput): boolean {
  return (
    hasItems(input.verificationCommands) ||
    (input.riskFlags ?? []).some((flag) => flag.toLowerCase().includes('verification'))
  )
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

export function evaluateProjectContextReadiness(input: ReadinessInput): ProjectContextReadiness {
  const missingItems: string[] = []

  if (!hasText(input.projectGoal)) {
    missingItems.push('Project goal')
  }

  if (input.workspaceType === ('blank' satisfies WorkspaceContextType)) {
    if (!input.kickoffIntent) {
      missingItems.push('Kickoff intent')
    }
    if (!hasText(input.firstMilestone)) {
      missingItems.push('First milestone')
    }
    if (!hasStackSignal(input)) {
      missingItems.push('Target stack')
    }
  } else {
    if (!hasStackSignal(input)) {
      missingItems.push('Stack or language')
    }
    if (!hasStructureSignal(input)) {
      missingItems.push('Architecture or important paths')
    }
    if (!hasVerificationSignal(input)) {
      missingItems.push('Verification command or explanatory risk flag')
    }
  }

  return {
    status: missingItems.length === 0 ? 'ready' : 'incomplete',
    missingItems,
    riskFlags: unique(input.riskFlags ?? []),
    recommendedFirstActions: unique(input.recommendedFirstActions ?? [])
  }
}
