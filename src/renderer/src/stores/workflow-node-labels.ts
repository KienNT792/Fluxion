import type { Node } from '@xyflow/react'
import type { WorkflowNode } from '@shared'

const DEFAULT_NODE_LABEL_PATTERN = /^node\s+(\d+)$/i

export function getNextDefaultNodeLabel(nodes: Node<WorkflowNode['data']>[]): string {
  const maxExistingIndex = nodes.reduce((maxIndex, node, index) => {
    const label = typeof node.data.label === 'string' ? node.data.label.trim() : ''
    const match = DEFAULT_NODE_LABEL_PATTERN.exec(label)
    const labelIndex = match ? Number(match[1]) : index + 1

    return Number.isFinite(labelIndex) ? Math.max(maxIndex, labelIndex) : maxIndex
  }, 0)

  return `Node ${maxExistingIndex + 1}`
}
