import React from 'react'
import { Button } from '@renderer/components/ui/Button'
import { StatusChip, StatusChipTone } from '@renderer/components/ui/StatusChip'
import { Tooltip } from '@renderer/components/ui/Tooltip'

interface ChipState {
  animate?: boolean
  label: string
  tone: StatusChipTone
}

interface WorkflowIdentityStatusProps {
  approvalGuardrail: {
    message?: string
    nodeId?: string
    severity: 'ok' | 'warning' | 'blocked'
  }
  displayWorkflowName: string
  isDirty: boolean
  isPaused: boolean
  isSaving: boolean
  onFixPermissions: () => void
  onReviewFocus: () => void
  reviewButtonLabel: string
  reviewNodeCount: number
  reviewNodeLabel?: string
  saveChipState: ChipState
  saveError: string | null
  saveStateLabel: string
  statusSubtext?: string | null
  workflowChipLabel: string
  workflowChipState: ChipState
  workspaceName: string
  workspacePath: string | null
}

export const WorkflowIdentityStatus: React.FC<WorkflowIdentityStatusProps> = ({
  approvalGuardrail,
  displayWorkflowName,
  isDirty,
  isPaused,
  isSaving,
  onFixPermissions,
  onReviewFocus,
  reviewButtonLabel,
  reviewNodeCount,
  reviewNodeLabel,
  saveChipState,
  saveError,
  saveStateLabel,
  statusSubtext,
  workflowChipLabel,
  workflowChipState,
  workspaceName,
  workspacePath
}) => (
  <>
    <div className="min-w-0">
      <Tooltip content={workspacePath || 'No workspace open'}>
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="shrink-0 text-sm font-semibold"
            style={{ color: 'var(--color-ink)', letterSpacing: '-0.15px' }}
          >
            {workspaceName}
          </span>
          <span className="shrink-0 text-xs" style={{ color: 'var(--color-muted-soft)' }}>
            /
          </span>
          <span
            className="hidden shrink-0 text-xs sm:inline"
            style={{ color: 'var(--color-muted)' }}
          >
            Workflow:
          </span>
          <span
            className="min-w-0 truncate text-sm font-semibold"
            style={{ color: 'var(--color-ink)', letterSpacing: '-0.15px' }}
          >
            {displayWorkflowName}
          </span>
        </div>
      </Tooltip>
    </div>

    <div className="hidden items-center gap-2 md:flex">
      {!(!isDirty && !isSaving && !saveError) && (
        <StatusChip
          tone={saveChipState.tone}
          label={saveChipState.label}
          animate={saveChipState.animate}
          title={saveStateLabel}
        />
      )}
      <StatusChip
        tone={workflowChipState.tone}
        label={workflowChipLabel}
        animate={workflowChipState.animate}
        title={statusSubtext ?? workflowChipLabel}
        className="max-w-[170px]"
      />

      {isPaused && reviewNodeCount > 0 && (
        <Button
          variant="secondary"
          size="toolbar"
          className="min-w-[132px]"
          title={reviewNodeLabel ? `Open review for ${reviewNodeLabel}` : 'Open review panel'}
          onClick={onReviewFocus}
        >
          {reviewButtonLabel}
        </Button>
      )}

      {approvalGuardrail.severity === 'blocked' && approvalGuardrail.nodeId && (
        <Button
          variant="secondary"
          size="toolbar"
          className="min-w-[132px]"
          title={approvalGuardrail.message}
          onClick={onFixPermissions}
        >
          Fix Permissions
        </Button>
      )}
    </div>
  </>
)
