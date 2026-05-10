import { describe, expect, it } from 'vitest'
import { getDefaultNodeInspectorTab } from './inspector-tabs'

describe('getDefaultNodeInspectorTab', () => {
  it('opens output for runtime attention states', () => {
    expect(getDefaultNodeInspectorTab('paused', 'ok')).toBe('output')
    expect(getDefaultNodeInspectorTab('error', 'ok')).toBe('output')
  })

  it('opens permissions for guardrail attention states', () => {
    expect(getDefaultNodeInspectorTab('idle', 'warning')).toBe('permissions')
    expect(getDefaultNodeInspectorTab('completed', 'blocked')).toBe('permissions')
  })

  it('opens prompt for normal node editing', () => {
    expect(getDefaultNodeInspectorTab('idle', 'ok')).toBe('prompt')
  })
})
