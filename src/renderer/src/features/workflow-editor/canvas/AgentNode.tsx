import React from 'react'
import { Handle, Node, NodeProps, Position } from '@xyflow/react'
import { Eye, RotateCcw, Settings, Terminal } from 'lucide-react'
import { AgentNodeData } from '@shared'
import { ModelIconBadge } from '@renderer/components/ui/ModelIconBadge'
import { retryWorkflowFromNode } from '@renderer/lib/workflow-session'
import { getCodexModelDisplayName } from '@renderer/lib/provider-capabilities'
import { logRuntimeDebug } from '@renderer/lib/runtime-debug'
import { useExecutionStore } from '@renderer/stores/execution.store'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import {
  getAgentNodePromptPreview,
  getAgentNodeStatusMeta,
  getAgentNodeTitle,
  getAgentNodeTitleSource,
  getAgentNodeVisualState,
  type AgentNodeVisualState
} from './lib/agent-node-display'

type AgentFlowNode = Node<AgentNodeData, 'agentNode'>

const VISUAL_STATE_COLOR: Record<AgentNodeVisualState, string> = {
  idle: 'var(--color-hairline-strong)',
  selected: 'var(--color-primary)',
  running: 'var(--color-timeline-thinking)',
  stopping: 'var(--color-timeline-read)',
  completed: 'var(--color-timeline-grep)',
  error: 'var(--color-semantic-error)',
  paused: 'var(--color-timeline-edit)'
}

function getBorderColor(visualState: AgentNodeVisualState): string {
  if (visualState === 'idle') {
    return 'var(--color-hairline)'
  }

  if (visualState === 'selected') {
    return 'var(--color-hairline-strong)'
  }

  return VISUAL_STATE_COLOR[visualState]
}

export const AgentNode: React.FC<NodeProps<AgentFlowNode>> = ({ id, data }) => {
  const status = useExecutionStore((state) => state.nodeStatuses[id] ?? 'idle')
  const nodeError = useExecutionStore((state) => state.nodeErrors[id])
  const workflowStatus = useExecutionStore((state) => state.workflowStatus)
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities)
  const isSelected = useWorkflowStore((state) => state.selectedNodeId === id)
  const requestReviewFocus = useWorkflowStore((state) => state.requestReviewFocus)
  const setSelectedNode = useWorkflowStore((state) => state.setSelectedNode)

  const modelDisplayName = getCodexModelDisplayName(providerCapabilities, data.model)
  const title = getAgentNodeTitle(data, modelDisplayName)
  const titleSource = getAgentNodeTitleSource(data)
  const promptPreview = getAgentNodePromptPreview(data.prompt, {
    skipFirstMeaningfulLine: titleSource === 'prompt'
  })
  const statusMeta = getAgentNodeStatusMeta(status)
  const visualState = getAgentNodeVisualState(status, isSelected)
  const visualColor = VISUAL_STATE_COLOR[visualState]
  const canRetry =
    status === 'error' &&
    workflowStatus !== 'running' &&
    workflowStatus !== 'stopping' &&
    workflowStatus !== 'paused'
  const canInspectLogs = status !== 'idle'
  const isDimmedWhileRunning = status === 'idle' && workflowStatus === 'running'

  return (
    <div
      className="relative flex w-64 flex-col overflow-hidden transition-all duration-200"
      style={{
        background: 'var(--color-surface-card)',
        border: `1px solid ${getBorderColor(visualState)}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow:
          visualState === 'selected'
            ? '0 0 0 1px color-mix(in srgb, var(--color-primary) 18%, transparent)'
            : 'none',
        opacity: isDimmedWhileRunning ? 0.56 : 1
      }}
    >
      <div
        className="absolute bottom-0 left-0 top-0 w-[3px] transition-colors duration-300"
        style={{ background: visualColor }}
      />

      <Handle
        type="target"
        position={Position.Top}
        className="!h-1 !w-6 !cursor-crosshair !rounded-full !border-none !bg-transparent transition-all duration-150 hover:!w-8"
      >
        <div className="h-full w-full rounded-full bg-[var(--color-hairline)] transition-colors hover:bg-[var(--color-muted)]" />
      </Handle>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-1 !w-6 !cursor-crosshair !rounded-full !border-none !bg-transparent transition-all duration-150 hover:!w-8"
      >
        <div className="h-full w-full rounded-full bg-[var(--color-hairline)] transition-colors hover:bg-[var(--color-muted)]" />
      </Handle>

      <div
        className="flex items-start gap-2.5 px-3.5 py-3 pl-4"
        style={{ background: 'var(--color-canvas-soft)' }}
      >
        <ModelIconBadge modelId={data.model} displayName={modelDisplayName} />

        <div className="min-w-0 flex-1">
          <div
            className="line-clamp-2 text-[13px] font-semibold leading-4"
            style={{ color: 'var(--color-ink)', letterSpacing: 0 }}
            title={title}
          >
            {title}
          </div>
          <div
            className="mt-1 truncate text-[10px]"
            style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
            title={data.model}
          >
            {modelDisplayName}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
          {status !== 'idle' && (
            <span
              className="text-[8px] uppercase"
              style={{
                color: statusMeta.color,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.06em'
              }}
            >
              {statusMeta.label}
            </span>
          )}
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusMeta.pulse ? 'animate-pulse' : ''}`}
            style={{ background: statusMeta.color }}
            title={`Status: ${statusMeta.label}`}
          />
        </div>
      </div>

      {promptPreview && (
        <div className="px-3.5 py-2.5 pl-4" style={{ borderTop: '1px solid var(--color-hairline-soft)' }}>
          <p
            className="text-[11px] leading-4"
            style={{
              color: 'var(--color-body)',
              display: '-webkit-box',
              fontFamily: 'var(--font-mono)',
              overflow: 'hidden',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              whiteSpace: 'pre-line'
            }}
            title={promptPreview}
          >
            {promptPreview}
          </p>
        </div>
      )}

      {status === 'error' && nodeError && (
        <div
          className="px-3.5 py-2 pl-4"
          style={{
            background: 'var(--color-canvas-soft)',
            borderTop: '1px solid var(--color-hairline-soft)'
          }}
        >
          <p
            className="truncate text-[10px]"
            style={{ color: 'var(--color-semantic-error)', fontFamily: 'var(--font-mono)' }}
            title={nodeError}
          >
            {nodeError}
          </p>
        </div>
      )}

      <div className="flex pl-[3px]" style={{ borderTop: '1px solid var(--color-hairline)' }}>
        <ActionButton
          icon={<Settings size={11} />}
          label="Config"
          onClick={(event) => {
            event.stopPropagation()
            setSelectedNode(id)
          }}
        />

        <ActionDivider />

        {status === 'paused' && (
          <>
            <ActionButton
              icon={<Eye size={11} />}
              label="Review"
              color="var(--color-timeline-edit)"
              onClick={(event) => {
                event.stopPropagation()
                requestReviewFocus(id)
              }}
            />
            <ActionDivider />
          </>
        )}

        {status === 'error' && (
          <>
            <ActionButton
              icon={<RotateCcw size={11} />}
              label="Retry"
              color={canRetry ? 'var(--color-primary)' : 'var(--color-muted-soft)'}
              disabled={!canRetry}
              title={nodeError || 'Retry from this node'}
              onClick={(event) => {
                event.stopPropagation()
                if (canRetry) {
                  retryWorkflowFromNode(id)
                }
              }}
            />
            <ActionDivider />
          </>
        )}

        <ActionButton
          icon={<Terminal size={11} />}
          label="Logs"
          color={canInspectLogs ? 'var(--color-muted)' : 'var(--color-muted-soft)'}
          disabled={!canInspectLogs}
          title={canInspectLogs ? 'View logs' : 'Run first to see logs'}
          onClick={(event) => {
            event.stopPropagation()
            if (!canInspectLogs) {
              return
            }

            const workflowStore = useWorkflowStore.getState()
            workflowStore.setTerminalFollowMode('manual')
            workflowStore.followTerminalNode(id)
            logRuntimeDebug('AgentNode', 'manual terminal log inspection activated', {
              nodeId: id,
              nodeLabel: title,
              nodeModel: data.model
            })
          }}
        />
      </div>
    </div>
  )
}

function ActionDivider(): React.JSX.Element {
  return <div className="w-px" style={{ background: 'var(--color-hairline)' }} />
}

function ActionButton({
  icon,
  label,
  color = 'var(--color-muted)',
  disabled = false,
  title,
  onClick
}: {
  icon: React.ReactNode
  label: string
  color?: string
  disabled?: boolean
  title?: string
  onClick?: (event: React.MouseEvent) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="nodrag nopan flex-1 py-2 text-[10px] transition-colors hover:bg-[var(--color-canvas)] disabled:cursor-not-allowed disabled:hover:bg-transparent"
      style={{ color, opacity: disabled ? 0.65 : 1 }}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="flex items-center justify-center gap-1">
        {icon}
        <span>{label}</span>
      </span>
    </button>
  )
}
