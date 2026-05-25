import { describe, expect, it } from 'vitest'
import {
  GlobalMemoryFrontmatterSchema,
  NodeMemoryFrontmatterSchema
} from '../schema/memory-frontmatter.schema'

describe('memory frontmatter schemas', () => {
  it('accepts valid global context frontmatter', () => {
    const parsed = GlobalMemoryFrontmatterSchema.parse({
      type: 'global',
      version: '1.0',
      workspaceType: 'desktop-app',
      contextStatus: 'draft'
    })

    expect(parsed.type).toBe('global')
  })

  it('accepts completed V1 node output frontmatter', () => {
    const parsed = NodeMemoryFrontmatterSchema.parse({
      schemaVersion: '1.0',
      nodeId: 'node-a',
      provider: 'openai',
      model: 'gpt-4.1',
      status: 'completed',
      timestamp: 123
    })

    expect(parsed.schemaVersion).toBe('1.0')
  })

  it('accepts completed V2 node output frontmatter', () => {
    const parsed = NodeMemoryFrontmatterSchema.parse({
      schemaVersion: '2.0',
      nodeId: 'node-a',
      runId: 'run-1',
      runner: 'codex',
      model: 'gpt-5.5',
      status: 'completed',
      startedAt: '2026-05-06T00:00:00.000Z',
      completedAt: '2026-05-06T00:00:01.000Z',
      attempt: 1
    })

    expect(parsed.schemaVersion).toBe('2.0')
  })

  it('rejects node output frontmatter that is not safe for downstream context', () => {
    expect(() =>
      NodeMemoryFrontmatterSchema.parse({
        schemaVersion: '1.0',
        nodeId: 'node-a',
        provider: 'openai',
        model: 'gpt-4.1',
        status: 'aborted',
        timestamp: 123
      })
    ).toThrow()
  })
})
