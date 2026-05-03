import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, FileJson, Plus, Check, X, Trash2 } from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflow.store';
import { createNewWorkflow, switchWorkflow, deleteCurrentWorkflow } from '../../lib/workflow-session';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';

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

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [pendingDeleteWorkflowName, setPendingDeleteWorkflowName] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const workflows = useWorkflowStore((state) => state.workflows);
  const activeWorkflowFilePath = useWorkflowStore((state) => state.activeWorkflowFilePath);

  const handleCreate = async () => {
    if (!newWorkflowName.trim()) {
      setIsCreating(false);
      return;
    }
    await createNewWorkflow(newWorkflowName.trim());
    setNewWorkflowName('');
    setIsCreating(false);
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

  const collapseBtn = (onClick: () => void, icon: React.ReactNode): React.JSX.Element => (
    <button
      onClick={onClick}
      className="absolute -right-3 top-6 z-50 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
      style={{
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline-strong)',
        color: 'var(--color-muted)',
        boxShadow: 'none',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)';
      }}
    >
      {icon}
    </button>
  );

  if (collapsed) {
    return (
      <aside
        className="w-14 flex flex-col items-center py-4 relative z-50 flex-shrink-0"
        style={{
          background: 'var(--color-canvas)',
          borderRight: '1px solid var(--color-hairline)',
        }}
      >
        {collapseBtn(() => setCollapsed(false), <ChevronRight size={13} />)}

        {/* Wordmark initial */}
        <span
          className="font-bold text-base mb-6 font-mono"
          style={{ color: 'var(--color-primary)', letterSpacing: '-0.5px' }}
        >
          F
        </span>

        <div className="flex flex-col gap-3">
          <div
            className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer"
            style={{
              background: 'transparent',
              color: 'var(--color-muted)',
            }}
            title="Workflows"
            onClick={() => setCollapsed(false)}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-strong)';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)';
            }}
          >
            <FileJson size={18} />
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="w-60 flex flex-col relative z-50 flex-shrink-0"
      style={{
        background: 'var(--color-canvas)',
        borderRight: '1px solid var(--color-hairline)',
      }}
    >
      {collapseBtn(() => setCollapsed(true), <ChevronLeft size={13} />)}

      {/* Header */}
      <div
        className="px-5 h-14 flex items-center gap-2.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-hairline)' }}
      >
        <div
          className="w-6 h-6 rounded flex items-center justify-center font-bold font-mono text-xs"
          style={{
            background: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
          }}
        >
          F
        </div>
        <h1
          className="font-semibold text-sm tracking-tight flex-1"
          style={{ color: 'var(--color-ink)', letterSpacing: '-0.2px' }}
        >
          Fluxion
        </h1>
        
        <button
          onClick={() => {
            setIsCreating(true);
            setNewWorkflowName('');
          }}
          className="w-6 h-6 rounded flex items-center justify-center transition-colors"
          style={{ color: 'var(--color-muted)' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-strong)';
            (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)';
          }}
          title="New Workflow"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Workflows Library */}
      <div className="p-4 flex-1 overflow-y-auto">
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'var(--color-muted-soft)', letterSpacing: '0.88px', fontSize: '11px' }}
        >
          Workflows
        </p>
        
        <div className="flex flex-col gap-1.5">
          {isCreating && (
            <div className="flex items-center gap-1 mb-2">
              <Input
                autoFocus
                size="sm"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') setIsCreating(false);
                }}
                placeholder="Workflow name..."
                className="flex-1"
              />
              <button 
                onClick={handleCreate}
                className="p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-strong)] transition-colors"
              >
                <Check size={14} />
              </button>
              <button 
                onClick={() => setIsCreating(false)}
                className="p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-strong)] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {workflows.map((wf) => {
            const isActive = wf.filePath === activeWorkflowFilePath;
            const updatedAtLabel = formatUpdatedAtLabel(wf.updatedAt);
            const tagsLabel = wf.tags?.slice(0, 2).join(' | ');
            return (
              <div
                key={wf.id}
                onClick={() => switchWorkflow(wf.id)}
                className="group flex flex-col gap-1 px-3 py-2.5 rounded-lg cursor-pointer transition-colors relative"
                style={{
                  background: isActive ? 'var(--color-surface-strong)' : 'transparent',
                  border: isActive 
                    ? '1px dashed var(--color-hairline-strong)' 
                    : '1px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-card)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileJson 
                      size={14} 
                      className="flex-shrink-0" 
                      style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-muted)' }} 
                    />
                    <span 
                      className="text-[13px] font-medium truncate"
                      style={{ color: isActive ? 'var(--color-ink)' : 'var(--color-muted-strong)' }}
                    >
                      {wf.name}
                    </span>
                    {wf.isLegacy && (
                      <span 
                        className="text-[9px] uppercase font-bold px-1 rounded flex-shrink-0"
                        style={{ 
                          background: 'var(--color-surface-card)',
                          color: 'var(--color-warning)',
                          border: '1px solid var(--color-warning-soft)'
                        }}
                      >
                        Legacy
                      </span>
                    )}
                  </div>
                  
                  {/* Delete button (only show on hover, and only if not legacy) */}
                  {isActive && !wf.isLegacy && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDeleteWorkflowName(wf.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-card)]"
                      title="Delete workflow"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {wf.description && (
                  <p className="text-[11px] truncate pl-6" style={{ color: 'var(--color-muted)' }}>
                    {wf.description}
                  </p>
                )}

                {(updatedAtLabel || tagsLabel) && (
                  <div
                    className="flex items-center gap-1.5 pl-6 text-[10px] uppercase tracking-[0.06em]"
                    style={{ color: 'var(--color-muted-soft)' }}
                  >
                    {updatedAtLabel && <span className="truncate">Updated {updatedAtLabel}</span>}
                    {updatedAtLabel && tagsLabel && <span>|</span>}
                    {tagsLabel && <span className="truncate">{tagsLabel}</span>}
                  </div>
                )}
              </div>
            );
          })}

          {workflows.length === 0 && !isCreating && (
            <div
              className="text-[13px] italic px-2 py-3 rounded text-center"
              style={{ color: 'var(--color-muted)', border: '1px dashed var(--color-hairline-strong)' }}
            >
              No workflows found
            </div>
          )}
        </div>
      </div>

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
          if (isDeleting) return;
          setPendingDeleteWorkflowName(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </aside>
  );
};
