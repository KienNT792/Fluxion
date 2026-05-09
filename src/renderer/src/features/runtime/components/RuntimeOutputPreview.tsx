import React from 'react'
import { FileOutput } from 'lucide-react'
import { useExecutionStore } from '@renderer/stores/execution.store'

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
  const hasOutputs = Object.values(nodeOutputPaths).some(Boolean)

  if (!hasOutputs) {
    return <OutputEmptyState />
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <div className="space-y-1.5">
        {Object.entries(nodeOutputPaths).map(([nodeId, outputPath]) => {
          if (!outputPath) return null
          return (
            <div
              key={nodeId}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
              style={{ background: 'var(--color-surface-card)' }}
            >
              <FileOutput size={12} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
              <span
                className="min-w-0 truncate text-[11px]"
                style={{ color: 'var(--color-body)', fontFamily: 'var(--font-mono)' }}
              >
                {outputPath}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
