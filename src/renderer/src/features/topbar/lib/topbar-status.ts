import type { StatusChipTone } from '@renderer/components/ui/StatusChip'
import type { WorkflowRuntimeStatus } from '@renderer/stores/execution.store'

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

export function formatSavedLabel(lastSavedAt: string | null): string {
  if (!lastSavedAt) {
    return 'Saved recently'
  }

  return `Saved ${new Date(lastSavedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })}`
}

export function getWorkflowChipState(workflowStatus: WorkflowRuntimeStatus): {
  label: string
  tone: StatusChipTone
  animate: boolean
} {
  if (workflowStatus === 'running') {
    return { label: 'Executing', tone: 'running', animate: true }
  }

  if (workflowStatus === 'stopping') {
    return { label: 'Stopping', tone: 'stopping', animate: true }
  }

  if (workflowStatus === 'completed') {
    return { label: 'Completed', tone: 'completed', animate: false }
  }

  if (workflowStatus === 'paused') {
    return { label: 'Awaiting Review', tone: 'paused', animate: false }
  }

  if (workflowStatus === 'aborted') {
    return { label: 'Aborted', tone: 'stopping', animate: false }
  }

  if (workflowStatus === 'error') {
    return { label: 'Error', tone: 'error', animate: false }
  }

  return { label: 'Ready', tone: 'idle', animate: false }
}

export function getSaveChipState(
  isDirty: boolean,
  isSaving: boolean,
  saveError: string | null
): {
  label: string
  tone: StatusChipTone
  animate: boolean
} {
  if (saveError) {
    return { label: 'Save failed', tone: 'error', animate: false }
  }

  if (isSaving) {
    return { label: 'Saving', tone: 'running', animate: true }
  }

  if (isDirty) {
    return { label: 'Unsaved', tone: 'warning', animate: false }
  }

  return { label: 'Saved', tone: 'success', animate: false }
}

export function getContextChipState(contextStatus: 'missing' | 'incomplete' | 'ready' | 'legacy'): {
  label: string
  tone: StatusChipTone
  detail: string
} {
  switch (contextStatus) {
    case 'ready':
      return {
        label: 'Context Ready',
        tone: 'success',
        detail: 'Project context is ready and will be injected into agent runtime.'
      }
    case 'legacy':
      return {
        label: 'Context Legacy',
        tone: 'warning',
        detail: 'This workspace still uses an older context shape. Review and resave it.'
      }
    case 'incomplete':
      return {
        label: 'Context Incomplete',
        tone: 'warning',
        detail: 'A draft context exists, but it still needs review before it is fully ready.'
      }
    default:
      return {
        label: 'Context Missing',
        tone: 'error',
        detail: 'No project context has been saved for this workspace yet.'
      }
  }
}

export interface TopbarStatusView {
  animate?: boolean
  detail?: string
  label: string
  tone: StatusChipTone
}

export interface AggregateReadinessRow {
  detail?: string
  id: 'workflow' | 'save' | 'context' | 'codex' | 'activity' | 'permissions'
  label: string
  tone: StatusChipTone
  value: string
}

export interface AggregateReadinessState {
  animate: boolean
  detail: string
  label: string
  rows: AggregateReadinessRow[]
  tone: StatusChipTone
}

export interface AggregateReadinessOptions {
  activityHasAttention: boolean
  activitySummaryLabel: string
  approvalGuardrail: {
    message?: string
    severity: 'ok' | 'warning' | 'blocked'
    summary?: string
  }
  codexReadiness: {
    blocking?: boolean
    detail: string
    label: string
    summary: string
  }
  contextChipState: TopbarStatusView
  hasExternalWorkflowChange: boolean
  readinessTone: StatusChipTone
  saveChipState: TopbarStatusView
  saveStateLabel: string
  workflowChipLabel: string
  workflowChipState: TopbarStatusView
  workflowStatus: WorkflowRuntimeStatus
}

export function getAggregateReadinessState({
  activityHasAttention,
  activitySummaryLabel,
  approvalGuardrail,
  codexReadiness,
  contextChipState,
  hasExternalWorkflowChange,
  readinessTone,
  saveChipState,
  saveStateLabel,
  workflowChipLabel,
  workflowChipState,
  workflowStatus
}: AggregateReadinessOptions): AggregateReadinessState {
  const permissionTone: StatusChipTone =
    approvalGuardrail.severity === 'blocked'
      ? 'error'
      : approvalGuardrail.severity === 'warning'
        ? 'warning'
        : 'success'
  const rows: AggregateReadinessRow[] = [
    {
      id: 'workflow',
      label: 'Workflow',
      tone: workflowChipState.tone,
      value: workflowChipLabel,
      detail: workflowChipState.detail
    },
    {
      id: 'save',
      label: 'Save',
      tone: saveChipState.tone,
      value: saveChipState.label,
      detail: saveStateLabel
    },
    {
      id: 'context',
      label: 'Context',
      tone: contextChipState.tone,
      value: contextChipState.label.replace(/^Context\s+/, ''),
      detail: contextChipState.detail
    },
    {
      id: 'codex',
      label: 'Codex',
      tone: readinessTone,
      value: codexReadiness.label,
      detail: codexReadiness.detail
    },
    {
      id: 'activity',
      label: 'Activity',
      tone: hasExternalWorkflowChange ? 'error' : activityHasAttention ? 'completed' : 'idle',
      value: activitySummaryLabel,
      detail: hasExternalWorkflowChange
        ? 'Workflow file changed on disk. Reload before continuing.'
        : activitySummaryLabel
    },
    {
      id: 'permissions',
      label: 'Permissions',
      tone: permissionTone,
      value:
        approvalGuardrail.severity === 'ok'
          ? 'Runnable'
          : approvalGuardrail.severity === 'blocked'
            ? 'Blocked'
            : 'Warning',
      detail: approvalGuardrail.message ?? approvalGuardrail.summary
    }
  ]

  if (workflowStatus === 'running' || workflowStatus === 'stopping') {
    return {
      animate: true,
      detail: workflowChipLabel,
      label: workflowStatus === 'stopping' ? 'Workflow stopping' : 'Workflow running',
      rows,
      tone: workflowChipState.tone
    }
  }

  if (workflowStatus === 'paused') {
    return {
      animate: false,
      detail: 'A node is waiting for review before the workflow can continue.',
      label: 'Review required',
      rows,
      tone: 'paused'
    }
  }

  if (approvalGuardrail.severity === 'blocked') {
    return {
      animate: false,
      detail: approvalGuardrail.summary ?? 'Codex permissions block this workflow.',
      label: 'Permission blocked',
      rows,
      tone: 'error'
    }
  }

  if (workflowStatus === 'error' || workflowStatus === 'aborted') {
    return {
      animate: false,
      detail: workflowChipState.detail ?? workflowChipLabel,
      label: workflowChipLabel,
      rows,
      tone: workflowChipState.tone
    }
  }

  if (hasExternalWorkflowChange) {
    return {
      animate: false,
      detail: 'Workflow file changed on disk. Reload to sync the canvas.',
      label: 'Workflow changed',
      rows,
      tone: 'error'
    }
  }

  if (contextChipState.tone === 'error' || contextChipState.tone === 'warning') {
    return {
      animate: false,
      detail: contextChipState.detail ?? 'Project context needs review.',
      label: 'Needs context',
      rows,
      tone: contextChipState.tone
    }
  }

  if (codexReadiness.blocking || readinessTone === 'error') {
    return {
      animate: false,
      detail: codexReadiness.summary,
      label: 'Codex missing',
      rows,
      tone: 'error'
    }
  }

  if (saveChipState.tone === 'error') {
    return {
      animate: false,
      detail: saveStateLabel,
      label: 'Save failed',
      rows,
      tone: 'error'
    }
  }

  if (approvalGuardrail.severity === 'warning') {
    return {
      animate: false,
      detail: approvalGuardrail.summary ?? 'Codex permissions need review.',
      label: 'Permission warning',
      rows,
      tone: 'warning'
    }
  }

  if (saveChipState.label === 'Unsaved' || saveChipState.label === 'Saving') {
    return {
      animate: saveChipState.animate ?? false,
      detail: saveStateLabel,
      label: saveChipState.label === 'Saving' ? 'Saving' : 'Unsaved changes',
      rows,
      tone: saveChipState.tone
    }
  }

  return {
    animate: false,
    detail: 'Workflow, context, Codex runtime, and permissions are ready.',
    label: 'Ready',
    rows,
    tone: 'success'
  }
}
