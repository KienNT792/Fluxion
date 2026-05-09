import React, { useMemo } from 'react'
import { Activity, ChevronDown, ChevronUp, FileOutput, Terminal } from 'lucide-react'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { useExecutionStore } from '@renderer/stores/execution.store'
import { DockTabButton } from './components/DockTabButton'
import { ExecutionTimeline } from './components/ExecutionTimeline'
import { RuntimeOutputPreview } from './components/RuntimeOutputPreview'
import { TerminalViewer } from './components/TerminalViewer'
import { useRuntimeDockState } from './hooks/useRuntimeDockState'
import {
  getDisplayName,
  PULSE_STATUSES,
  STATUS_DOT_COLOR,
  STATUS_LABEL
} from './lib/runtime-status'

export const RuntimeDock: React.FC = () => {
  const nodes = useWorkflowStore((state) => state.nodes)
  const executionMode = useWorkflowStore((state) => state.executionMode)
  const terminalNodeId = useWorkflowStore((state) => state.terminalNodeId)
  const terminalFollowMode = useWorkflowStore((state) => state.terminalFollowMode)
  const terminalViewRequestId = useWorkflowStore((state) => state.terminalViewRequestId)
  const setExecutionMode = useWorkflowStore((state) => state.setExecutionMode)
  const setTerminalFollowMode = useWorkflowStore((state) => state.setTerminalFollowMode)
  const followTerminalNode = useWorkflowStore((state) => state.followTerminalNode)

  const workflowStatus = useExecutionStore((state) => state.workflowStatus)
  const reviewNodeIds = useExecutionStore((state) => state.reviewNodeIds)
  const nodeAttemptCounts = useExecutionStore((state) => state.nodeAttemptCounts)
  const nodeStatuses = useExecutionStore((state) => state.nodeStatuses)

  const totalRuns = Object.values(nodeAttemptCounts).reduce((acc, value) => acc + (value || 0), 0)
  const runningNodeIds = useMemo(
    () =>
      Object.entries(nodeStatuses)
        .filter(([, status]) => status === 'running')
        .map(([id]) => id),
    [nodeStatuses]
  )
  const errorNodeIds = useMemo(
    () =>
      Object.entries(nodeStatuses)
        .filter(([, status]) => status === 'error')
        .map(([id]) => id),
    [nodeStatuses]
  )

  const isActive = workflowStatus !== 'idle'
  const dotColor = STATUS_DOT_COLOR[workflowStatus]
  const shouldPulse = PULSE_STATUSES.has(workflowStatus)
  const hasReviewQueue = reviewNodeIds.length > 0
  const followedNode = terminalNodeId ? nodes.find((node) => node.id === terminalNodeId) : null
  const followedNodeLabel = getDisplayName(
    followedNode?.data?.label as string | undefined,
    followedNode?.data?.model as string | undefined,
    terminalNodeId ?? 'No node selected'
  )
  const followedNodeModel = followedNode?.data?.model as string | undefined
  const followedNodeStatus = terminalNodeId ? (nodeStatuses[terminalNodeId] ?? 'idle') : 'idle'

  const followSummary = terminalNodeId
    ? terminalFollowMode === 'auto'
      ? `Following: ${followedNodeLabel}`
      : `Viewing: ${followedNodeLabel} · Manual`
    : terminalFollowMode === 'auto'
      ? 'Following: waiting for active node'
      : 'Viewing: no node selected · Manual'

  const secondarySummary =
    runningNodeIds.length > 0
      ? `${runningNodeIds.length} node${runningNodeIds.length === 1 ? '' : 's'} running`
      : hasReviewQueue
        ? `${reviewNodeIds.length} review${reviewNodeIds.length === 1 ? '' : 's'} pending`
        : totalRuns > 0
          ? `${totalRuns} run${totalRuns === 1 ? '' : 's'} recorded`
          : 'No execution yet'

  const logsAttentionColor =
    errorNodeIds.length > 0
      ? 'var(--color-semantic-error)'
      : terminalNodeId && followedNodeStatus === 'running'
        ? 'var(--color-timeline-thinking)'
        : terminalNodeId
          ? 'var(--color-primary)'
          : undefined

  const { activeTab, handleFollowRunning, handleTabChange, isExpanded, setIsExpanded } =
    useRuntimeDockState({
      followTerminalNode,
      nodeStatuses,
      setTerminalFollowMode,
      terminalFollowMode,
      terminalNodeId,
      terminalViewRequestId,
      workflowStatus
    })

  return (
    <div
      className="flex flex-col"
      style={{
        flexShrink: 0,
        borderTop: '1px solid var(--color-hairline-strong)',
        background: 'var(--color-canvas)'
      }}
    >
      <div
        className="flex items-stretch justify-between"
        style={{
          background: isExpanded ? 'var(--color-surface-card)' : 'var(--color-canvas)',
          borderBottom: isExpanded ? '1px solid var(--color-hairline)' : 'none'
        }}
      >
        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left transition-colors"
          onMouseEnter={(event) => {
            event.currentTarget.style.background = 'var(--color-surface-card)'
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = isExpanded
              ? 'var(--color-surface-card)'
              : 'var(--color-canvas)'
          }}
        >
          <span
            className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${shouldPulse ? 'animate-pulse' : ''}`}
            style={{ background: dotColor }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="truncate text-xs font-semibold"
                style={{
                  color: isActive ? 'var(--color-ink)' : 'var(--color-body)',
                  letterSpacing: '-0.1px'
                }}
              >
                {STATUS_LABEL[workflowStatus]}
              </span>
              <span
                className="shrink-0 text-[10px] uppercase"
                style={{
                  color:
                    terminalFollowMode === 'auto'
                      ? 'var(--color-timeline-thinking)'
                      : 'var(--color-timeline-done)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.06em'
                }}
              >
                {terminalFollowMode === 'auto' ? 'Auto-follow' : 'Manual'}
              </span>
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-2">
              <span className="truncate text-[11px]" style={{ color: 'var(--color-body)' }}>
                {followSummary}
              </span>
              {followedNodeModel && terminalNodeId ? (
                <span
                  className="shrink-0 text-[10px]"
                  style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  {followedNodeModel}
                </span>
              ) : null}
            </div>
            <div
              className="mt-0.5 text-[10px]"
              style={{
                color: hasReviewQueue ? 'var(--color-timeline-edit)' : 'var(--color-muted)'
              }}
            >
              {secondarySummary}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 px-3" style={{ color: 'var(--color-muted)' }}>
          {terminalFollowMode === 'manual' ? (
            <button
              type="button"
              onClick={handleFollowRunning}
              className="rounded-md px-2 py-1 text-[10px] font-semibold transition-colors"
              style={{
                color: 'var(--color-timeline-thinking)',
                background: 'var(--color-canvas-soft)',
                fontFamily: 'var(--font-mono)'
              }}
              title="Return terminal focus to running nodes"
              onMouseEnter={(event) => {
                event.currentTarget.style.background = 'var(--color-surface-strong)'
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'var(--color-canvas-soft)'
              }}
            >
              Follow Running
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setExecutionMode(executionMode === 'auto' ? 'manual' : 'auto')}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors"
            style={{
              background: executionMode === 'manual' ? 'var(--color-surface-strong)' : 'transparent'
            }}
            title={executionMode === 'auto' ? 'Auto mode' : 'Manual mode'}
            onMouseEnter={(event) => {
              event.currentTarget.style.color = 'var(--color-ink)'
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.color = 'var(--color-muted)'
            }}
          >
            <span
              className="text-[9px] font-semibold uppercase tracking-wider"
              style={{
                color: executionMode === 'manual' ? 'var(--color-timeline-done)' : 'inherit',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {executionMode === 'auto' ? 'Auto' : 'Manual'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((value) => !value)}
            className="rounded-md p-1 transition-colors"
            style={{ color: 'inherit' }}
            title={isExpanded ? 'Collapse runtime dock' : 'Expand runtime dock'}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = 'var(--color-canvas-soft)'
              event.currentTarget.style.color = 'var(--color-ink)'
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent'
              event.currentTarget.style.color = 'inherit'
            }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div
          className="flex flex-col overflow-hidden"
          style={{ height: 'clamp(180px, 30vh, 320px)' }}
        >
          <div
            className="flex shrink-0 items-center gap-0.5 px-2"
            style={{
              background: 'var(--color-surface-card)',
              borderBottom: '1px solid var(--color-hairline)'
            }}
          >
            <DockTabButton
              label="Timeline"
              icon={<Activity size={12} />}
              active={activeTab === 'timeline'}
              onClick={() => handleTabChange('timeline')}
            />
            <DockTabButton
              label="Logs"
              icon={<Terminal size={12} />}
              active={activeTab === 'logs'}
              attentionColor={logsAttentionColor}
              attentionPulse={followedNodeStatus === 'running'}
              badge={errorNodeIds.length > 0 ? errorNodeIds.length : undefined}
              onClick={() => handleTabChange('logs')}
            />
            <DockTabButton
              label="Output"
              icon={<FileOutput size={12} />}
              active={activeTab === 'output'}
              onClick={() => handleTabChange('output')}
            />
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            {activeTab === 'timeline' ? <ExecutionTimeline /> : null}
            {activeTab === 'logs' ? <TerminalViewer /> : null}
            {activeTab === 'output' ? <RuntimeOutputPreview /> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
