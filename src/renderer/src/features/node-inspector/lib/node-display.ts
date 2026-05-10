import { AgentNodeData, NodeStatus, ReasoningLevel } from '@shared'
import type { StatusChipTone } from '@renderer/components/ui/StatusChip'

export interface TextSummary {
  preview: string
  lineCount: number
  characterCount: number
  isEmpty: boolean
}

export interface ModelOption {
  id: string
  label: string
  description?: string
}

export const REASONING_LEVEL_LABELS: Record<ReasoningLevel, { label: string; hint: string }> = {
  low: { label: 'Low', hint: 'Fast' },
  medium: { label: 'Med', hint: 'Balanced' },
  high: { label: 'High', hint: 'Deep' },
  xhigh: { label: 'XHigh', hint: 'Max' }
}

export const NODE_STATUS_TONE: Record<NodeStatus, StatusChipTone> = {
  idle: 'idle',
  running: 'running',
  stopping: 'stopping',
  completed: 'completed',
  error: 'error',
  paused: 'paused'
}

export function getNodeStatusLabel(status: NodeStatus): string {
  if (status === 'completed') {
    return 'Done'
  }

  if (status === 'paused') {
    return 'Review'
  }

  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function buildModelOptions(
  models: AgentNodeData['model'],
  options: ModelOption[]
): ModelOption[] {
  if (!models || options.some((option) => option.id === models)) {
    return options
  }

  return [
    ...options,
    {
      id: models,
      label: `Legacy / Custom (${models})`,
      description: 'Persisted from an older workflow or custom model slug.'
    }
  ]
}

export function summarizeLongText(value: string | undefined, emptyLabel: string): TextSummary {
  const text = value ?? ''
  const trimmed = text.trim()
  const lines = text ? text.split(/\r\n|\r|\n/) : []
  const previewLines = lines.slice(0, 5).join('\n').trim()
  const isClipped = lines.length > 5 || previewLines.length < trimmed.length

  return {
    preview: trimmed ? `${previewLines}${isClipped ? '\n...' : ''}` : emptyLabel,
    lineCount: trimmed ? lines.length : 0,
    characterCount: text.length,
    isEmpty: !trimmed
  }
}
