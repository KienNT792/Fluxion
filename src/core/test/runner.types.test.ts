import { describe, expectTypeOf, it } from 'vitest'
import { RunnerEvent } from '../runner/runner.types'

describe('RunnerEvent', () => {
  it('supports Codex JSON event payloads at the type level', () => {
    expectTypeOf<RunnerEvent>().toMatchTypeOf<
      | { type: 'stdout'; content: string; timestamp: number }
      | { type: 'stderr'; content: string; timestamp: number }
      | { type: 'status'; content: string; timestamp: number }
      | { type: 'json-event'; event: unknown; raw: string; timestamp: number }
      | {
          type: 'process-started'
          pid?: number
          displayCommand: string
          startedAt: string
          timestamp: number
        }
    >()
  })
})
