import { describe, expect, it } from 'vitest'
import {
  MemoryIndexEntrySchema,
  MemoryIndexSchema,
  RawOutputMemoryIndexEntrySchema,
  SummaryMemoryIndexEntrySchema
} from '../schema/memory-index.schema'

describe('MemoryIndexSchema', () => {
  it('accepts a valid raw_output memory index entry', () => {
    const parsed = RawOutputMemoryIndexEntrySchema.parse({
      id: 'raw_output:workflow-1:run-1:node-a:1',
      type: 'raw_output',
      workflowId: 'workflow-1',
      runId: 'run-1',
      nodeId: 'node-a',
      sourcePath: '.fluxion/memory/short-term/workflow-1/.history/run-1/node-a/attempt-1.md',
      latestSourcePath: '.fluxion/memory/short-term/workflow-1/node-a.md',
      createdAt: '2026-05-15T00:00:00.000Z',
      attempt: 1
    })

    expect(parsed.sourcePath).toBe(
      '.fluxion/memory/short-term/workflow-1/.history/run-1/node-a/attempt-1.md'
    )
    expect(parsed.latestSourcePath).toBe('.fluxion/memory/short-term/workflow-1/node-a.md')
  })

  it('normalizes Windows separators in memory index paths', () => {
    const parsed = MemoryIndexEntrySchema.parse({
      id: 'raw_output:workflow-1:run-1:node-a:0',
      type: 'raw_output',
      workflowId: 'workflow-1',
      runId: 'run-1',
      nodeId: 'node-a',
      sourcePath: '.fluxion\\memory\\short-term\\workflow-1\\node-a.md',
      createdAt: '2026-05-15T00:00:00.000Z'
    })

    expect(parsed.sourcePath).toBe('.fluxion/memory/short-term/workflow-1/node-a.md')
  })

  it('accepts a summary memory index entry with replaced paths', () => {
    const parsed = SummaryMemoryIndexEntrySchema.parse({
      id: 'summary:workflow-1:run-1:2026-05-15T00:00:00.000Z',
      type: 'summary',
      workflowId: 'workflow-1',
      runId: 'run-1',
      sourcePath: '.fluxion/memory/long-term/workflow-1/run-1-summary.md',
      createdAt: '2026-05-15T00:00:00.000Z',
      sourceNodeIds: ['node-a', 'node-b'],
      replacedPaths: ['.fluxion/memory/short-term/workflow-1/node-a.md']
    })

    expect(parsed.replacedPaths).toEqual(['.fluxion/memory/short-term/workflow-1/node-a.md'])
  })

  it('rejects absolute source paths', () => {
    expect(() =>
      MemoryIndexEntrySchema.parse({
        id: 'raw_output:workflow-1:run-1:node-a:0',
        type: 'raw_output',
        workflowId: 'workflow-1',
        runId: 'run-1',
        nodeId: 'node-a',
        sourcePath: 'C:\\temp\\node-a.md',
        createdAt: '2026-05-15T00:00:00.000Z'
      })
    ).toThrow()
  })

  it('rejects parent directory traversal in source paths', () => {
    expect(() =>
      MemoryIndexSchema.parse({
        schemaVersion: 1,
        entries: [
          {
            id: 'raw_output:workflow-1:run-1:node-a:0',
            type: 'raw_output',
            workflowId: 'workflow-1',
            runId: 'run-1',
            nodeId: 'node-a',
            sourcePath: '../secret.md',
            createdAt: '2026-05-15T00:00:00.000Z'
          }
        ]
      })
    ).toThrow()
  })
})
