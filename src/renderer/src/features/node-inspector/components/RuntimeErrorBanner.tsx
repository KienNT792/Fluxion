import React from 'react'
import { ExternalLink, RotateCcw } from 'lucide-react'
import type { NodeId } from '@shared'
import { Button } from '@renderer/components/ui/Button'
import { compactWorkflowContextForNode, retryWorkflowFromNode } from '@renderer/lib/workflow-session'
import type { WorkflowRuntimeStatus } from '@renderer/stores/execution.store'
import { buildAttemptLineageSummary } from '@renderer/features/runtime/lib/attempt-lineage'
import { useExecutionStore } from '@renderer/stores/execution.store'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { buildNodeTerminalLaunchPayload } from '@renderer/features/runtime/lib/terminal-launch'

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
  const workspacePath = useWorkflowStore((state) => state.workspacePath)
  const nodes = useWorkflowStore((state) => state.nodes)
  const activeRunId = useExecutionStore((state) => state.activeRunId)
  const outputPath = useExecutionStore((state) => state.nodeOutputPaths[selectedNodeId])
  const contextDiagnostics = useExecutionStore(
    (state) => state.compiledContextDiagnostics[selectedNodeId]
  )
  const attemptLineage = buildAttemptLineageSummary(1)
  const canRetry =
    workflowStatus !== 'running' && workflowStatus !== 'stopping' && workflowStatus !== 'paused'
  const nodeLabel = nodes.find((node) => node.id === selectedNodeId)?.data?.label as string | undefined

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
          <p
            className="mt-1 text-[10px]"
            style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {attemptLineage.label}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void compactWorkflowContextForNode(selectedNodeId)}
            disabled={!contextDiagnostics?.compactSuggested}
            title="Create a long-term summary before retrying this node"
          >
            Compact
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!workspacePath) {
                return
              }

              void window.api.openTerminal(
                buildNodeTerminalLaunchPayload({
                  workspacePath,
                  runId: activeRunId,
                  nodeId: selectedNodeId,
                  nodeLabel,
                  outputPath,
                  mode: 'debug',
                  issueHint: nodeError || 'Node execution failed.',
                  focusHint: contextDiagnostics?.compactSuggested
                    ? 'Inspect trace, output, and context pressure before retrying.'
                    : 'Inspect trace, output, and recent workspace changes before retrying.'
                })
              )
            }}
            disabled={!workspacePath}
            title="Open a Windows Terminal repro session for this node"
          >
            <ExternalLink size={13} />
            Terminal
          </Button>
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
    </div>
  )
}
