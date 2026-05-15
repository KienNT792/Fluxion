import { describe, expect, it } from 'vitest'
import { FlowContextDocumentSchema } from '../schema/flow-context.schema'

describe('FlowContextDocumentSchema', () => {
  it('accepts a valid initial flow context document', () => {
    const parsed = FlowContextDocumentSchema.parse({
      schemaVersion: 1,
      flowContextId: 'run-1',
      runId: 'run-1',
      workflowId: 'workflow-1',
      version: 1,
      createdAt: '2026-05-15T00:00:00.000Z',
      updatedAt: '2026-05-15T00:00:00.000Z',
      latestSnapshot: {
        memorySourceRefs: [],
        artifactRefs: [],
        runStateRef: '.fluxion/runs/run-1.json',
        providerState: {},
        semanticSummary: ''
      },
      deltas: []
    })

    expect(parsed.version).toBe(1)
    expect(parsed.latestSnapshot.runStateRef).toBe('.fluxion/runs/run-1.json')
    expect(parsed.latestSnapshot.providerState).toEqual({})
  })

  it('rejects non-UTC timestamps and reverse timestamp ordering', () => {
    expect(() =>
      FlowContextDocumentSchema.parse({
        schemaVersion: 1,
        flowContextId: 'run-1',
        runId: 'run-1',
        workflowId: 'workflow-1',
        version: 1,
        createdAt: '2026-05-15 00:00:00',
        updatedAt: '2026-05-15T00:00:00.000Z',
        latestSnapshot: {
          memorySourceRefs: [],
          artifactRefs: [],
          runStateRef: '.fluxion/runs/run-1.json',
          providerState: {},
          semanticSummary: ''
        },
        deltas: []
      })
    ).toThrow()

    expect(() =>
      FlowContextDocumentSchema.parse({
        schemaVersion: 1,
        flowContextId: 'run-1',
        runId: 'run-1',
        workflowId: 'workflow-1',
        version: 1,
        createdAt: '2026-05-15T00:00:01.000Z',
        updatedAt: '2026-05-15T00:00:00.000Z',
        latestSnapshot: {
          memorySourceRefs: [],
          artifactRefs: [],
          runStateRef: '.fluxion/runs/run-1.json',
          providerState: {},
          semanticSummary: ''
        },
        deltas: []
      })
    ).toThrow()
  })

  it('rejects invalid versions and missing snapshot state', () => {
    expect(() =>
      FlowContextDocumentSchema.parse({
        schemaVersion: 1,
        flowContextId: 'run-1',
        runId: 'run-1',
        workflowId: 'workflow-1',
        version: 0,
        createdAt: '2026-05-15T00:00:00.000Z',
        updatedAt: '2026-05-15T00:00:00.000Z',
        latestSnapshot: {
          memorySourceRefs: [],
          artifactRefs: [],
          runStateRef: '.fluxion/runs/run-1.json',
          providerState: {},
          semanticSummary: ''
        },
        deltas: []
      })
    ).toThrow()

    expect(() =>
      FlowContextDocumentSchema.parse({
        schemaVersion: 1,
        flowContextId: 'run-1',
        runId: 'run-1',
        workflowId: 'workflow-1',
        version: 1,
        createdAt: '2026-05-15T00:00:00.000Z',
        updatedAt: '2026-05-15T00:00:00.000Z',
        latestSnapshot: {
          memorySourceRefs: [],
          artifactRefs: [],
          providerState: {},
          semanticSummary: ''
        },
        deltas: []
      })
    ).toThrow()
  })
})
