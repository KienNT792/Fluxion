import React from 'react'
import type { NodeId } from '@shared'
import {
  approveReviewNode,
  rejectReviewNode,
  rerunReviewNode
} from '@renderer/lib/workflow-session'
import { StatusChip } from '@renderer/components/ui/StatusChip'
import type { ReviewActionKind } from '@renderer/stores/execution.store'

interface ReviewBannerProps {
  nodeAttemptCount?: number
  reviewActionInFlight?: ReviewActionKind
  reviewSectionRef: React.RefObject<HTMLDivElement | null>
  selectedNodeId: NodeId
}

export const ReviewBanner: React.FC<ReviewBannerProps> = ({
  nodeAttemptCount,
  reviewActionInFlight,
  reviewSectionRef,
  selectedNodeId
}) => {
  const isReviewActionPending = Boolean(reviewActionInFlight)
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
          attempt {nodeAttemptCount ?? 1}
        </span>
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
          label={reviewActionLabel.reject}
          tone="reject"
          onClick={() => void rejectReviewNode(selectedNodeId)}
        />
      </div>
    </div>
  )
}

function ReviewActionButton({
  disabled,
  label,
  onClick,
  tone
}: {
  disabled: boolean
  label: string
  onClick: () => void
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
    >
      {label}
    </button>
  )
}
