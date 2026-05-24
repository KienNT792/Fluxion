import React from 'react'
import { Activity } from 'lucide-react'
import { useExecutionStore, WorkflowRuntimeStatus } from '@renderer/stores/execution.store'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { PULSE_STATUSES, STATUS_DOT_COLOR, STATUS_LABEL } from '../lib/runtime-status'
import { deriveDurationMs, formatDurationMs, useRuntimeNow } from '../lib/runtime-metrics'

function TimelineEmptyState(): React.JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-8">
      <div className="text-center">
        <Activity size={20} className="mx-auto mb-2" style={{ color: 'var(--color-muted-soft)' }} />
        <p className="text-xs" style={{ color: 'var(--color-muted)', lineHeight: '1.6' }}>
          No execution yet. Run workflow to see timeline.
        </p>
      </div>
    </div>
  )
}

export function ExecutionTimeline(): React.JSX.Element {
  const workflowStatus = useExecutionStore((state) => state.workflowStatus)
  const nodeStatuses = useExecutionStore((state) => state.nodeStatuses)
  const reviewNodeIds = useExecutionStore((state) => state.reviewNodeIds)
  const nodeRunMetrics = useExecutionStore((state) => state.nodeRunMetrics)
  const terminalNodeId = useWorkflowStore((state) => state.terminalNodeId)
  const nodes = useWorkflowStore((state) => state.nodes)
  const now = useRuntimeNow(
    Object.values(nodeStatuses).some((status) => status === 'running')
  )

  const hasAnyExecution =
    workflowStatus !== 'idle' || Object.values(nodeStatuses).some((status) => status !== 'idle')

  if (!hasAnyExecution) {
    return <TimelineEmptyState />
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <div className="space-y-1">
        {nodes.map((node) => {
          const status = nodeStatuses[node.id] ?? 'idle'
          const isReview = reviewNodeIds.includes(node.id)
          const isFollowed = terminalNodeId === node.id
          const label = (node.data.label as string) || node.id
          const metrics = nodeRunMetrics[node.id]
          const durationLabel = formatDurationMs(
            deriveDurationMs({
              ...metrics,
              isRunning: status === 'running',
              now
            })
          )
          const dotColor =
            STATUS_DOT_COLOR[status as WorkflowRuntimeStatus] ?? STATUS_DOT_COLOR.idle
          const shouldPulse = PULSE_STATUSES.has(status as WorkflowRuntimeStatus)

          return (
            <div
              key={node.id}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5"
              style={{
                background: isFollowed
                  ? 'var(--color-canvas-soft)'
                  : isReview
                    ? 'var(--color-surface-card)'
                    : 'transparent',
                border: isFollowed
                  ? '1px solid var(--color-hairline-strong)'
                  : '1px solid transparent'
              }}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${shouldPulse ? 'animate-pulse' : ''}`}
                style={{ background: dotColor }}
              />
              <span
                className="min-w-0 truncate text-xs"
                style={{
                  color: status === 'idle' ? 'var(--color-muted-soft)' : 'var(--color-body)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {label}
              </span>
              {isFollowed ? (
                <span
                  className="shrink-0 text-[9px] uppercase"
                  style={{
                    color: 'var(--color-primary)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.06em'
                  }}
                >
                  Active
                </span>
              ) : null}
              <span
                className="ml-auto shrink-0 text-[10px] uppercase"
                style={{
                  color: dotColor,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.05em'
                }}
              >
                {status === 'idle' ? '' : (STATUS_LABEL[status as WorkflowRuntimeStatus] ?? status)}
              </span>
              {durationLabel ? (
                <span
                  className="shrink-0 text-[10px]"
                  style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  {durationLabel}
                </span>
              ) : null}
              {isReview ? (
                <span
                  className="shrink-0 text-[9px] uppercase"
                  style={{
                    color: 'var(--color-timeline-edit)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.06em'
                  }}
                >
                  Review
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
