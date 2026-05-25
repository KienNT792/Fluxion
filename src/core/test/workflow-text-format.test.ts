import { describe, expect, it } from 'vitest'
import {
  FLUXION_WORKFLOW_TEXT_SCHEMA,
  parseWorkflowTextExport,
  renderWorkflowTextExport,
  sortWorkflowForExport,
  workflowTextUnsupportedFields
} from '../workflow-text-format'

function createWorkflowFixture() {
  return {
    id: 'workflow-1',
    name: 'Workflow 1',
    executionMode: 'auto' as const,
    nodes: [
      {
        id: 'node-b',
        type: 'agentNode',
        label: 'B',
        data: {
          provider: 'codex',
          model: 'gpt-5.5',
          runner: 'codex' as const,
          codex: {
            json: true,
            sandboxMode: 'workspace-write' as const,
            approvalPolicy: 'on-request' as const
          },
          prompt: 'B',
          requires: [],
          produces: [],
          humanReview: false
        },
        position: { x: 1, y: 0 }
      },
      {
        id: 'node-a',
        type: 'agentNode',
        label: 'A',
        data: {
          provider: 'codex',
          model: 'gpt-5.5',
          runner: 'codex' as const,
          codex: {
            json: true,
            sandboxMode: 'workspace-write' as const,
            approvalPolicy: 'on-request' as const
          },
          prompt: 'A',
          requires: [],
          produces: [],
          humanReview: false
        },
        position: { x: 0, y: 0 }
      }
    ],
    edges: [
      { id: 'edge-b', source: 'node-b', target: 'node-a' },
      { id: 'edge-a', source: 'node-a', target: 'node-b' }
    ]
  }
}

describe('workflow text format', () => {
  it('sorts and serializes workflow text canonically', () => {
    const workflow = createWorkflowFixture()

    const sorted = sortWorkflowForExport(workflow)
    expect(sorted.nodes.map((node) => node.id)).toEqual(['node-a', 'node-b'])
    expect(sorted.edges.map((edge) => edge.id)).toEqual(['edge-a', 'edge-b'])

    const exported = renderWorkflowTextExport(workflow)
    expect(exported).toContain('format: fluxion-workflow')
    expect(exported).toContain(`schema: '${FLUXION_WORKFLOW_TEXT_SCHEMA}'`)
    expect(exported).toContain('"id": "node-a"')
    expect(exported).toContain('"id": "node-b"')
  })

  it('round-trips embedded workflow payloads and documents unsupported field policy', () => {
    const exported = [
      '---',
      'format: fluxion-workflow',
      "schema: '1.0'",
      'workflowId: workflow-1',
      'name: Workflow 1',
      'executionMode: auto',
      "fluxionVersion: '1.0'",
      "generatedAt: '2026-05-24T00:00:00.000Z'",
      '---',
      JSON.stringify(
        {
          id: 'workflow-1',
          name: 'Workflow 1',
          executionMode: 'auto',
          nodes: [],
          edges: [],
          fluxionVersion: '1.0'
        },
        null,
        2
      )
    ].join('\n')

    const parsed = parseWorkflowTextExport(exported)
    expect(parsed.id).toBe('workflow-1')
    expect(parsed.name).toBe('Workflow 1')
    expect(workflowTextUnsupportedFields).toContain(
      'custom node data fields that are not part of the persisted workflow contract'
    )
  })
})
