import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  ExternalLink,
  Files,
  FolderOpen,
  Moon,
  Play,
  Plus,
  Save,
  Settings,
  Square,
  Sun,
} from 'lucide-react';
import { useExecutionStore } from '../../stores/execution.store';
import { useThemeStore } from '../../stores/theme.store';
import { useWorkflowStore } from '../../stores/workflow.store';
import { getCodexReadinessBadgeState } from '../../lib/provider-capabilities';
import {
  createNewWorkflow,
  openWorkspaceFromDialog,
  reloadCurrentWorkspaceFromDisk,
  runCurrentWorkflow,
  saveCurrentWorkflow,
} from '../../lib/workflow-session';
import { BinarySwitch } from '../ui/BinarySwitch';
import { Button } from '../ui/Button';
import { splitDisplayPath } from '../ui/FilePathCard';
import { InputDialog } from '../ui/InputDialog';
import { StatusChip, StatusChipTone } from '../ui/StatusChip';
import { Tooltip } from '../ui/Tooltip';
import { GlobalSettingsDialog } from './GlobalSettingsDialog';

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function formatSavedLabel(lastSavedAt: string | null): string {
  if (!lastSavedAt) {
    return 'Saved recently';
  }

  return `Saved ${new Date(lastSavedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`;
}

function formatChangeTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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

function getChangeTokenColor(changeType: 'add' | 'change' | 'unlink'): string {
  if (changeType === 'add') {
    return 'var(--color-status-completed)';
  }

  if (changeType === 'unlink') {
    return 'var(--color-semantic-error)';
  }

  return 'var(--color-timeline-read)';
}

function getWorkflowChipState(
  workflowStatus: 'idle' | 'running' | 'paused' | 'aborted' | 'completed' | 'error'
): {
  label: string;
  tone: StatusChipTone;
  animate: boolean;
} {
  if (workflowStatus === 'running') {
    return { label: 'Executing', tone: 'running', animate: true };
  }

  if (workflowStatus === 'completed') {
    return { label: 'Completed', tone: 'completed', animate: false };
  }

  if (workflowStatus === 'paused') {
    return { label: 'Awaiting Review', tone: 'paused', animate: false };
  }

  if (workflowStatus === 'aborted') {
    return { label: 'Aborted', tone: 'stopping', animate: false };
  }

  if (workflowStatus === 'error') {
    return { label: 'Error', tone: 'error', animate: false };
  }

  return { label: 'Ready', tone: 'idle', animate: false };
}

function getSaveChipState(
  isDirty: boolean,
  isSaving: boolean,
  saveError: string | null
): {
  label: string;
  tone: StatusChipTone;
  animate: boolean;
} {
  if (saveError) {
    return { label: 'Save failed', tone: 'error', animate: false };
  }

  if (isSaving) {
    return { label: 'Saving', tone: 'running', animate: true };
  }

  if (isDirty) {
    return { label: 'Unsaved', tone: 'warning', animate: false };
  }

  return { label: 'Saved', tone: 'success', animate: false };
}

interface ActionTextButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  dimmed?: boolean;
}

const ActionTextButton = React.forwardRef<HTMLButtonElement, ActionTextButtonProps>(
  ({ className = '', dimmed = false, disabled = false, children, style, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-ink)] ${className}`}
      style={{
        color: disabled ? 'var(--color-muted-soft)' : 'var(--color-muted)',
        opacity: dimmed ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
);

ActionTextButton.displayName = 'ActionTextButton';

const ActionIconButton = React.forwardRef<HTMLButtonElement, ActionTextButtonProps>(
  ({ className = '', dimmed = false, disabled = false, children, style, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={`relative inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-ink)] ${className}`}
      style={{
        color: disabled ? 'var(--color-muted-soft)' : 'var(--color-muted)',
        opacity: dimmed ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
);

ActionIconButton.displayName = 'ActionIconButton';

const POPOVER_SURFACE_STYLE: React.CSSProperties = {
  background: 'var(--color-surface-card)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: '0 18px 40px rgba(38, 37, 30, 0.16)',
};

const ActivityFileAction: React.FC<{
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}> = ({ label, onClick, children }) => (
  <Tooltip content={label}>
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-canvas)]"
      style={{ color: 'var(--color-muted)' }}
    >
      {children}
    </button>
  </Tooltip>
);

export const Topbar: React.FC = () => {
  const [isCreateWorkflowDialogOpen, setIsCreateWorkflowDialogOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isActivityPopoverOpen, setIsActivityPopoverOpen] = useState(false);
  const [isReadinessPopoverOpen, setIsReadinessPopoverOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const runStartedAtRef = useRef<number | null>(null);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const activityPopoverRef = useRef<HTMLDivElement | null>(null);
  const readinessPopoverRef = useRef<HTMLDivElement | null>(null);

  const workflowStatus = useExecutionStore((state) => state.workflowStatus);
  const workflowError = useExecutionStore((state) => state.workflowError);
  const setWorkflowError = useExecutionStore((state) => state.setWorkflowError);
  const setWorkflowStatus = useExecutionStore((state) => state.setWorkflowStatus);

  const nodes = useWorkflowStore((state) => state.nodes);
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities);
  const isProviderCapabilitiesLoading = useWorkflowStore(
    (state) => state.isProviderCapabilitiesLoading
  );
  const fetchProviderCapabilities = useWorkflowStore((state) => state.fetchProviderCapabilities);
  const executionMode = useWorkflowStore((state) => state.executionMode);
  const workspacePath = useWorkflowStore((state) => state.workspacePath);
  const workflowName = useWorkflowStore((state) => state.workflowName);
  const isDirty = useWorkflowStore((state) => state.isDirty);
  const isSaving = useWorkflowStore((state) => state.isSaving);
  const saveError = useWorkflowStore((state) => state.saveError);
  const lastSavedAt = useWorkflowStore((state) => state.lastSavedAt);
  const hasExternalWorkflowChange = useWorkflowStore(
    (state) => state.hasExternalWorkflowChange
  );
  const recentWorkspaceChanges = useWorkflowStore((state) => state.recentWorkspaceChanges);
  const setExecutionMode = useWorkflowStore((state) => state.setExecutionMode);

  const { theme, toggleTheme } = useThemeStore();

  const workspaceName = workspacePath
    ? workspacePath.split(/[/\\]/).filter(Boolean).pop() ?? 'Workspace'
    : 'Workspace';

  const isRunning = workflowStatus === 'running';
  const isPaused = workflowStatus === 'paused';
  const isBusy = isRunning || isPaused;
  const canRun = Boolean(workspacePath) && nodes.length > 0 && !isBusy;
  const canSave = Boolean(workspacePath) && isDirty && !isSaving;
  const editingDimmed = isBusy;
  const workflowChipState = getWorkflowChipState(workflowStatus);
  const changeCount = recentWorkspaceChanges.length;
  const activitySummaryLabel =
    changeCount > 0
      ? `${changeCount} file${changeCount === 1 ? '' : 's'} changed`
      : hasExternalWorkflowChange
        ? 'Workflow changed on disk'
        : 'No recent file changes';

  const statusSubtext = workflowError ?? saveError;
  const codexReadiness = getCodexReadinessBadgeState(
    providerCapabilities,
    nodes.map((node) => String(node.data.model ?? ''))
  );
  const readinessTone: StatusChipTone =
    codexReadiness.tone === 'ready'
      ? 'success'
      : codexReadiness.tone === 'blocked'
        ? 'error'
        : 'warning';
  const runTooltip = !workspacePath
    ? 'Open a workspace first'
    : nodes.length === 0
      ? 'Add at least one node'
      : isPaused
        ? 'Resolve review checkpoint first'
        : codexReadiness.blocking
          ? codexReadiness.summary
          : 'Run workflow';
  const saveStateLabel = saveError ?? formatSavedLabel(lastSavedAt);
  const saveChipState = getSaveChipState(isDirty, isSaving, saveError);
  const nodeCountLabel = `${nodes.length} node${nodes.length === 1 ? '' : 's'}`;
  const activityHasAttention = changeCount > 0 || hasExternalWorkflowChange;

  useEffect(() => {
    if (workflowStatus === 'running') {
      if (runStartedAtRef.current == null) {
        runStartedAtRef.current = Date.now();
        setElapsedMs(0);
      }

      const intervalId = window.setInterval(() => {
        if (runStartedAtRef.current != null) {
          setElapsedMs(Date.now() - runStartedAtRef.current);
        }
      }, 1000);

      return () => window.clearInterval(intervalId);
    }

    runStartedAtRef.current = null;
    setElapsedMs(0);
    return undefined;
  }, [workflowStatus]);

  useEffect(() => {
    if (!isProjectMenuOpen && !isActivityPopoverOpen && !isReadinessPopoverOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (
        isProjectMenuOpen
        && projectMenuRef.current
        && target
        && !projectMenuRef.current.contains(target)
      ) {
        setIsProjectMenuOpen(false);
      }

      if (
        isActivityPopoverOpen
        && activityPopoverRef.current
        && target
        && !activityPopoverRef.current.contains(target)
      ) {
        setIsActivityPopoverOpen(false);
      }

      if (
        isReadinessPopoverOpen
        && readinessPopoverRef.current
        && target
        && !readinessPopoverRef.current.contains(target)
      ) {
        setIsReadinessPopoverOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsProjectMenuOpen(false);
        setIsActivityPopoverOpen(false);
        setIsReadinessPopoverOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isActivityPopoverOpen, isProjectMenuOpen, isReadinessPopoverOpen]);

  const handleRun = (): void => {
    void runCurrentWorkflow();
  };

  const handleRefreshReadiness = async (): Promise<void> => {
    await fetchProviderCapabilities(true);
  };

  const handleOpenWorkspace = async (): Promise<void> => {
    try {
      setIsProjectMenuOpen(false);
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
      setIsProjectMenuOpen(false);
      await saveCurrentWorkflow();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save workflow.';
      setWorkflowError(errorMessage);
    }
  };

  const handleOpenCreateWorkflowDialog = (): void => {
    if (!workspacePath || isBusy) {
      return;
    }

    setIsProjectMenuOpen(false);
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
      setIsActivityPopoverOpen(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to reload workflow from disk.';
      setWorkflowError(errorMessage);
    }
  };

  const handleAbort = (): void => {
    setWorkflowStatus('aborted');
    setWorkflowError('Workflow aborted by user.');
    window.api.abortWorkflow();
  };

  const handleOpenPath = async (filePath: string): Promise<void> => {
    try {
      await window.api.openPath(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open file.';
      setWorkflowError(message);
    }
  };

  const handleRevealPath = async (filePath: string): Promise<void> => {
    try {
      await window.api.revealPath(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reveal file.';
      setWorkflowError(message);
    }
  };

  const handleCopyPath = async (filePath: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to copy path.';
      setWorkflowError(message);
    }
  };

  const activityDetailItems = useMemo(
    () =>
      recentWorkspaceChanges.map((change) => {
        const displayPath = splitDisplayPath(change.relativePath);

        return {
          key: `${change.filePath}-${change.receivedAt}`,
          token: getChangeToken(change.changeType),
          tokenColor: getChangeTokenColor(change.changeType),
          filePath: change.filePath,
          relativePath: change.relativePath,
          basename: displayPath.basename,
          parentPath: displayPath.parentPath,
          receivedAt: formatChangeTime(change.receivedAt),
        };
      }),
    [recentWorkspaceChanges]
  );

  const workflowChipLabel =
    workflowStatus === 'running'
      ? `${workflowChipState.label} ${formatElapsed(elapsedMs)}`
      : workflowChipState.label;

  return (
    <header
      className="relative z-40 flex h-14 shrink-0 items-center px-3 sm:px-4 lg:px-5"
      style={{
        background: 'var(--color-canvas)',
        borderBottom: '1px solid var(--color-hairline)',
      }}
    >
      <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
        <div className="min-w-0">
          <Tooltip content={workspacePath || 'No workspace open'}>
            <div className="flex min-w-0 items-center gap-2">
              <FolderOpen size={14} className="shrink-0" style={{ color: 'var(--color-muted)' }} />

              <span
                className="hidden shrink-0 text-[11px] uppercase tracking-[0.08em] xl:inline"
                style={{
                  color: 'var(--color-muted-soft)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Fluxion
              </span>
              <span
                className="hidden shrink-0 xl:inline"
                style={{ color: 'var(--color-muted-soft)' }}
              >
                /
              </span>
              <span
                className="hidden max-w-[160px] truncate text-[11px] uppercase tracking-[0.08em] lg:inline"
                style={{
                  color: 'var(--color-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {workspaceName}
              </span>
              <span
                className="hidden shrink-0 lg:inline"
                style={{ color: 'var(--color-muted-soft)' }}
              >
                /
              </span>
              <span
                className="min-w-0 truncate text-sm font-semibold"
                style={{ color: 'var(--color-ink)', letterSpacing: '-0.15px' }}
              >
                {workflowName}
              </span>
              <span
                className="hidden shrink-0 text-[11px] md:inline"
                style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
              >
                {nodeCountLabel}
              </span>
              <StatusChip
                tone={saveChipState.tone}
                label={saveChipState.label}
                animate={saveChipState.animate}
                title={saveStateLabel}
                className="hidden shrink-0 md:inline-flex"
              />
            </div>
          </Tooltip>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <StatusChip
            tone={workflowChipState.tone}
            label={workflowChipLabel}
            animate={workflowChipState.animate}
            title={statusSubtext ?? workflowChipLabel}
            className="max-w-[170px]"
          />

          <BinarySwitch
            checked={executionMode === 'manual'}
            onChange={(checked) => setExecutionMode(checked ? 'manual' : 'auto')}
            leftLabel="Auto"
            rightLabel="Manual"
            disabled={isBusy}
            ariaLabel="Execution mode"
            title={
              executionMode === 'auto'
                ? 'Only nodes with review checkpoints pause'
                : 'Every completed node pauses for review'
            }
          />
        </div>

        <div className="flex min-w-0 items-center justify-end gap-1.5">
          <div className="relative" ref={readinessPopoverRef}>
            <button
              type="button"
              aria-label={`Codex readiness: ${codexReadiness.label}`}
              aria-expanded={isReadinessPopoverOpen}
              onClick={() => setIsReadinessPopoverOpen((current) => !current)}
              className="inline-flex items-center"
            >
              <StatusChip
                tone={readinessTone}
                label={isProviderCapabilitiesLoading ? 'Codex Checking' : `Codex ${codexReadiness.label}`}
                title={codexReadiness.detail}
                animate={isProviderCapabilitiesLoading}
                className="max-w-[170px]"
              />
            </button>

            {isReadinessPopoverOpen && (
              <div
                className="absolute right-0 top-[calc(100%+10px)] z-50 w-[360px] p-3"
                style={POPOVER_SURFACE_STYLE}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span
                      className="text-[11px] uppercase tracking-[0.08em]"
                      style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                    >
                      Codex Runtime
                    </span>
                    <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                      {codexReadiness.summary}
                    </p>
                    <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
                      {codexReadiness.detail}
                    </p>
                  </div>
                  <StatusChip tone={readinessTone} label={codexReadiness.label} />
                </div>

                <div
                  className="mt-3 rounded-md px-3 py-2 text-[11px] leading-5"
                  style={{
                    color: 'var(--color-muted)',
                    background: 'var(--color-canvas)',
                    border: '1px solid var(--color-hairline)',
                  }}
                >
                  Windows native Fluxion only sees Codex installed in the Windows PATH. A Codex
                  binary installed only inside WSL is not available to this runner yet.
                </div>

                <div className="mt-3 grid gap-2 text-[11px]" style={{ color: 'var(--color-body)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)' }}>Install: npm i -g @openai/codex</div>
                  <div style={{ fontFamily: 'var(--font-mono)' }}>Login: codex login</div>
                  <div style={{ fontFamily: 'var(--font-mono)' }}>Check: codex login status</div>
                  {codexReadiness.catalogSource && (
                    <div style={{ fontFamily: 'var(--font-mono)' }}>
                      Catalog: {codexReadiness.catalogSource}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRefreshReadiness}
                    disabled={isProviderCapabilitiesLoading || isBusy}
                  >
                    {isProviderCapabilitiesLoading ? 'Refreshing...' : 'Refresh'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={activityPopoverRef}>
            <Tooltip content={activitySummaryLabel}>
              <ActionIconButton
                aria-label="Open workspace activity"
                aria-expanded={isActivityPopoverOpen}
                onClick={() => setIsActivityPopoverOpen((current) => !current)}
                style={{
                  color: hasExternalWorkflowChange
                    ? 'var(--color-semantic-error)'
                    : 'var(--color-muted)',
                }}
              >
                <Files size={16} />
                {activityHasAttention && (
                  <span
                    className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
                    style={{
                      background: hasExternalWorkflowChange
                        ? 'var(--color-semantic-error)'
                        : 'var(--color-status-completed)',
                    }}
                  />
                )}
              </ActionIconButton>
            </Tooltip>

            {isActivityPopoverOpen && (
              <div
                className="absolute right-0 top-[calc(100%+10px)] z-50 w-[380px] p-3"
                style={POPOVER_SURFACE_STYLE}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="text-[11px] uppercase tracking-[0.08em]"
                    style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                  >
                    Activity
                  </span>
                  <span
                    className="text-[11px]"
                    style={{ color: 'var(--color-muted-soft)', fontFamily: 'var(--font-mono)' }}
                  >
                    {activitySummaryLabel}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {activityDetailItems.length > 0 ? (
                    activityDetailItems.map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center gap-2 rounded-md px-2 py-2"
                        style={{
                          background: 'var(--color-canvas)',
                          border: '1px solid var(--color-hairline)',
                        }}
                        title={item.relativePath}
                      >
                        <span
                          className="shrink-0 text-xs font-semibold"
                          style={{ color: item.tokenColor, fontFamily: 'var(--font-mono)' }}
                        >
                          {item.token}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleOpenPath(item.filePath)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="truncate text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
                            {item.basename}
                          </div>
                          <div
                            className="mt-0.5 flex min-w-0 items-center gap-2 text-[10px]"
                            style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                          >
                            <span className="truncate">{item.parentPath}</span>
                            <span className="shrink-0">{item.receivedAt}</span>
                          </div>
                        </button>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <ActivityFileAction
                            label="Open"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleOpenPath(item.filePath);
                            }}
                          >
                            <ExternalLink size={13} />
                          </ActivityFileAction>
                          <ActivityFileAction
                            label="Reveal"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleRevealPath(item.filePath);
                            }}
                          >
                            <FolderOpen size={13} />
                          </ActivityFileAction>
                          <ActivityFileAction
                            label="Copy path"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleCopyPath(item.filePath);
                            }}
                          >
                            <Copy size={13} />
                          </ActivityFileAction>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p
                      className="rounded-md px-3 py-2 text-xs"
                      style={{
                        color: 'var(--color-muted)',
                        background: 'var(--color-canvas)',
                        border: '1px solid var(--color-hairline)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      No recent file changes.
                    </p>
                  )}
                </div>

                {hasExternalWorkflowChange && (
                  <div
                    className="mt-3 flex items-center justify-between gap-3 rounded-md px-3 py-2"
                    style={{
                      background: 'var(--color-canvas)',
                      border: '1px solid var(--color-hairline)',
                    }}
                  >
                    <div className="min-w-0">
                      <p
                        className="text-xs font-medium"
                        style={{ color: 'var(--color-ink)' }}
                      >
                        Workflow file changed on disk
                      </p>
                      <p
                        className="mt-1 text-[11px]"
                        style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                      >
                        Reload to sync the canvas with disk.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleReload}
                      disabled={isBusy}
                    >
                      <AlertTriangle size={13} />
                      Reload
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="relative" ref={projectMenuRef}>
            <ActionTextButton
              aria-expanded={isProjectMenuOpen}
              onClick={() => setIsProjectMenuOpen((current) => !current)}
              disabled={isBusy}
              dimmed={editingDimmed}
              className="hidden sm:inline-flex"
            >
              <span>Project</span>
              <ChevronDown size={14} />
            </ActionTextButton>

            {isProjectMenuOpen && (
              <div
                className="absolute right-0 top-[calc(100%+10px)] z-50 w-[220px] p-2"
                style={POPOVER_SURFACE_STYLE}
              >
                <button
                  type="button"
                  onClick={handleOpenWorkspace}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-canvas)]"
                  style={{ color: 'var(--color-ink)' }}
                >
                  <FolderOpen size={14} />
                  Open Workspace
                </button>

                <button
                  type="button"
                  onClick={handleOpenCreateWorkflowDialog}
                  disabled={!workspacePath || isBusy}
                  className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-canvas)] disabled:cursor-not-allowed"
                  style={{
                    color:
                      !workspacePath || isBusy
                        ? 'var(--color-muted-soft)'
                        : 'var(--color-ink)',
                  }}
                >
                  <Plus size={14} />
                  New Workflow
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                  className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-canvas)] disabled:cursor-not-allowed"
                  style={{
                    color: canSave ? 'var(--color-ink)' : 'var(--color-muted-soft)',
                  }}
                >
                  <Save size={14} />
                  Save Workflow
                </button>
              </div>
            )}
          </div>

          <Tooltip content="Global Settings">
            <ActionIconButton
              aria-label="Open Global Settings"
              onClick={() => setIsSettingsOpen(true)}
              disabled={isBusy}
              dimmed={editingDimmed}
            >
              <Settings size={16} />
            </ActionIconButton>
          </Tooltip>

          <Tooltip content={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            <ActionIconButton
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </ActionIconButton>
          </Tooltip>

          {!isBusy ? (
            <Tooltip content={runTooltip}>
              <Button
                variant="primary"
                size="toolbar"
                className="min-w-[88px] shrink-0"
                onClick={handleRun}
                disabled={!canRun}
              >
                <Play size={13} fill="currentColor" />
                Run
              </Button>
            </Tooltip>
          ) : (
            <Tooltip content="Abort current workflow">
              <Button
                variant="danger"
                size="toolbar"
                className="min-w-[88px] shrink-0"
                onClick={handleAbort}
              >
                <Square size={13} fill="currentColor" />
                Abort
              </Button>
            </Tooltip>
          )}
        </div>
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
          if (isCreatingWorkflow) {
            return;
          }

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
