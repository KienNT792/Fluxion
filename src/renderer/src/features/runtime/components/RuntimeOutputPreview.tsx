import React from 'react'
import { FileOutput } from 'lucide-react'
import { OutputPreview } from '@renderer/components/ui/OutputPreview'
import { useExecutionStore } from '@renderer/stores/execution.store'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { buildAttemptLineageSummary } from '../lib/attempt-lineage'

function OutputEmptyState(): React.JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-8">
      <div className="text-center">
        <FileOutput
          size={20}
          className="mx-auto mb-2"
          style={{ color: 'var(--color-muted-soft)' }}
        />
        <p className="text-xs" style={{ color: 'var(--color-muted)', lineHeight: '1.6' }}>
          No output selected yet.
        </p>
      </div>
    </div>
  )
}

export function RuntimeOutputPreview(): React.JSX.Element {
  const nodeOutputPaths = useExecutionStore((state) => state.nodeOutputPaths)
  const nodeAttemptCounts = useExecutionStore((state) => state.nodeAttemptCounts)
  const nodeStatuses = useExecutionStore((state) => state.nodeStatuses)
  const workflowError = useExecutionStore((state) => state.workflowError)
  const setWorkflowError = useExecutionStore((state) => state.setWorkflowError)
  const workspacePath = useWorkflowStore((state) => state.workspacePath)
  const hasOutputs = Object.values(nodeOutputPaths).some(Boolean)

  if (!hasOutputs) {
    return <OutputEmptyState />
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <div className="space-y-3">
        {Object.entries(nodeOutputPaths).map(([nodeId, outputPath]) => {
          if (!outputPath) return null
          const attemptCount = nodeAttemptCounts[nodeId]
          const nodeStatus = nodeStatuses[nodeId]
          const attemptLineage = buildAttemptLineageSummary(attemptCount)
          return (
            <section
              key={nodeId}
              className="overflow-hidden rounded-md"
              style={{
                background: 'var(--color-surface-card)',
                border: '1px solid var(--color-hairline)'
              }}
            >
              <div
                className="flex items-center gap-2 px-2.5 py-1.5"
                style={{ borderBottom: '1px solid var(--color-hairline-soft)' }}
              >
                <FileOutput size={12} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
                <span
                  className="min-w-0 truncate text-[11px]"
                  style={{ color: 'var(--color-body)', fontFamily: 'var(--font-mono)' }}
                  title={outputPath}
                >
                  {outputPath}
                </span>
                <span
                  className="ml-auto shrink-0 text-[10px] uppercase"
                  style={{
                    color: nodeStatus === 'paused' ? 'var(--color-timeline-edit)' : 'var(--color-muted)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.05em'
                  }}
                >
                  {nodeStatus === 'paused'
                    ? 'Review'
                    : attemptLineage.currentAttempt > 1
                      ? attemptLineage.label
                      : 'Latest'}
                </span>
              </div>

              <div className="px-2.5 py-2">
                <OutputPreview
                  workspacePath={workspacePath}
                  path={outputPath}
                  attemptCount={attemptCount}
                  onError={(message) => {
                    if (workflowError !== message) {
                      setWorkflowError(message)
                    }
                  }}
                />
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
