import { describe, expect, it } from 'vitest'
import { buildAttemptLineageSummary } from './attempt-lineage'

describe('attempt lineage UI contract', () => {
  it('normalizes attempt counts for review and retry labels', () => {
    expect(buildAttemptLineageSummary()).toEqual({
      currentAttempt: 1,
      previousAttempts: 0,
      label: 'Attempt 1',
      staleRisk: false,
      detail: 'No retry lineage recorded yet.'
    })

    expect(buildAttemptLineageSummary(4)).toEqual({
      currentAttempt: 4,
      previousAttempts: 3,
      label: 'Attempt 4',
      staleRisk: true,
      detail: '3 earlier attempts may still influence downstream context.'
    })
  })
})
