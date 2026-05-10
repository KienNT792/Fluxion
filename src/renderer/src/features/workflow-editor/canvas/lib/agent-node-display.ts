import type { AgentNodeData, NodeStatus } from '@shared'

export type AgentNodeVisualState = NodeStatus | 'selected'
export type AgentNodeTitleSource = 'label' | 'prompt' | 'model'

export interface AgentNodeStatusMeta {
  color: string
  label: string
  pulse: boolean
}

export const AGENT_NODE_STATUS_META: Record<NodeStatus, AgentNodeStatusMeta> = {
  idle: {
    color: 'var(--color-hairline-strong)',
    label: 'Idle',
    pulse: false
  },
  running: {
    color: 'var(--color-timeline-thinking)',
    label: 'Running',
    pulse: true
  },
  stopping: {
    color: 'var(--color-timeline-read)',
    label: 'Stopping',
    pulse: true
  },
  completed: {
    color: 'var(--color-timeline-grep)',
    label: 'Done',
    pulse: false
  },
  error: {
    color: 'var(--color-semantic-error)',
    label: 'Error',
    pulse: false
  },
  paused: {
    color: 'var(--color-timeline-edit)',
    label: 'Review',
    pulse: true
  }
}

export function getFirstPromptLine(prompt: unknown): string {
  if (typeof prompt !== 'string') {
    return ''
  }

  return prompt
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? ''
}

export function getAgentNodeTitle(data: Partial<AgentNodeData>, modelDisplayName: string): string {
  const label = typeof data.label === 'string' ? data.label.trim() : ''
  if (label) {
    return label
  }

  const promptLine = getFirstPromptLine(data.prompt)
  if (promptLine) {
    return promptLine
  }

  return modelDisplayName || String(data.model ?? 'Codex Agent')
}

export function getAgentNodeTitleSource(data: Partial<AgentNodeData>): AgentNodeTitleSource {
  const label = typeof data.label === 'string' ? data.label.trim() : ''
  if (label) {
    return 'label'
  }

  if (getFirstPromptLine(data.prompt)) {
    return 'prompt'
  }

  return 'model'
}

export function getAgentNodePromptPreview(
  prompt: unknown,
  options: { skipFirstMeaningfulLine?: boolean } = {}
): string {
  if (typeof prompt !== 'string') {
    return ''
  }

  const meaningfulLines = prompt
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  return meaningfulLines
    .slice(options.skipFirstMeaningfulLine ? 1 : 0, options.skipFirstMeaningfulLine ? 3 : 2)
    .slice(0, 2)
    .join('\n')
}

export function getAgentNodeVisualState(
  status: NodeStatus,
  isSelected: boolean
): AgentNodeVisualState {
  if (
    status === 'paused' ||
    status === 'error' ||
    status === 'running' ||
    status === 'stopping' ||
    status === 'completed'
  ) {
    return status
  }

  return isSelected ? 'selected' : 'idle'
}

export function getAgentNodeStatusMeta(status: NodeStatus): AgentNodeStatusMeta {
  return AGENT_NODE_STATUS_META[status] ?? AGENT_NODE_STATUS_META.idle
}
