import { describe, expect, it } from 'vitest'
import { getNextReasoningLevelForModel } from './model-selection'

describe('getNextReasoningLevelForModel', () => {
  it('keeps the current reasoning level when the next model supports it', () => {
    expect(
      getNextReasoningLevelForModel(
        'high',
        {
          defaultReasoningLevel: 'medium',
          supportedReasoningLevels: ['low', 'medium', 'high']
        },
        true
      )
    ).toBe('high')
  })

  it('falls back to the model default when the current level is unsupported', () => {
    expect(
      getNextReasoningLevelForModel(
        'xhigh',
        {
          defaultReasoningLevel: 'medium',
          supportedReasoningLevels: ['low', 'medium', 'high']
        },
        true
      )
    ).toBe('medium')
  })

  it('clears reasoning level for non-reasoning models', () => {
    expect(
      getNextReasoningLevelForModel(
        'high',
        {
          defaultReasoningLevel: 'medium',
          supportedReasoningLevels: ['low', 'medium', 'high']
        },
        false
      )
    ).toBeUndefined()
  })
})
