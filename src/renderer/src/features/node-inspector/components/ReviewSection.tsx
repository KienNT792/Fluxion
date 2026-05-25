import React from 'react'
import { NodeId } from '@shared'
import {
  approveReviewNode,
  rejectReviewNode,
  rerunReviewNode
} from '@renderer/lib/workflow-session'
import { OutputPreview } from '@renderer/components/ui/OutputPreview'
import { StatusChip } from '@renderer/components/ui/StatusChip'
import { useExecutionStore, type ReviewActionKind } from '@renderer/stores/execution.store'
import { InspectorSection as Section } from './InspectorSection'
import { buildAttemptLineageSummary } from '@renderer/features/runtime/lib/attempt-lineage'

interface ReviewSectionProps {
  nodeAttemptCount?: number
  nodeOutputPath?: string
  onError: (error: string | null) => void
  reviewActionInFlight?: ReviewActionKind
  reviewSectionRef: React.RefObject<HTMLDivElement | null>
  selectedNodeId: NodeId
  workspacePath: string | null
}

export const ReviewSection: React.FC<ReviewSectionProps> = ({
  nodeAttemptCount,
  nodeOutputPath,
  onError,
  reviewActionInFlight,
  reviewSectionRef,
  selectedNodeId,
  workspacePath
}) => {
  const pendingReviewContext = useExecutionStore((state) => state.pendingReviewByNodeId[selectedNodeId])
  const reviewNodeIds = useExecutionStore((state) => state.reviewNodeIds)
  const upstreamReviewOptions = reviewNodeIds.filter((nodeId) => nodeId !== selectedNodeId)
  const [upstreamNodeId, setUpstreamNodeId] = React.useState<NodeId | undefined>(undefined)
  const isReviewActionPending = Boolean(reviewActionInFlight)
  const attemptLineage = buildAttemptLineageSummary(nodeAttemptCount)
  const reviewActionLabel = {
    approve: reviewActionInFlight === 'approve' ? 'Approving...' : 'Approve',
    rerun: reviewActionInFlight === 'rerun' ? 'Rerunning...' : 'Rerun',
    reject: reviewActionInFlight === 'reject' ? 'Rejecting...' : 'Reject'
  }

  return (
    <div ref={reviewSectionRef} tabIndex={-1}>
      <Section title="Review">
        <div
          className="rounded-md px-3 py-2"
          style={{
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-hairline)'
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
          <p className="mt-2 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
            {pendingReviewContext?.reviewReason === 'manual'
              ? 'Manual checkpoint. Review the output before continuing the workflow.'
              : 'Node requires human review before the workflow can continue.'}
          </p>
        </div>

        <div
          className="rounded-md px-3 py-2"
          style={{
            background: 'var(--color-canvas-soft)',
            border: '1px solid var(--color-hairline-soft)'
          }}
        >
          <div className="text-[10px] uppercase" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
            Decision Request
          </div>
          <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
            {pendingReviewContext?.reviewPrompt || `Review output from ${selectedNodeId} before continuing.`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
            <span>{pendingReviewContext?.reviewReason === 'manual' ? 'Manual checkpoint' : 'Node requires human review'}</span>
            {pendingReviewContext?.agentVerdict ? (
              <span style={{ color: pendingReviewContext.agentVerdict === 'NEEDS_REVISION' ? 'var(--color-semantic-error)' : 'var(--color-timeline-grep)' }}>
                Agent verdict: {pendingReviewContext.agentVerdict}
              </span>
            ) : null}
          </div>
        </div>

        <OutputPreview
          workspacePath={workspacePath}
          path={nodeOutputPath}
          attemptCount={nodeAttemptCount}
          onError={onError}
        />

        {upstreamReviewOptions.length > 0 ? (
          <label
            className="block rounded-md px-3 py-2 text-[10px]"
            style={{
              background: 'var(--color-canvas-soft)',
              border: '1px solid var(--color-hairline-soft)',
              color: 'var(--color-muted)',
              fontFamily: 'var(--font-mono)'
            }}
          >
            Send back to upstream node
            <select
              className="mt-1 w-full rounded-md border px-2 py-1 text-xs"
              style={{
                background: 'var(--color-surface-card)',
                borderColor: 'var(--color-hairline)',
                color: 'var(--color-body)'
              }}
              value={upstreamNodeId ?? ''}
              onChange={(event) =>
                setUpstreamNodeId(event.target.value ? (event.target.value as NodeId) : undefined)
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

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => void approveReviewNode(selectedNodeId)}
            disabled={isReviewActionPending}
            className="flex items-center justify-center rounded-md py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed"
            style={{
              background: 'var(--color-timeline-grep)',
              color: 'var(--color-ink)',
              border: '1px solid var(--color-hairline)',
              opacity: isReviewActionPending && reviewActionInFlight !== 'approve' ? 0.55 : 1
            }}
          >
            {reviewActionLabel.approve}
          </button>
          <button
            type="button"
            onClick={() => void rerunReviewNode(selectedNodeId)}
            disabled={isReviewActionPending}
            className="flex items-center justify-center rounded-md py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed"
            style={{
              background: 'var(--color-surface-card)',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-hairline)',
              opacity: isReviewActionPending && reviewActionInFlight !== 'rerun' ? 0.55 : 1
            }}
          >
            {reviewActionLabel.rerun}
          </button>
          <button
            type="button"
            onClick={() => void rejectReviewNode(selectedNodeId, upstreamNodeId)}
            disabled={isReviewActionPending}
            className="flex items-center justify-center rounded-md py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed"
            style={{
              background: 'var(--color-surface-card)',
              color: 'var(--color-semantic-error)',
              border: '1px solid var(--color-hairline)',
              opacity: isReviewActionPending && reviewActionInFlight !== 'reject' ? 0.55 : 1
            }}
          >
            {upstreamNodeId ? `${reviewActionLabel.reject} upstream` : reviewActionLabel.reject}
          </button>
        </div>
      </Section>
    </div>
  )
}
