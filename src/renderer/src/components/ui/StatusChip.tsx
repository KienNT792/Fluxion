import React from 'react'

export type StatusChipTone =
  | 'idle'
  | 'running'
  | 'completed'
  | 'error'
  | 'paused'
  | 'stopping'
  | 'warning'
  | 'success'

interface StatusChipProps {
  tone?: StatusChipTone
  label: string
  animate?: boolean
  className?: string
  title?: string
}

const TONE_COLORS: Record<StatusChipTone, string> = {
  idle: 'var(--color-muted)',
  running: 'var(--color-timeline-thinking)',
  completed: 'var(--color-status-completed)',
  error: 'var(--color-semantic-error)',
  paused: 'var(--color-timeline-edit)',
  stopping: 'var(--color-timeline-read)',
  warning: 'var(--color-timeline-done)',
  success: 'var(--color-semantic-success)'
}

export const StatusChip: React.FC<StatusChipProps> = ({
  tone = 'idle',
  label,
  animate = tone === 'running',
  className = '',
  title
}) => {
  const color = TONE_COLORS[tone]

  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}
      style={{
        color,
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline)',
        lineHeight: 1.4
      }}
      title={title ?? label}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${animate ? 'animate-pulse' : ''}`}
        style={{ background: color }}
      />
      <span className="truncate">{label}</span>
    </span>
  )
}
