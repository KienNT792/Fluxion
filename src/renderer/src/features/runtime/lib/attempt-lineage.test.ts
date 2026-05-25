import { describe, expect, it } from 'vitest'
import { buildAttemptLineageSummary } from './attempt-lineage'

describe('attempt lineage', () => {
  it('normalizes attempt counts into compact lineage labels', () => {
    expect(buildAttemptLineageSummary()).toEqual({
      currentAttempt: 1,
      previousAttempts: 0,
      label: 'Attempt 1'
    })

    expect(buildAttemptLineageSummary(3)).toEqual({
      currentAttempt: 3,
      previousAttempts: 2,
      label: 'Attempt 3'
    })
  })
})
