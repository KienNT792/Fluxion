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
