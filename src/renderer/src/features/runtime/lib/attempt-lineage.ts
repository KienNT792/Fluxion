export interface AttemptLineageSummary {
  currentAttempt: number
  previousAttempts: number
  label: string
  staleRisk: boolean
  detail: string
}

export function buildAttemptLineageSummary(attemptCount?: number): AttemptLineageSummary {
  const currentAttempt = Math.max(1, Math.floor(attemptCount ?? 1))
  const previousAttempts = Math.max(0, currentAttempt - 1)
  return {
    currentAttempt,
    previousAttempts,
    label: `Attempt ${currentAttempt}`,
    staleRisk: previousAttempts > 0,
    detail:
      previousAttempts > 0
        ? `${previousAttempts} earlier attempt${previousAttempts === 1 ? '' : 's'} may still influence downstream context.`
        : 'No retry lineage recorded yet.'
  }
}
