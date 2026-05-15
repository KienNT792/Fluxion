import { describe, expect, it } from 'vitest'
import {
  ContextCommitResultSchema,
  ContextDeltaSchema,
  ContextSnapshotSchema,
  FlowContextDocumentSchema
} from '../schema/flow-context.schema'

function createValidContextDelta(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    flowContextId: 'run-1',
    runId: 'run-1',
    workflowId: 'workflow-1',
    nodeId: 'node-a',
    attempt: 1,
    createdAt: '2026-05-15T00:01:00.000Z',
    idempotencyKey: 'run-1:node-a:1',
    memoryRefsAdded: [
      {
        kind: 'node_output',
        path: '.fluxion/memory/short-term/node-a.md',
        nodeId: 'node-a',
        attempt: 1,
        hash: 'sha256:memory-a'
      }
    ],
    artifactRefsAddedOrValidated: [
      {
        kind: 'node_output',
        path: 'docs/node-a.md',
        nodeId: 'node-a',
        attempt: 1,
        validated: true,
        hash: 'sha256:artifact-a'
      }
    ],
    runStateUpdates: {
      runStateRef: '.fluxion/runs/run-1.json',
      nodeId: 'node-a',
      status: 'completed',
      outputArtifactPaths: ['docs/node-a.md']
    },
    providerStateUpdates: {
      codex: {
        runnerSessionId: 'session-1'
      }
    },
    semanticSummaryUpdate: 'Node A produced docs/node-a.md.',
    redaction: {
      policy: 'none',
      redactedFields: []
    }
  }
}

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

describe('ContextSnapshotSchema', () => {
  it('accepts a valid context snapshot', () => {
    const parsed = ContextSnapshotSchema.parse({
      schemaVersion: 1,
      flowContextId: 'run-1',
      runId: 'run-1',
      workflowId: 'workflow-1',
      version: 1,
      createdAt: '2026-05-15T00:01:00.000Z',
      memorySourceRefs: [
        {
          kind: 'memory',
          path: '.fluxion/memory/global-context.md',
          label: 'Global context',
          hash: 'sha256:memory'
        }
      ],
      artifactRefs: [
        {
          kind: 'node_output',
          path: 'docs/node-a.md',
          nodeId: 'node-a',
          attempt: 1,
          validated: true,
          hash: 'sha256:artifact'
        }
      ],
      runStateRef: '.fluxion/runs/run-1.json',
      providerState: {
        codex: {
          runnerSessionId: 'session-1'
        },
        openai: {
          responseId: 'resp_1',
          usage: {
            inputTokens: 100,
            outputTokens: 25
          }
        }
      },
      semanticSummary: 'Node A has completed.',
      hash: 'sha256:snapshot'
    })

    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.memorySourceRefs[0]?.path).toBe('.fluxion/memory/global-context.md')
    expect(parsed.artifactRefs[0]?.path).toBe('docs/node-a.md')
    expect(parsed.hash).toBe('sha256:snapshot')
  })
})

describe('ContextDeltaSchema', () => {
  it('accepts a valid additive context delta', () => {
    const parsed = ContextDeltaSchema.parse(createValidContextDelta())

    expect(parsed.nodeId).toBe('node-a')
    expect(parsed.attempt).toBe(1)
    expect(parsed.memoryRefsAdded).toHaveLength(1)
    expect(parsed.artifactRefsAddedOrValidated[0]?.validated).toBe(true)
  })

  it('rejects deltas missing required execution identity fields', () => {
    for (const field of ['nodeId', 'attempt', 'createdAt', 'idempotencyKey']) {
      const delta = createValidContextDelta()
      delete delta[field]

      expect(() => ContextDeltaSchema.parse(delta)).toThrow()
    }
  })

  it('rejects deltas with attempts below one', () => {
    expect(() =>
      ContextDeltaSchema.parse({
        ...createValidContextDelta(),
        attempt: 0
      })
    ).toThrow()
  })

  it('rejects raw secret-like fields in provider and run-state update payloads', () => {
    expect(() =>
      ContextDeltaSchema.parse({
        ...createValidContextDelta(),
        providerStateUpdates: {
          openai: {
            apiKey: 'sk-raw-secret'
          }
        }
      })
    ).toThrow()

    expect(() =>
      ContextDeltaSchema.parse({
        ...createValidContextDelta(),
        runStateUpdates: {
          authorization: 'Bearer raw-secret'
        }
      })
    ).toThrow()
  })

  it('rejects non-string safe reference fields in guarded payloads', () => {
    expect(() =>
      ContextDeltaSchema.parse({
        ...createValidContextDelta(),
        providerStateUpdates: {
          openai: {
            secretRef: {
              path: 'secret://openai/api-key'
            }
          }
        }
      })
    ).toThrow()
  })

  it('accepts redaction metadata and safe secret reference fields', () => {
    const parsed = ContextDeltaSchema.parse({
      ...createValidContextDelta(),
      providerStateUpdates: {
        openai: {
          responseId: 'resp_1',
          secretRef: 'secret://openai/api-key',
          redactedRef: 'redacted://provider/openai/api-key',
          envVar: 'OPENAI_API_KEY'
        }
      },
      redaction: {
        policy: 'secret-reference',
        redactedAt: '2026-05-15T00:01:01.000Z',
        redactedFields: [
          {
            path: 'providerState.openai.apiKey',
            reason: 'secret-like field replaced with a reference',
            secretRef: 'secret://openai/api-key',
            redactedRef: 'redacted://provider/openai/api-key',
            envVar: 'OPENAI_API_KEY'
          }
        ]
      }
    })

    expect(parsed.providerStateUpdates.openai).toMatchObject({
      secretRef: 'secret://openai/api-key',
      redactedRef: 'redacted://provider/openai/api-key',
      envVar: 'OPENAI_API_KEY'
    })
    expect(parsed.redaction.redactedFields[0]?.secretRef).toBe('secret://openai/api-key')
  })

  it('accepts conflict marker metadata', () => {
    const parsed = ContextDeltaSchema.parse({
      ...createValidContextDelta(),
      conflictMarkers: [
        {
          kind: 'provider_state',
          path: 'providerState.openai.responseId',
          reason: 'parallel provider-state update',
          existingRef: 'response:old',
          incomingRef: 'response:new'
        }
      ]
    })

    expect(parsed.conflictMarkers?.[0]).toMatchObject({
      kind: 'provider_state',
      path: 'providerState.openai.responseId'
    })
  })
})

describe('ContextCommitResultSchema', () => {
  it('accepts a valid context commit result', () => {
    const parsed = ContextCommitResultSchema.parse({
      schemaVersion: 1,
      flowContextId: 'run-1',
      version: 2,
      committed: true,
      commitState: 'completed',
      deltaIdempotencyKey: 'run-1:node-a:1'
    })

    expect(parsed.committed).toBe(true)
    expect(parsed.version).toBe(2)
  })
})
