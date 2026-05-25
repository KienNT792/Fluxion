export interface AttemptLineageSummary {
  currentAttempt: number
  previousAttempts: number
  label: string
}

export function buildAttemptLineageSummary(attemptCount?: number): AttemptLineageSummary {
  const currentAttempt = Math.max(1, Math.floor(attemptCount ?? 1))
  return {
    currentAttempt,
    previousAttempts: Math.max(0, currentAttempt - 1),
    label: `Attempt ${currentAttempt}`
  }
}
