import React from 'react'
import { RotateCcw } from 'lucide-react'
import type { CompiledContextDiagnostics, NodeId, NodeStatus } from '@shared'
import { retryWorkflowFromNode } from '@renderer/lib/workflow-session'
import { Button } from '@renderer/components/ui/Button'
import { FilePathCard } from '@renderer/components/ui/FilePathCard'
import { OutputPreview } from '@renderer/components/ui/OutputPreview'
import { StatusChip } from '@renderer/components/ui/StatusChip'
import type { WorkflowRuntimeStatus } from '@renderer/stores/execution.store'
import { InspectorSection as Section } from './InspectorSection'
import { LABEL_STYLE, READONLY_BLOCK_STYLE, READONLY_INLINE_STYLE } from '../lib/inspector-styles'
import { getNodeStatusLabel, NODE_STATUS_TONE } from '../lib/node-display'
import {
  buildRuntimePolicyLinesFromDiagnostics,
  buildRuntimePolicySummaryFromDiagnostics
} from '../lib/effective-policy'
import {
  deriveDurationMs,
  formatDurationMs,
  useRuntimeNow
} from '@renderer/features/runtime/lib/runtime-metrics'

interface RuntimeSectionProps {
  contextDiagnostics?: CompiledContextDiagnostics
  nodeAttemptCount?: number
  nodeError?: string
  nodeExitCode?: number | null
  nodeOutputPath?: string
  nodeRunMetrics?: {
    startedAt?: string
    completedAt?: string
    durationMs?: number
  }
  nodeStatus: NodeStatus
  onError: (error: string | null) => void
  selectedNodeId: NodeId
  showOutputPreviewForPaused?: boolean
  workflowStatus: WorkflowRuntimeStatus
  workspacePath: string | null
}

export const RuntimeSection: React.FC<RuntimeSectionProps> = ({
  contextDiagnostics,
  nodeAttemptCount,
  nodeError,
  nodeExitCode,
  nodeOutputPath,
  nodeRunMetrics,
  nodeStatus,
  onError,
  selectedNodeId,
  showOutputPreviewForPaused = false,
  workflowStatus,
  workspacePath
}) => {
  const nodeStatusLabel = getNodeStatusLabel(nodeStatus)
  const now = useRuntimeNow(nodeStatus === 'running')
  const durationLabel = formatDurationMs(
    deriveDurationMs({
      ...nodeRunMetrics,
      isRunning: nodeStatus === 'running',
      now
    })
  )
  const runtimePolicyLines = buildRuntimePolicyLinesFromDiagnostics(contextDiagnostics)
  const runtimePolicySummary = buildRuntimePolicySummaryFromDiagnostics(contextDiagnostics)

  return (
    <Section title="Output">
      <div>
        <label style={LABEL_STYLE}>Status</label>
        <StatusChip
          tone={NODE_STATUS_TONE[nodeStatus]}
          label={nodeStatusLabel}
          animate={nodeStatus === 'running' || nodeStatus === 'stopping'}
        />
      </div>

      <div>
        <label style={LABEL_STYLE}>Run Duration</label>
        <div style={READONLY_INLINE_STYLE}>{durationLabel ?? 'n/a'}</div>
      </div>

      <div>
        <label style={LABEL_STYLE}>Exit Code</label>
        <div style={READONLY_INLINE_STYLE}>{nodeExitCode ?? 'n/a'}</div>
      </div>

      <div>
        <label style={LABEL_STYLE}>Output File</label>
        <FilePathCard path={nodeOutputPath} onError={onError} />
      </div>

      <div>
        <label style={LABEL_STYLE}>Effective Runtime Policy</label>
        <div
          className="mb-2 rounded-md px-3 py-2 text-[11px] leading-5"
          style={{
            color: 'var(--color-body)',
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-hairline)'
          }}
        >
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--color-muted)' }}
          >
            Runtime summary
          </div>
          <div className="mt-1 text-xs font-medium" style={{ color: 'var(--color-ink)' }}>
            {runtimePolicySummary.headline}
          </div>
          <div className="mt-1 text-[10px]" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
            {runtimePolicySummary.detail}
          </div>
        </div>
        <div
          style={{
            ...READONLY_BLOCK_STYLE,
            minHeight: '124px',
            color: 'var(--color-body)',
            whiteSpace: 'pre-wrap'
          }}
        >
          {runtimePolicyLines.join('\n')}
        </div>
      </div>

      {(nodeStatus !== 'paused' || showOutputPreviewForPaused) && (
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
