import { describe, expect, it } from 'vitest'
import { RunnerRegistry } from '../runner/runner.registry'

describe('RunnerRegistry', () => {
  it('resolves the Codex contract runner by default', () => {
    const registry = new RunnerRegistry()
    expect(registry.resolve('codex').id).toBe('codex')
  })

  it('allows custom as a declared extension point', () => {
    const registry = new RunnerRegistry()
    expect(registry.resolve('custom').id).toBe('custom')
  })

  it('throws a clear error for unknown runners', () => {
    const registry = new RunnerRegistry()
    expect(() => registry.resolve('gemini')).toThrow('Runner "gemini" is not registered.')
  })
})
