import React from 'react'
import { AlertTriangle, CheckCircle2, Circle, FolderOpen, LoaderCircle } from 'lucide-react'
import { WorkspaceLoadingEvent } from '@shared'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { Button } from '@renderer/components/ui/Button'

const LOADING_STEPS: Array<{ step: WorkspaceLoadingEvent['step']; label: string }> = [
  { step: 'init', label: 'Initialize workspace' },
  { step: 'loadWorkflows', label: 'Load workflows' },
  { step: 'loadContext', label: 'Prepare context' },
  { step: 'watcher', label: 'Start watcher' }
]

function getEventForStep(
  events: WorkspaceLoadingEvent[],
  step: WorkspaceLoadingEvent['step']
): WorkspaceLoadingEvent | undefined {
  return events.find((event) => event.step === step)
}

function getWorkspaceDisplayName(workspacePath?: string): string {
  if (!workspacePath) {
    return 'Workspace'
  }

  const segments = workspacePath.split(/[/\\]/).filter(Boolean)
  return segments[segments.length - 1] ?? workspacePath
}

export const WorkspaceOpeningOverlay: React.FC = () => {
  const openState = useWorkflowStore((state) => state.workspaceOpenState)
  const loadingEvents = useWorkflowStore((state) => state.workspaceLoadingEvents)
  const loadingPath = useWorkflowStore((state) => state.workspaceLoadingPath)
  const loadingError = useWorkflowStore((state) => state.workspaceLoadingError)
  const setWorkspaceOpenState = useWorkflowStore((state) => state.setWorkspaceOpenState)
  const resetWorkspaceLoadingEvents = useWorkflowStore((state) => state.resetWorkspaceLoadingEvents)

  if (openState.phase !== 'opening' && openState.phase !== 'error') {
    return null
  }

  const workspacePath = openState.workspacePath ?? loadingPath ?? undefined
  const errorMessage = openState.error ?? loadingError
  const hasProgressEvents = loadingEvents.some((event) => event.step !== 'ready')

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center px-4 py-6"
      style={{ background: 'var(--color-canvas)' }}
      role="status"
      aria-live="polite"
    >
      <div
        className="w-full max-w-lg rounded-lg px-5 py-5 sm:px-6"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)'
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: 'var(--color-canvas-soft)',
              border: '1px solid var(--color-hairline)',
              color: errorMessage ? 'var(--color-semantic-error)' : 'var(--color-primary)'
            }}
          >
            {errorMessage ? <AlertTriangle size={18} /> : <FolderOpen size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-ink)' }}>
              {errorMessage ? 'Workspace failed to open' : 'Opening workspace...'}
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
              {getWorkspaceDisplayName(workspacePath)}
            </p>
            {workspacePath ? (
              <p
                className="mt-2 truncate rounded-md px-3 py-2 text-[11px]"
                title={workspacePath}
                style={{
                  background: 'var(--color-canvas-soft)',
                  border: '1px solid var(--color-hairline)',
                  color: 'var(--color-body)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {workspacePath}
              </p>
            ) : null}
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4">
            <p className="text-sm leading-5" style={{ color: 'var(--color-semantic-error)' }}>
              {errorMessage}
            </p>
            <div className="mt-4 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  resetWorkspaceLoadingEvents()
                  setWorkspaceOpenState({ phase: 'idle' })
                }}
              >
                Close
              </Button>
            </div>
          </div>
        ) : hasProgressEvents ? (
          <div className="mt-5 grid gap-2">
            {LOADING_STEPS.map(({ step, label }) => {
              const event = getEventForStep(loadingEvents, step)
              const status = event?.status ?? 'active'
              const isActive = status === 'active' && event != null
              const isDone = status === 'done'
              const isError = status === 'error'

              return (
                <div
                  key={step}
                  className="flex min-w-0 items-center gap-3 rounded-md px-3 py-2"
                  style={{
                    background: 'var(--color-canvas-soft)',
                    border: '1px solid var(--color-hairline)'
                  }}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center"
                    style={{
                      color: isError
                        ? 'var(--color-semantic-error)'
                        : isDone
                          ? 'var(--color-semantic-success)'
                          : isActive
                            ? 'var(--color-primary)'
                            : 'var(--color-muted-soft)'
                    }}
                  >
                    {isError ? (
                      <AlertTriangle size={15} />
                    ) : isDone ? (
                      <CheckCircle2 size={15} />
                    ) : isActive ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <Circle size={14} />
                    )}
                  </span>
                  <span className="min-w-0 truncate text-sm" style={{ color: 'var(--color-ink)' }}>
                    {event?.message ?? label}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm leading-5" style={{ color: 'var(--color-muted)' }}>
            Preparing the workspace session.
          </p>
        )}
      </div>
    </div>
  )
}
