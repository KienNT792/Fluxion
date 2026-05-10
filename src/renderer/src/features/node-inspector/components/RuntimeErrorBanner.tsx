import React from 'react'
import { RotateCcw } from 'lucide-react'
import type { NodeId } from '@shared'
import { Button } from '@renderer/components/ui/Button'
import { retryWorkflowFromNode } from '@renderer/lib/workflow-session'
import type { WorkflowRuntimeStatus } from '@renderer/stores/execution.store'

interface RuntimeErrorBannerProps {
  nodeError?: string
  selectedNodeId: NodeId
  workflowStatus: WorkflowRuntimeStatus
}

export const RuntimeErrorBanner: React.FC<RuntimeErrorBannerProps> = ({
  nodeError,
  selectedNodeId,
  workflowStatus
}) => {
  const canRetry =
    workflowStatus !== 'running' && workflowStatus !== 'stopping' && workflowStatus !== 'paused'

  return (
    <div
      className="flex-shrink-0 px-4 py-3"
      style={{
        background: 'var(--color-canvas-soft)',
        borderBottom: '1px solid var(--color-hairline)'
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold" style={{ color: 'var(--color-semantic-error)' }}>
            Node failed
          </p>
          <p
            className="mt-1 line-clamp-2 text-[11px] leading-4"
            style={{ color: 'var(--color-body)', fontFamily: 'var(--font-mono)' }}
            title={nodeError || 'No error detail available'}
          >
            {nodeError || 'No error detail available'}
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => retryWorkflowFromNode(selectedNodeId)}
          disabled={!canRetry}
          title={nodeError || 'Retry this node and its downstream subtree'}
        >
          <RotateCcw size={13} />
          Retry
        </Button>
      </div>
    </div>
  )
}
