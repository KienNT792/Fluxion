import { describe, expect, it } from 'vitest'
import { getModelIconSignature } from './model-icon-badge.helpers'

describe('getModelIconSignature', () => {
  it('creates compact GPT model signatures', () => {
    expect(getModelIconSignature('gpt-5.5', 'GPT-5.5').label).toBe('5.5')
    expect(getModelIconSignature('gpt-5.4-mini', 'GPT-5.4 Mini').label).toBe('5.4m')
    expect(getModelIconSignature('gpt-5.3-codex', 'GPT-5.3 Codex').label).toBe('5.3C')
  })

  it('creates compact Codex and o-series signatures', () => {
    expect(getModelIconSignature('codex-1', 'Codex 1').label).toBe('C1')
    expect(getModelIconSignature('o4-mini', 'o4-mini').label).toBe('o4m')
  })

  it('falls back for custom model slugs', () => {
    expect(getModelIconSignature('custom-model', 'Custom model').label).toBe('CUS')
  })
})
