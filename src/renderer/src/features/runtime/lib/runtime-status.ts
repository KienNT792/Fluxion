import type { WorkflowRuntimeStatus } from '@renderer/stores/execution.store'

export type DockTab = 'timeline' | 'logs' | 'output'

export const STATUS_LABEL: Record<WorkflowRuntimeStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  stopping: 'Stopping',
  paused: 'Paused',
  aborted: 'Aborted',
  completed: 'Completed',
  error: 'Error'
}

export const STATUS_DOT_COLOR: Record<WorkflowRuntimeStatus, string> = {
  idle: 'var(--color-hairline-strong)',
  running: 'var(--color-timeline-thinking)',
  stopping: 'var(--color-timeline-read)',
  paused: 'var(--color-timeline-edit)',
  aborted: 'var(--color-muted)',
  completed: 'var(--color-timeline-grep)',
  error: 'var(--color-semantic-error)'
}

export const STATUS_DOT: Record<string, { color: string; pulse: boolean }> = {
  running: { color: 'var(--color-timeline-thinking)', pulse: true },
  completed: { color: 'var(--color-timeline-grep)', pulse: false },
  error: { color: 'var(--color-semantic-error)', pulse: false },
  stopping: { color: 'var(--color-timeline-read)', pulse: false },
  paused: { color: 'var(--color-timeline-edit)', pulse: false },
  idle: { color: 'var(--color-hairline-strong)', pulse: false }
}

export const PULSE_STATUSES = new Set<WorkflowRuntimeStatus>(['running', 'stopping'])

export function getDisplayName(
  label: string | undefined,
  model: string | undefined,
  fallback: string
): string {
  return label || model || fallback
}

export function pickAutoFollowNodeId(
  terminalNodeId: string | null,
  nodeStatuses: Record<string, string>
): string | null {
  if (terminalNodeId && nodeStatuses[terminalNodeId] === 'running') {
    return terminalNodeId
  }

  const runningNodeId = Object.entries(nodeStatuses).find(([, status]) => status === 'running')?.[0]
  return runningNodeId ?? terminalNodeId
}
