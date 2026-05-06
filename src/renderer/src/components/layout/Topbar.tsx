import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
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
import { Button } from '../ui/Button';
import { InputDialog } from '../ui/InputDialog';
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
    return 'var(--color-timeline-grep)';
  }

  if (changeType === 'unlink') {
    return 'var(--color-semantic-error)';
  }

  return 'var(--color-timeline-read)';
}

function getPulseState(
  workflowStatus: 'idle' | 'running' | 'paused' | 'aborted' | 'completed' | 'error',
  isSaving: boolean
): {
  label: string;
  color: string;
  animate: boolean;
} {
  if (workflowStatus === 'running') {
    return {
      label: 'Executing',
      color: 'var(--color-timeline-thinking)',
      animate: true,
    };
  }

  if (isSaving) {
    return {
      label: 'Saving',
      color: 'var(--color-timeline-read)',
      animate: true,
    };
  }

  if (workflowStatus === 'completed') {
    return {
      label: 'Completed',
      color: 'var(--color-timeline-grep)',
      animate: false,
    };
  }

  if (workflowStatus === 'paused') {
    return {
      label: 'Awaiting Review',
      color: 'var(--color-timeline-edit)',
      animate: false,
    };
  }

  if (workflowStatus === 'aborted') {
    return {
      label: 'Aborted',
      color: 'var(--color-timeline-read)',
      animate: false,
    };
  }

  if (workflowStatus === 'error') {
    return {
      label: 'Error',
      color: 'var(--color-semantic-error)',
      animate: false,
    };
  }

  return {
    label: 'Ready',
    color: 'var(--color-muted-soft)',
    animate: false,
  };
}

function getDirtyDotState(
  isDirty: boolean,
  isSaving: boolean
): { color: string; animate: boolean; label: string } | null {
  if (isSaving) {
    return {
      color: 'var(--color-timeline-grep)',
      animate: true,
      label: 'Saving',
    };
  }

  if (isDirty) {
    return {
      color: 'var(--color-timeline-done)',
      animate: false,
      label: 'Unsaved changes',
    };
  }

  return null;
}

interface ActionTextButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  dimmed?: boolean;
}

const ActionTextButton = React.forwardRef<HTMLButtonElement, ActionTextButtonProps>(
  ({ className = '', dimmed = false, disabled = false, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-ink)] ${className}`}
      style={{
        color: disabled ? 'var(--color-muted-soft)' : 'var(--color-muted)',
        opacity: dimmed ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      {...props}
    >
      {children}
    </button>
  )
);

ActionTextButton.displayName = 'ActionTextButton';

const ActionIconButton = React.forwardRef<HTMLButtonElement, ActionTextButtonProps>(
  ({ className = '', dimmed = false, disabled = false, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-ink)] ${className}`}
      style={{
        color: disabled ? 'var(--color-muted-soft)' : 'var(--color-muted)',
        opacity: dimmed ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
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
  boxShadow: '0 18px 40px rgba(38, 37, 30, 0.08)',
};

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
  const pulseState = getPulseState(workflowStatus, isSaving);
  const dirtyDotState = getDirtyDotState(isDirty, isSaving);
  const changeCount = recentWorkspaceChanges.length;
  const activitySummaryLabel =
    changeCount > 0
      ? `${changeCount} file${changeCount === 1 ? '' : 's'} changed`
      : hasExternalWorkflowChange
        ? 'Workflow changed on disk'
        : 'Workspace steady';

  const statusSubtext = workflowError ?? saveError;
  const codexReadiness = getCodexReadinessBadgeState(
    providerCapabilities,
    nodes.map((node) => String(node.data.model ?? ''))
  );
  const readinessToneColor =
    codexReadiness.tone === 'ready'
      ? 'var(--color-semantic-success)'
      : codexReadiness.tone === 'blocked'
        ? 'var(--color-semantic-error)'
        : 'var(--color-timeline-edit)';
  const runTooltip = !workspacePath
    ? 'Open a workspace first'
    : nodes.length === 0
      ? 'Add at least one node'
      : isPaused
        ? 'Resolve review checkpoint first'
        : codexReadiness.blocking
          ? codexReadiness.summary
          : 'Run workflow';
  const saveStateLabel = isSaving
    ? 'Saving...'
    : saveError
      ? 'Save failed'
      : isDirty
        ? 'Unsaved changes'
        : formatSavedLabel(lastSavedAt);

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

  const activityDetailItems = useMemo(
    () =>
      recentWorkspaceChanges.map((change) => ({
        key: `${change.relativePath}-${change.receivedAt}`,
        token: getChangeToken(change.changeType),
        tokenColor: getChangeTokenColor(change.changeType),
        relativePath: change.relativePath,
        receivedAt: formatChangeTime(change.receivedAt),
      })),
    [recentWorkspaceChanges]
  );

  return (
    <header
      className="relative z-40 flex h-14 shrink-0 items-center px-4 sm:px-5 lg:px-6"
      style={{
        background: 'var(--color-canvas)',
        borderBottom: '1px solid var(--color-hairline)',
      }}
    >
      <div className="grid w-full gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
        <div className="min-w-0">
          <Tooltip content={workspacePath || 'No workspace open'}>
            <div className="flex min-w-0 items-center gap-2">
              <FolderOpen size={14} style={{ color: 'var(--color-muted)' }} />

              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="hidden text-[11px] uppercase tracking-[0.08em] lg:inline"
                  style={{
                    color: 'var(--color-muted-soft)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Fluxion
                </span>
                <span
                  className="hidden lg:inline"
                  style={{ color: 'var(--color-muted-soft)' }}
                >
                  /
                </span>
                <span
                  className="truncate text-[11px] uppercase tracking-[0.08em]"
                  style={{
                    color: 'var(--color-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {workspaceName}
                </span>
                <span style={{ color: 'var(--color-muted-soft)' }}>/</span>
                <span
                  className="truncate text-sm font-semibold"
                  style={{ color: 'var(--color-ink)', letterSpacing: '-0.15px' }}
                >
                  {workflowName}
                </span>
                {dirtyDotState && (
                  <Tooltip content={dirtyDotState.label}>
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${dirtyDotState.animate ? 'animate-pulse' : ''}`}
                      style={{ background: dirtyDotState.color }}
                    />
                  </Tooltip>
                )}
              </div>
            </div>
          </Tooltip>
        </div>

        <div className="justify-self-start lg:justify-self-center">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className="inline-flex items-center gap-2"
              style={{ color: 'var(--color-body)' }}
            >
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${pulseState.animate ? 'animate-pulse' : ''}`}
                style={{ background: pulseState.color }}
              />
              <span
                className="font-medium"
                style={{ color: 'var(--color-ink)' }}
              >
                {pulseState.label}
                {workflowStatus === 'running' ? ` (${formatElapsed(elapsedMs)})` : ''}
              </span>
            </span>

            <span style={{ color: 'var(--color-muted-soft)' }}>•</span>

            <div
              className="inline-flex items-center rounded-md p-0.5"
              style={{
                background: 'var(--color-surface-card)',
                border: '1px solid var(--color-hairline)',
              }}
            >
              {(['auto', 'manual'] as const).map((mode) => {
                const isActive = executionMode === mode;

                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setExecutionMode(mode)}
                    disabled={isBusy}
                    className="min-w-[68px] rounded-[5px] px-2.5 py-1 text-[11px] font-semibold uppercase transition-colors"
                    style={{
                      background: isActive ? 'var(--color-primary)' : 'transparent',
                      color: isActive ? '#ffffff' : 'var(--color-muted)',
                      cursor: isBusy ? 'not-allowed' : 'pointer',
                      opacity: isBusy && !isActive ? 0.5 : 1,
                    }}
                    title={
                      mode === 'auto'
                        ? 'Only nodes with review checkpoints pause'
                        : 'Every completed node pauses for review'
                    }
                  >
                    {mode}
                  </button>
                );
              })}
            </div>

            <span style={{ color: 'var(--color-muted-soft)' }}>•</span>

            <div className="relative" ref={readinessPopoverRef}>
              <button
                type="button"
                onClick={() => setIsReadinessPopoverOpen((current) => !current)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-[var(--color-surface-card)]"
                style={{
                  color: readinessToneColor,
                  fontFamily: 'var(--font-mono)',
                }}
                title={codexReadiness.detail}
              >
                Codex: {isProviderCapabilitiesLoading ? 'Checking...' : codexReadiness.label}
                <ChevronDown size={12} />
              </button>

              {isReadinessPopoverOpen && (
                <div
                  className="absolute left-0 top-[calc(100%+10px)] z-50 w-[360px] p-3"
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
                    <span
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold"
                      style={{
                        color: readinessToneColor,
                        background: 'var(--color-canvas)',
                        border: '1px solid var(--color-hairline)',
                      }}
                    >
                      {codexReadiness.label}
                    </span>
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

            <span style={{ color: 'var(--color-muted-soft)' }}>|</span>

            {changeCount > 0 || hasExternalWorkflowChange ? (
              <div className="relative" ref={activityPopoverRef}>
                <button
                  type="button"
                  onClick={() => setIsActivityPopoverOpen((current) => !current)}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-[var(--color-surface-card)]"
                  style={{
                    color: hasExternalWorkflowChange
                      ? 'var(--color-semantic-error)'
                      : 'var(--color-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {activitySummaryLabel}
                  <ChevronDown size={12} />
                </button>

                {isActivityPopoverOpen && (
                  <div
                    className="absolute left-0 top-[calc(100%+10px)] z-50 w-[320px] p-3"
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
                        {saveStateLabel}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {activityDetailItems.length > 0 ? (
                        activityDetailItems.map((item) => (
                          <div
                            key={item.key}
                            className="flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="flex min-w-0 items-start gap-2">
                              <span
                                className="mt-0.5 font-semibold"
                                style={{ color: item.tokenColor, fontFamily: 'var(--font-mono)' }}
                              >
                                {item.token}
                              </span>
                              <span
                                className="truncate"
                                style={{ color: 'var(--color-body)', fontFamily: 'var(--font-mono)' }}
                              >
                                {item.relativePath}
                              </span>
                            </div>
                            <span
                              className="shrink-0"
                              style={{ color: 'var(--color-muted-soft)', fontFamily: 'var(--font-mono)' }}
                            >
                              {item.receivedAt}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p
                          className="text-xs"
                          style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
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
            ) : (
              <span
                className="text-xs"
                style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
              >
                {activitySummaryLabel}
              </span>
            )}
          </div>

          {statusSubtext && (
            <p
              className="mt-1 truncate text-[11px]"
              style={{ color: 'var(--color-semantic-error)', fontFamily: 'var(--font-mono)' }}
            >
              {statusSubtext}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 lg:justify-end">
          <div className="flex items-center gap-1">
            <div className="relative" ref={projectMenuRef}>
              <ActionTextButton
                onClick={() => setIsProjectMenuOpen((current) => !current)}
                disabled={isBusy}
                dimmed={editingDimmed}
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

                  <div
                    className="mt-2 px-3 pt-2 text-[11px]"
                    style={{
                      color: saveError ? 'var(--color-semantic-error)' : 'var(--color-muted)',
                      fontFamily: 'var(--font-mono)',
                      borderTop: '1px solid var(--color-hairline)',
                    }}
                  >
                    {saveError ?? saveStateLabel}
                  </div>
                </div>
              )}
            </div>

            <Tooltip content="Global Settings">
              <ActionIconButton
                onClick={() => setIsSettingsOpen(true)}
                disabled={isBusy}
                dimmed={editingDimmed}
              >
                <Settings size={16} />
              </ActionIconButton>
            </Tooltip>

            <Tooltip content={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              <ActionIconButton onClick={toggleTheme}>
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </ActionIconButton>
            </Tooltip>
          </div>

          {!isBusy ? (
            <Tooltip content={runTooltip}>
              <Button
                variant="primary"
                size="md"
                className="min-w-[112px] shrink-0"
                onClick={handleRun}
                disabled={!canRun}
              >
                <Play size={14} fill="currentColor" />
                RUN
              </Button>
            </Tooltip>
          ) : (
            <Tooltip content="Abort current workflow">
              <Button
                variant="danger"
                size="md"
                className="min-w-[112px] shrink-0"
                onClick={handleAbort}
              >
                <Square size={14} fill="currentColor" />
                ABORT
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
