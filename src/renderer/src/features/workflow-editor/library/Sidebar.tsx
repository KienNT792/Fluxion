import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, FileJson, Plus, Trash2 } from 'lucide-react'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import {
  createNewWorkflow,
  deleteCurrentWorkflow,
  switchWorkflow
} from '@renderer/lib/workflow-session'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { InputDialog } from '@renderer/components/ui/InputDialog'

function formatUpdatedAtLabel(updatedAt: string): string {
  const parsed = new Date(updatedAt)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function SidebarGlyph(): React.JSX.Element {
  return (
    <div
      className="relative flex h-8 w-8 items-center justify-center rounded-lg"
      style={{
        border: '1px solid var(--color-hairline-strong)',
        color: 'var(--color-primary)'
      }}
    >
      <span
        className="text-sm font-semibold"
        style={{ fontFamily: 'var(--font-mono)', letterSpacing: '-0.5px' }}
      >
        F
      </span>
      <span
        className="absolute bottom-[7px] left-[9px] h-px w-3"
        style={{ background: 'currentColor', opacity: 0.7 }}
      />
    </div>
  )
}

function CollapseButton({
  onClick,
  icon,
  ariaLabel
}: {
  onClick: () => void
  icon: React.ReactNode
  ariaLabel: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="absolute -right-3 top-6 z-50 flex h-6 w-6 items-center justify-center rounded-full transition-colors"
      style={{
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline-strong)',
        color: 'var(--color-muted)'
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.color = 'var(--color-ink)'
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.color = 'var(--color-muted)'
      }}
    >
      {icon}
    </button>
  )
}

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false)
  const [isCreateWorkflowDialogOpen, setIsCreateWorkflowDialogOpen] = useState(false)
  const [newWorkflowName, setNewWorkflowName] = useState('')
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false)
  const [pendingDeleteWorkflowName, setPendingDeleteWorkflowName] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const workflows = useWorkflowStore((state) => state.workflows)
  const activeWorkflowFilePath = useWorkflowStore((state) => state.activeWorkflowFilePath)

  const handleOpenCreateWorkflowDialog = (): void => {
    setNewWorkflowName('')
    setIsCreateWorkflowDialogOpen(true)
  }

  const handleConfirmCreateWorkflow = async (): Promise<void> => {
    const trimmedName = newWorkflowName.trim()
    if (!trimmedName || isCreatingWorkflow) {
      return
    }

    setIsCreatingWorkflow(true)
    try {
      await createNewWorkflow(trimmedName)
      setIsCreateWorkflowDialogOpen(false)
      setNewWorkflowName('')
    } finally {
      setIsCreatingWorkflow(false)
    }
  }

  const handleConfirmDelete = async (): Promise<void> => {
    if (!pendingDeleteWorkflowName || isDeleting) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteCurrentWorkflow()
      setPendingDeleteWorkflowName(null)
    } finally {
      setIsDeleting(false)
    }
  }

  if (collapsed) {
    return (
      <aside
        className="relative z-50 flex w-14 shrink-0 flex-col items-center py-4"
        style={{
          background: 'var(--color-canvas)',
          borderRight: '1px solid var(--color-hairline)'
        }}
      >
        <CollapseButton
          ariaLabel="Expand Library"
          onClick={() => setCollapsed(false)}
          icon={<ChevronRight size={13} />}
        />

        <div className="flex flex-col items-center gap-5">
          <SidebarGlyph />

          <button
            type="button"
            aria-label="Open Library"
            onClick={() => setCollapsed(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--color-muted)' }}
            title="Open Library"
            onMouseEnter={(event) => {
              event.currentTarget.style.background = 'var(--color-surface-card)'
              event.currentTarget.style.color = 'var(--color-ink)'
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent'
              event.currentTarget.style.color = 'var(--color-muted)'
            }}
          >
            <FileJson size={18} />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="relative z-50 flex w-64 shrink-0 flex-col"
      style={{
        background: 'var(--color-canvas)',
        borderRight: '1px solid var(--color-hairline)'
      }}
    >
      <CollapseButton
        ariaLabel="Collapse Library"
        onClick={() => setCollapsed(true)}
        icon={<ChevronLeft size={13} />}
      />

      <div
        className="flex h-16 shrink-0 items-center justify-between px-5"
        style={{ borderBottom: '1px solid var(--color-hairline)' }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <SidebarGlyph />
          <div className="min-w-0">
            <p
              className="text-[11px] uppercase"
              style={{
                color: 'var(--color-muted-soft)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.22em'
              }}
            >
              Library
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-muted)' }}>
              Workflow archive
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Create New Workflow"
          onClick={handleOpenCreateWorkflowDialog}
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
          style={{ color: 'var(--color-muted)' }}
          title="New Workflow"
          onMouseEnter={(event) => {
            event.currentTarget.style.background = 'var(--color-surface-card)'
            event.currentTarget.style.color = 'var(--color-ink)'
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = 'transparent'
            event.currentTarget.style.color = 'var(--color-muted)'
          }}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {workflows.length > 0 && (
          <div className="mb-2 px-2">
            <span
              className="text-[10px] uppercase tracking-[0.1em]"
              style={{ color: 'var(--color-muted-soft)', fontFamily: 'var(--font-mono)' }}
            >
              Workflows
            </span>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {workflows.map((workflow) => {
            const isActive = workflow.filePath === activeWorkflowFilePath
            const updatedAtLabel = formatUpdatedAtLabel(workflow.updatedAt)
            const displayWorkflowName = workflow.name.replace(/^\.fluxion\s*—\s*/, '')

            // Build stronger metadata string
            const metadataPieces: string[] = []
            if (updatedAtLabel) metadataPieces.push(`Updated ${updatedAtLabel}`)
            if (Array.isArray(workflow.tags) && workflow.tags.length > 0) {
              metadataPieces.push(workflow.tags.slice(0, 2).join(' / '))
            }

            const metadataLabel = metadataPieces.join(' · ')

            return (
              <div
                key={workflow.id}
                className="group relative overflow-hidden rounded-lg"
                style={{
                  background: isActive ? 'var(--color-surface-card)' : 'transparent',
                  border: isActive ? '1px solid var(--color-hairline)' : '1px solid transparent'
                }}
              >
                <button
                  type="button"
                  onClick={() => switchWorkflow(workflow.id)}
                  className="block w-full px-3 py-2 text-left transition-colors"
                  onMouseEnter={(event) => {
                    if (!isActive) {
                      event.currentTarget.style.background = 'var(--color-surface-strong)'
                    }
                  }}
                  onMouseLeave={(event) => {
                    if (!isActive) {
                      event.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  <div className="flex min-w-0 items-start gap-2.5 pr-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="truncate text-xs font-medium"
                          style={{
                            color: isActive ? 'var(--color-ink)' : 'var(--color-body)',
                            letterSpacing: '-0.1px'
                          }}
                        >
                          {displayWorkflowName}
                        </span>

                        {workflow.isLegacy && (
                          <span
                            className="shrink-0 text-[9px] uppercase"
                            style={{
                              color: 'var(--color-timeline-done)',
                              fontFamily: 'var(--font-mono)',
                              letterSpacing: '0.1em'
                            }}
                          >
                            Legacy
                          </span>
                        )}
                      </div>

                      {metadataLabel && (
                        <p
                          className={`mt-1 truncate text-[10px] transition-opacity ${
                            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          style={{
                            color: isActive ? 'var(--color-muted)' : 'var(--color-muted-soft)',
                            fontFamily: 'var(--font-sans)'
                          }}
                        >
                          {metadataLabel}
                        </p>
                      )}
                    </div>
                  </div>
                </button>

                {isActive && !workflow.isLegacy && (
                  <button
                    type="button"
                    aria-label={`Delete ${displayWorkflowName}`}
                    onClick={() => {
                      setPendingDeleteWorkflowName(workflow.name)
                    }}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition-all group-hover:opacity-100"
                    style={{ color: 'var(--color-muted)' }}
                    title="Delete workflow"
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = 'var(--color-canvas)'
                      event.currentTarget.style.color = 'var(--color-semantic-error)'
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = 'transparent'
                      event.currentTarget.style.color = 'var(--color-muted)'
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )
          })}

          {workflows.length === 0 && (
            <div
              className="rounded-xl px-4 py-6 text-center"
              style={{
                background: 'var(--color-surface-card)',
                color: 'var(--color-muted)'
              }}
            >
              <p
                className="text-[11px] uppercase"
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.18em' }}
              >
                Empty Library
              </p>
              <p className="mt-2 text-xs" style={{ color: 'var(--color-muted-soft)' }}>
                Create a workflow to begin building your archive.
              </p>
            </div>
          )}
        </div>
      </div>

      <InputDialog
        isOpen={isCreateWorkflowDialogOpen}
        title="Create New Workflow"
        description="Enter a workflow name for the library."
        value={newWorkflowName}
        placeholder="e.g. Refactor auth adapter"
        confirmLabel={isCreatingWorkflow ? 'Creating...' : 'Create'}
        cancelLabel="Cancel"
        confirmDisabled={isCreatingWorkflow || !newWorkflowName.trim()}
        onValueChange={setNewWorkflowName}
        onCancel={() => {
          if (isCreatingWorkflow) {
            return
          }

          setIsCreateWorkflowDialogOpen(false)
          setNewWorkflowName('')
        }}
        onConfirm={handleConfirmCreateWorkflow}
      />

      <ConfirmDialog
        isOpen={pendingDeleteWorkflowName != null}
        title="Delete workflow"
        description={
          pendingDeleteWorkflowName
            ? `Delete "${pendingDeleteWorkflowName}" from this workspace? This action cannot be undone.`
            : ''
        }
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        cancelLabel="Cancel"
        confirmDisabled={isDeleting}
        onCancel={() => {
          if (isDeleting) {
            return
          }

          setPendingDeleteWorkflowName(null)
        }}
        onConfirm={handleConfirmDelete}
      />
    </aside>
  )
}
