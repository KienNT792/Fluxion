import { describe, expect, it } from 'vitest'
import { deriveDurationMs, formatDurationMs } from './runtime-metrics'

describe('runtime metrics', () => {
  it('formats duration in mm:ss', () => {
    expect(formatDurationMs(65000)).toBe('01:05')
  })

  it('derives duration from timestamps when explicit duration is missing', () => {
    expect(
      deriveDurationMs({
        startedAt: '2026-05-24T08:00:00.000Z',
        completedAt: '2026-05-24T08:00:05.500Z'
      })
    ).toBe(5500)
  })
})
