import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import type { WorkflowNode } from '@shared'
import { getNextDefaultNodeLabel } from './workflow-node-labels'

function createNode(id: string, label?: string): Node<WorkflowNode['data']> {
  return {
    id,
    position: { x: 0, y: 0 },
    type: 'agentNode',
    data: {
      provider: 'codex',
      model: 'gpt-5.5',
      label,
      prompt: ''
    }
  }
}

describe('getNextDefaultNodeLabel', () => {
  it('starts at Node 1 for an empty workflow', () => {
    expect(getNextDefaultNodeLabel([])).toBe('Node 1')
  })

  it('continues from existing default node labels', () => {
    expect(getNextDefaultNodeLabel([createNode('a', 'Node 1'), createNode('b', 'Node 2')])).toBe(
      'Node 3'
    )
  })

  it('uses node count as a fallback when labels are custom', () => {
    expect(getNextDefaultNodeLabel([createNode('a', 'Review diff'), createNode('b')])).toBe(
      'Node 3'
    )
  })
})
