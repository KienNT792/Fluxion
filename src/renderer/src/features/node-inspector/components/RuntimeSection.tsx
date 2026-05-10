import React from 'react'
import { RotateCcw } from 'lucide-react'
import type { NodeId, NodeStatus } from '@shared'
import { retryWorkflowFromNode } from '@renderer/lib/workflow-session'
import { Button } from '@renderer/components/ui/Button'
import { FilePathCard } from '@renderer/components/ui/FilePathCard'
import { OutputPreview } from '@renderer/components/ui/OutputPreview'
import { StatusChip } from '@renderer/components/ui/StatusChip'
import type { WorkflowRuntimeStatus } from '@renderer/stores/execution.store'
import { InspectorSection as Section } from './InspectorSection'
import { LABEL_STYLE, READONLY_BLOCK_STYLE, READONLY_INLINE_STYLE } from '../lib/inspector-styles'
import { NODE_STATUS_TONE } from '../lib/node-display'

interface RuntimeSectionProps {
  nodeAttemptCount?: number
  nodeError?: string
  nodeExitCode?: number | null
  nodeOutputPath?: string
  nodeStatus: NodeStatus
  onError: (error: string | null) => void
  selectedNodeId: NodeId
  workflowStatus: WorkflowRuntimeStatus
  workspacePath: string | null
}

export const RuntimeSection: React.FC<RuntimeSectionProps> = ({
  nodeAttemptCount,
  nodeError,
  nodeExitCode,
  nodeOutputPath,
  nodeStatus,
  onError,
  selectedNodeId,
  workflowStatus,
  workspacePath
}) => {
  const nodeStatusLabel =
    nodeStatus === 'completed' ? 'Done' : nodeStatus.charAt(0).toUpperCase() + nodeStatus.slice(1)

  return (
    <Section title="Runtime">
      <div>
        <label style={LABEL_STYLE}>Status</label>
        <StatusChip
          tone={NODE_STATUS_TONE[nodeStatus]}
          label={nodeStatusLabel}
          animate={nodeStatus === 'running' || nodeStatus === 'stopping'}
        />
      </div>

      <div>
        <label style={LABEL_STYLE}>Exit Code</label>
        <div style={READONLY_INLINE_STYLE}>{nodeExitCode ?? 'n/a'}</div>
      </div>

      <div>
        <label style={LABEL_STYLE}>Output File</label>
        <FilePathCard path={nodeOutputPath} onError={onError} />
      </div>

      {nodeStatus !== 'paused' && (
        <div>
          <label style={LABEL_STYLE}>Output Preview</label>
          <OutputPreview
            workspacePath={workspacePath}
            path={nodeOutputPath}
            attemptCount={nodeAttemptCount}
            onError={onError}
          />
        </div>
      )}

      <div>
        <label style={LABEL_STYLE}>Last Error</label>
        <div
          style={{
            ...READONLY_BLOCK_STYLE,
            minHeight: '64px',
            color: nodeError ? 'var(--color-semantic-error)' : 'var(--color-muted)',
            whiteSpace: 'pre-wrap'
          }}
          title={nodeError || 'No error'}
        >
          {nodeError || 'No error'}
        </div>
      </div>

      {nodeStatus === 'error' && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => retryWorkflowFromNode(selectedNodeId)}
          disabled={
            workflowStatus === 'running' ||
            workflowStatus === 'stopping' ||
            workflowStatus === 'paused'
          }
          className="w-full"
          title={nodeError || 'Retry this node and its downstream subtree'}
        >
          <RotateCcw size={13} />
          Retry From This Node
        </Button>
      )}
    </Section>
  )
}
