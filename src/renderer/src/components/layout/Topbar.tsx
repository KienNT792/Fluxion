import React, { useState } from 'react';
import {
  AlertTriangle,
  FolderOpen,
  Moon,
  Plus,
  Play,
  Save,
  Settings,
  Square,
  Sun,
} from 'lucide-react';
import { useExecutionStore } from '../../stores/execution.store';
import { useWorkflowStore } from '../../stores/workflow.store';
import { useThemeStore } from '../../stores/theme.store';
import {
  createNewWorkflow,
  openWorkspaceFromDialog,
  reloadCurrentWorkspaceFromDisk,
  runCurrentWorkflow,
  saveCurrentWorkflow,
} from '../../lib/workflow-session';
import { Button } from '../ui/Button';
import { GlobalSettingsDialog } from './GlobalSettingsDialog';
import { InputDialog } from '../ui/InputDialog';
import { Tooltip } from '../ui/Tooltip';

const CHIP_SURFACE_STYLE: React.CSSProperties = {
  background: 'var(--color-surface-card)',
  border: '1px solid var(--color-hairline)',
};

const INFO_CHIP_STYLE: React.CSSProperties = {
  ...CHIP_SURFACE_STYLE,
  color: 'var(--color-body)',
  cursor: 'default',
};

const CHANGE_VISIBILITY_CLASS_NAMES = ['hidden xl:inline-flex', 'hidden 2xl:inline-flex'];

function formatSavedLabel(lastSavedAt: string | null): string {
  if (!lastSavedAt) {
    return 'Saved';
  }

  return `Saved ${new Date(lastSavedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`;
}

function getChangeToken(changeType: 'add' | 'change' | 'unlink'): string {
  if (changeType === 'add') {
    return 'A';
  }

  if (changeType === 'unlink') {
    return 'D';
  }

  return 'M';
}

export const Topbar: React.FC = () => {
  const [isCreateWorkflowDialogOpen, setIsCreateWorkflowDialogOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const workflowStatus = useExecutionStore((state) => state.workflowStatus);
  const workflowError = useExecutionStore((state) => state.workflowError);
  const setWorkflowError = useExecutionStore((state) => state.setWorkflowError);
  const setWorkflowStatus = useExecutionStore((state) => state.setWorkflowStatus);
  const nodes = useWorkflowStore((state) => state.nodes);
  const workspacePath = useWorkflowStore((state) => state.workspacePath);
  const workspaceName = workspacePath
    ? workspacePath.split(/[/\\]/).filter(Boolean).pop()
    : 'No workspace';
  const isDirty = useWorkflowStore((state) => state.isDirty);
  const isSaving = useWorkflowStore((state) => state.isSaving);
  const saveError = useWorkflowStore((state) => state.saveError);
  const lastSavedAt = useWorkflowStore((state) => state.lastSavedAt);
  const hasExternalWorkflowChange = useWorkflowStore(
    (state) => state.hasExternalWorkflowChange
  );
  const recentWorkspaceChanges = useWorkflowStore((state) => state.recentWorkspaceChanges);
  const { theme, toggleTheme } = useThemeStore();

  const handleRun = (): void => {
    runCurrentWorkflow();
  };

  const handleOpenWorkspace = async (): Promise<void> => {
    try {
      await openWorkspaceFromDialog();
      setWorkflowError(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to open workspace.';
      setWorkflowError(errorMessage);
    }
  };

  const handleSave = async (): Promise<void> => {
    try {
      await saveCurrentWorkflow();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save workflow.';
      setWorkflowError(errorMessage);
    }
  };

  const handleOpenCreateWorkflowDialog = (): void => {
    if (!workspacePath || isRunning) {
      return;
    }

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
      setWorkflowError(null);
      setIsCreateWorkflowDialogOpen(false);
      setNewWorkflowName('');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create workflow.';
      setWorkflowError(errorMessage);
    } finally {
      setIsCreatingWorkflow(false);
    }
  };

  const handleReload = async (): Promise<void> => {
    try {
      await reloadCurrentWorkspaceFromDisk();
      setWorkflowError(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to reload workflow from disk.';
      setWorkflowError(errorMessage);
    }
  };

  const handleAbort = (): void => {
    setWorkflowStatus('aborted');
    setWorkflowError('Workflow aborted by user.');
    window.api.abortWorkflow();
  };

  const isRunning = workflowStatus === 'running';
  const canRun = Boolean(workspacePath) && nodes.length > 0 && !isRunning;
  const canSave = Boolean(workspacePath) && isDirty && !isSaving;
  const visibleWorkspaceChanges = recentWorkspaceChanges.slice(0, 2);

  const saveStateLabel = isSaving
    ? 'Saving...'
    : saveError
      ? 'Save failed'
      : isDirty
        ? 'Unsaved'
        : formatSavedLabel(lastSavedAt);

  const saveStateColor = isSaving
    ? 'var(--color-primary)'
    : saveError
      ? 'var(--color-semantic-error)'
      : isDirty
        ? 'var(--color-timeline-done)'
        : 'var(--color-semantic-success)';

  return (
    <header
      className="relative z-40 flex shrink-0 flex-col gap-3 px-4 py-3 sm:px-5 lg:min-h-14 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-2"
      style={{
        background: 'var(--color-canvas)',
        borderBottom: '1px solid var(--color-hairline)',
      }}
    >
      <div
        className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm"
        style={{ color: 'var(--color-muted)' }}
      >
        <Tooltip content={workspacePath || 'No workspace'}>
          <span
            className="inline-block max-w-full truncate rounded-md px-2 py-1 font-mono text-xs leading-none sm:max-w-[280px] xl:max-w-[360px]"
            style={INFO_CHIP_STYLE}
          >
            {workspaceName}
          </span>
        </Tooltip>

        <Tooltip content={saveError || saveStateLabel}>
          <span
            className="rounded-md px-2 py-1 text-[11px] font-semibold leading-none"
            style={{
              ...CHIP_SURFACE_STYLE,
              color: saveStateColor,
            }}
          >
            {saveStateLabel}
          </span>
        </Tooltip>

        {workflowStatus !== 'idle' && (
          <span
            className="hidden items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] md:inline-flex"
            style={{ color: 'var(--color-muted)' }}
          >
            Status:
            <span
              className="font-semibold"
              style={{
                color:
                  workflowStatus === 'running'
                    ? 'var(--color-timeline-done)'
                    : workflowStatus === 'completed'
                      ? 'var(--color-semantic-success)'
                      : 'var(--color-semantic-error)',
              }}
            >
              {workflowStatus.toUpperCase()}
            </span>
          </span>
        )}

        {hasExternalWorkflowChange && (
          <Tooltip
            content={
              isRunning
                ? 'Abort the current workflow before reloading from disk'
                : 'The workflow file changed on disk. Reload from disk.'
            }
          >
            <Button
              variant="danger"
              size="sm"
              className="shrink-0"
              onClick={handleReload}
              disabled={isRunning}
            >
              <AlertTriangle size={14} />
              <span className="hidden sm:inline">Reload from disk</span>
              <span className="sm:hidden">Reload</span>
            </Button>
          </Tooltip>
        )}

        {visibleWorkspaceChanges.map((change, index) => (
          <Tooltip
            key={`${change.relativePath}-${change.receivedAt}`}
            content={`${change.changeType.toUpperCase()} ${change.relativePath}`}
          >
            <span
              className={`${CHANGE_VISIBILITY_CLASS_NAMES[index] ?? 'hidden 2xl:inline-flex'} max-w-[220px] items-center gap-1.5 rounded-md px-2 py-1 text-[11px] leading-none`}
              style={{
                ...CHIP_SURFACE_STYLE,
                color: 'var(--color-muted)',
                cursor: 'default',
              }}
            >
              <span style={{ color: 'var(--color-primary)' }}>
                {getChangeToken(change.changeType)}
              </span>
              <span className="truncate">{change.relativePath}</span>
            </span>
          </Tooltip>
        ))}

        {workflowError && (
          <Tooltip content={workflowError}>
            <span
              className="basis-full truncate text-xs xl:basis-auto xl:max-w-[320px]"
              style={{ color: 'var(--color-semantic-error)' }}
            >
              {workflowError}
            </span>
          </Tooltip>
        )}
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap lg:justify-end">
        <Tooltip
          content={
            isRunning
              ? 'Abort the current workflow before switching workspace'
              : 'Open Workspace'
          }
        >
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={handleOpenWorkspace}
            disabled={isRunning}
          >
            <FolderOpen size={14} />
            <span className="hidden md:inline">Open Workspace</span>
            <span className="md:hidden">Open</span>
          </Button>
        </Tooltip>

        <Tooltip
          content={
            !workspacePath
              ? 'Open a workspace first'
              : isRunning
                ? 'Abort the current workflow before creating a new workflow'
                : 'Create new workflow'
          }
        >
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={handleOpenCreateWorkflowDialog}
            disabled={!workspacePath || isRunning}
          >
            <Plus size={14} />
            <span className="hidden md:inline">New Workflow</span>
            <span className="md:hidden">New</span>
          </Button>
        </Tooltip>

        <Tooltip
          content={
            !workspacePath
              ? 'Open a workspace first'
              : isDirty
                ? 'Save workflow.json now'
                : 'Workflow is already saved'
          }
        >
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={handleSave}
            disabled={!canSave}
          >
            <Save size={14} />
            Save
          </Button>
        </Tooltip>

        <Tooltip
          content="Global Settings"
        >
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={() => setIsSettingsOpen(true)}
            disabled={isRunning}
          >
            <Settings size={14} />
            <span className="hidden md:inline">Settings</span>
            <span className="md:hidden">Config</span>
          </Button>
        </Tooltip>

        <Tooltip
          content={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
        </Tooltip>

        <div
          className="mx-1 hidden h-5 w-px sm:block"
          style={{ background: 'var(--color-hairline)' }}
        />

        {!isRunning ? (
          <Tooltip
            content={
              !workspacePath
                ? 'Open a workspace first'
                : nodes.length === 0
                  ? 'Add at least one node'
                  : 'Run workflow'
            }
          >
            <Button
              variant="primary"
              className="min-w-[88px] shrink-0"
              onClick={handleRun}
              disabled={!canRun}
            >
              <Play size={14} fill="currentColor" />
              Run
            </Button>
          </Tooltip>
        ) : (
          <Tooltip content="Abort current workflow">
            <Button
              variant="danger"
              className="min-w-[88px] shrink-0"
              onClick={handleAbort}
            >
              <Square size={14} fill="currentColor" />
              Abort
            </Button>
          </Tooltip>
        )}
      </div>

      <InputDialog
        isOpen={isCreateWorkflowDialogOpen}
        title="Create New Workflow"
        description="Enter a workflow name. Fluxion will create the file and switch to it."
        value={newWorkflowName}
        placeholder="e.g. Refactor auth adapter"
        confirmLabel={isCreatingWorkflow ? 'Creating...' : 'Create'}
        cancelLabel="Cancel"
        confirmDisabled={isCreatingWorkflow || !newWorkflowName.trim()}
        onValueChange={setNewWorkflowName}
        onCancel={() => {
          if (isCreatingWorkflow) return;
          setIsCreateWorkflowDialogOpen(false);
          setNewWorkflowName('');
        }}
        onConfirm={handleConfirmCreateWorkflow}
      />

      <GlobalSettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </header>
  );
};
