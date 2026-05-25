import React from 'react'
import type { NodeId } from '@shared'
import {
  approveReviewNode,
  rejectReviewNode,
  rerunReviewNode
} from '@renderer/lib/workflow-session'
import { StatusChip } from '@renderer/components/ui/StatusChip'
import { useExecutionStore, type ReviewActionKind } from '@renderer/stores/execution.store'
import { buildAttemptLineageSummary } from '@renderer/features/runtime/lib/attempt-lineage'

interface ReviewBannerProps {
  nodeAttemptCount?: number
  reviewActionInFlight?: ReviewActionKind
  reviewSectionRef: React.RefObject<HTMLDivElement | null>
  selectedNodeId: NodeId
  upstreamNodeId?: NodeId
  upstreamReviewOptions?: NodeId[]
  onUpstreamNodeIdChange?: (nodeId?: NodeId) => void
}

export const ReviewBanner: React.FC<ReviewBannerProps> = ({
  nodeAttemptCount,
  reviewActionInFlight,
  reviewSectionRef,
  selectedNodeId,
  upstreamNodeId,
  upstreamReviewOptions = [],
  onUpstreamNodeIdChange
}) => {
  const pendingReviewContext = useExecutionStore((state) => state.pendingReviewByNodeId[selectedNodeId])
  const isReviewActionPending = Boolean(reviewActionInFlight)
  const attemptLineage = buildAttemptLineageSummary(nodeAttemptCount)
  const reviewActionLabel = {
    approve: reviewActionInFlight === 'approve' ? 'Approving...' : 'Approve',
    rerun: reviewActionInFlight === 'rerun' ? 'Rerunning...' : 'Rerun',
    reject: reviewActionInFlight === 'reject' ? 'Rejecting...' : 'Reject'
  }

  return (
    <div
      ref={reviewSectionRef}
      tabIndex={-1}
      className="flex-shrink-0 px-4 py-3"
      style={{
        background: 'var(--color-canvas-soft)',
        borderBottom: '1px solid var(--color-hairline)'
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <StatusChip
          tone="paused"
          label={reviewActionInFlight === 'rerun' ? 'Rerunning' : 'Awaiting Review'}
          animate={reviewActionInFlight === 'rerun'}
        />
        <span
          className="text-[10px]"
          style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {attemptLineage.label}
        </span>
      </div>
      {attemptLineage.previousAttempts > 0 ? (
        <div className="mt-1 text-[10px]" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
          {attemptLineage.previousAttempts} prior attempt
          {attemptLineage.previousAttempts === 1 ? '' : 's'}
        </div>
      ) : null}

      <div
        className="mt-3 rounded-md px-3 py-2"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)'
        }}
      >
        <div
          className="text-[10px] uppercase"
          style={{
            color: 'var(--color-muted)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em'
          }}
        >
          Decision Request
        </div>
        <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
          {pendingReviewContext?.reviewPrompt ||
            `Review output from ${selectedNodeId} before continuing.`}
        </p>
        <div
          className="mt-2 flex flex-wrap items-center gap-2 text-[10px]"
          style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
        >
          <span>
            {pendingReviewContext?.reviewReason === 'manual'
              ? 'Manual checkpoint'
              : 'Node requires human review'}
          </span>
          {pendingReviewContext?.agentVerdict ? (
            <span
              style={{
                color:
                  pendingReviewContext.agentVerdict === 'NEEDS_REVISION'
                    ? 'var(--color-semantic-error)'
                    : 'var(--color-timeline-grep)'
              }}
            >
              Agent verdict: {pendingReviewContext.agentVerdict}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <ReviewActionButton
          disabled={isReviewActionPending}
          label={reviewActionLabel.approve}
          tone="approve"
          onClick={() => void approveReviewNode(selectedNodeId)}
        />
        <ReviewActionButton
          disabled={isReviewActionPending}
          label={reviewActionLabel.rerun}
          tone="rerun"
          onClick={() => void rerunReviewNode(selectedNodeId)}
        />
        <ReviewActionButton
          disabled={isReviewActionPending}
          label={upstreamNodeId ? `${reviewActionLabel.reject} upstream` : reviewActionLabel.reject}
          tone="reject"
          onClick={() => void rejectReviewNode(selectedNodeId, upstreamNodeId)}
          title={upstreamNodeId ? `Send back to upstream node ${upstreamNodeId}` : undefined}
        />
      </div>
      {onUpstreamNodeIdChange && upstreamReviewOptions.length > 0 ? (
        <label
          className="mt-2 block rounded-md px-3 py-2 text-[10px]"
          style={{
            background: 'var(--color-canvas-soft)',
            border: '1px solid var(--color-hairline-soft)',
            color: 'var(--color-muted)',
            fontFamily: 'var(--font-mono)'
          }}
        >
          Upstream target
          <select
            className="mt-1 w-full rounded-md border px-2 py-1 text-xs"
            style={{
              background: 'var(--color-surface-card)',
              borderColor: 'var(--color-hairline)',
              color: 'var(--color-body)'
            }}
            value={upstreamNodeId ?? ''}
            onChange={(event) =>
              onUpstreamNodeIdChange(event.target.value ? (event.target.value as NodeId) : undefined)
            }
          >
            <option value="">Current node only</option>
            {upstreamReviewOptions.map((nodeId) => (
              <option key={nodeId} value={nodeId}>
                {nodeId}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  )
}

function ReviewActionButton({
  disabled,
  label,
  onClick,
  title,
  tone
}: {
  disabled: boolean
  label: string
  onClick: () => void
  title?: string
  tone: 'approve' | 'rerun' | 'reject'
}): React.JSX.Element {
  const styleByTone = {
    approve: {
      background: 'var(--color-timeline-grep)',
      color: 'var(--color-ink)'
    },
    rerun: {
      background: 'var(--color-surface-card)',
      color: 'var(--color-primary)'
    },
    reject: {
      background: 'var(--color-surface-card)',
      color: 'var(--color-semantic-error)'
    }
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 items-center justify-center rounded-md text-xs font-semibold transition-colors disabled:cursor-not-allowed"
      style={{
        ...styleByTone,
        border: '1px solid var(--color-hairline)',
        opacity: disabled ? 0.65 : 1
      }}
      title={title ?? label}
    >
      {label}
    </button>
  )
}
