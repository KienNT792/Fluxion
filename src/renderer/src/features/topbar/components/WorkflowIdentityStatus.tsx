import React from 'react'
import { Tooltip } from '@renderer/components/ui/Tooltip'

interface WorkflowIdentityStatusProps {
  displayWorkflowName: string
  workspaceName: string
  workspacePath: string | null
}

export const WorkflowIdentityStatus: React.FC<WorkflowIdentityStatusProps> = ({
  displayWorkflowName,
  workspaceName,
  workspacePath
}) => (
  <div className="min-w-0">
    <Tooltip content={workspacePath || 'No workspace open'}>
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="shrink-0 text-sm font-semibold"
          style={{ color: 'var(--color-ink)', letterSpacing: 0 }}
        >
          {workspaceName}
        </span>
        <span className="shrink-0 text-xs" style={{ color: 'var(--color-muted-soft)' }}>
          /
        </span>
        <span className="hidden shrink-0 text-xs sm:inline" style={{ color: 'var(--color-muted)' }}>
          Workflow
        </span>
        <span
          className="min-w-0 truncate text-sm font-semibold"
          style={{ color: 'var(--color-ink)', letterSpacing: 0 }}
        >
          {displayWorkflowName}
        </span>
      </div>
    </Tooltip>
  </div>
)
