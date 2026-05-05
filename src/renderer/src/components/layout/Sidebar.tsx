import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, FileJson, Plus, Trash2 } from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflow.store';
import {
  createNewWorkflow,
  deleteCurrentWorkflow,
  switchWorkflow,
} from '../../lib/workflow-session';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { InputDialog } from '../ui/InputDialog';

function formatUpdatedAtLabel(updatedAt: string): string {
  const parsed = new Date(updatedAt);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildMetadataLabel(updatedAtLabel: string, tags?: string[]): string {
  const pieces: string[] = [];

  if (updatedAtLabel) {
    pieces.push(`Updated ${updatedAtLabel}`);
  }

  if (Array.isArray(tags) && tags.length > 0) {
    pieces.push(tags.slice(0, 2).join(' / '));
  }

  return pieces.join('  •  ');
}

function SidebarGlyph(): React.JSX.Element {
  return (
    <div
      className="relative flex h-8 w-8 items-center justify-center rounded-lg"
      style={{
        border: '1px solid var(--color-hairline-strong)',
        color: 'var(--color-primary)',
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
  );
}

function CollapseButton({
  onClick,
  icon,
}: {
  onClick: () => void;
  icon: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute -right-3 top-6 z-50 flex h-6 w-6 items-center justify-center rounded-full transition-colors"
      style={{
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline-strong)',
        color: 'var(--color-muted)',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.color = 'var(--color-ink)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.color = 'var(--color-muted)';
      }}
    >
      {icon}
    </button>
  );
}

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [isCreateWorkflowDialogOpen, setIsCreateWorkflowDialogOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [pendingDeleteWorkflowName, setPendingDeleteWorkflowName] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const workflows = useWorkflowStore((state) => state.workflows);
  const activeWorkflowFilePath = useWorkflowStore((state) => state.activeWorkflowFilePath);

  const handleOpenCreateWorkflowDialog = (): void => {
    setNewWorkflowName('');
    setIsCreateWorkflowDialogOpen(true);
  };

  const handleConfirmCreateWorkflow = async (): Promise<void> => {
    const trimmedName = newWorkflowName.trim();
    if (!trimmedName || isCreatingWorkflow) {
      return;
    }

    setIsCreatingWorkflow(true);
    try {
      await createNewWorkflow(trimmedName);
      setIsCreateWorkflowDialogOpen(false);
      setNewWorkflowName('');
    } finally {
      setIsCreatingWorkflow(false);
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!pendingDeleteWorkflowName || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteCurrentWorkflow();
      setPendingDeleteWorkflowName(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (collapsed) {
    return (
      <aside
        className="relative z-50 flex w-14 shrink-0 flex-col items-center py-4"
        style={{
          background: 'var(--color-canvas)',
          borderRight: '1px solid var(--color-hairline)',
        }}
      >
        <CollapseButton onClick={() => setCollapsed(false)} icon={<ChevronRight size={13} />} />

        <div className="flex flex-col items-center gap-5">
          <SidebarGlyph />

          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--color-muted)' }}
            title="Open Library"
            onMouseEnter={(event) => {
              event.currentTarget.style.background = 'var(--color-surface-card)';
              event.currentTarget.style.color = 'var(--color-ink)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent';
              event.currentTarget.style.color = 'var(--color-muted)';
            }}
          >
            <FileJson size={18} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="relative z-50 flex w-64 shrink-0 flex-col"
      style={{
        background: 'var(--color-canvas)',
        borderRight: '1px solid var(--color-hairline)',
      }}
    >
      <CollapseButton onClick={() => setCollapsed(true)} icon={<ChevronLeft size={13} />} />

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
                letterSpacing: '0.22em',
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
          onClick={handleOpenCreateWorkflowDialog}
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
          style={{ color: 'var(--color-muted)' }}
          title="New Workflow"
          onMouseEnter={(event) => {
            event.currentTarget.style.background = 'var(--color-surface-card)';
            event.currentTarget.style.color = 'var(--color-ink)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = 'transparent';
            event.currentTarget.style.color = 'var(--color-muted)';
          }}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-2">
          {workflows.map((workflow) => {
            const isActive = workflow.filePath === activeWorkflowFilePath;
            const updatedAtLabel = formatUpdatedAtLabel(workflow.updatedAt);
            const metadataLabel = buildMetadataLabel(updatedAtLabel, workflow.tags);

            return (
              <button
                key={workflow.id}
                type="button"
                onClick={() => switchWorkflow(workflow.id)}
                className="group relative overflow-hidden rounded-xl px-4 py-3 text-left transition-colors"
                style={{
                  background: isActive ? 'var(--color-surface-card)' : 'transparent',
                }}
                onMouseEnter={(event) => {
                  if (!isActive) {
                    event.currentTarget.style.background = 'var(--color-surface-card)';
                  }
                }}
                onMouseLeave={(event) => {
                  if (!isActive) {
                    event.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {isActive && (
                  <span
                    className="absolute bottom-3 left-0 top-3 w-0.5 rounded-full"
                    style={{ background: 'var(--color-primary)' }}
                  />
                )}

                {isActive && !workflow.isLegacy && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPendingDeleteWorkflowName(workflow.name);
                    }}
                    className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition-all group-hover:opacity-100"
                    style={{ color: 'var(--color-muted)' }}
                    title="Delete workflow"
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = 'var(--color-canvas)';
                      event.currentTarget.style.color = 'var(--color-semantic-error)';
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = 'transparent';
                      event.currentTarget.style.color = 'var(--color-muted)';
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}

                <div className="flex min-w-0 items-start gap-2.5 pr-8">
                  <FileJson
                    size={14}
                    className="mt-0.5 shrink-0"
                    style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-muted)' }}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="truncate text-[13px] font-semibold"
                        style={{ color: 'var(--color-ink)', letterSpacing: '-0.1px' }}
                      >
                        {workflow.name}
                      </span>

                      {workflow.isLegacy && (
                        <span
                          className="shrink-0 text-[9px] uppercase"
                          style={{
                            color: 'var(--color-timeline-done)',
                            fontFamily: 'var(--font-mono)',
                            letterSpacing: '0.1em',
                          }}
                        >
                          Legacy
                        </span>
                      )}
                    </div>

                    {workflow.description && (
                      <p
                        className="mt-1 truncate text-[11px]"
                        style={{ color: 'var(--color-muted-soft)' }}
                      >
                        {workflow.description}
                      </p>
                    )}

                    {metadataLabel && (
                      <p
                        className={`mt-2 truncate text-[10px] uppercase tracking-[0.08em] transition-opacity ${
                          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                        style={{
                          color: 'var(--color-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {metadataLabel}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {workflows.length === 0 && (
            <div
              className="rounded-xl px-4 py-6 text-center"
              style={{
                background: 'var(--color-surface-card)',
                color: 'var(--color-muted)',
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
            return;
          }

          setIsCreateWorkflowDialogOpen(false);
          setNewWorkflowName('');
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
            return;
          }

          setPendingDeleteWorkflowName(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </aside>
  );
};
