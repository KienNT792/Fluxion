import { describe, expect, it } from 'vitest'
import { buildAttemptLineageSummary } from './attempt-lineage'

describe('attempt lineage', () => {
  it('normalizes attempt counts into compact lineage labels', () => {
    expect(buildAttemptLineageSummary()).toEqual({
      currentAttempt: 1,
      previousAttempts: 0,
      label: 'Attempt 1',
      staleRisk: false,
      detail: 'No retry lineage recorded yet.'
    })

    expect(buildAttemptLineageSummary(3)).toEqual({
      currentAttempt: 3,
      previousAttempts: 2,
      label: 'Attempt 3',
      staleRisk: true,
      detail: '2 earlier attempts may still influence downstream context.'
    })
  })
})
