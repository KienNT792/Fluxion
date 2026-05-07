import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  Settings,
  Trash2,
  Workflow,
} from 'lucide-react';
import type { RecentWorkspaceEntry } from '@shared';
import {
  getCodexReadinessBadgeState,
  getProviderReadinessSummary,
} from '../../lib/provider-capabilities';
import { openWorkspaceFromDialog, openWorkspacePath } from '../../lib/workflow-session';
import { useWorkspaceTrustPrompt } from '../../hooks/useWorkspaceTrustPrompt';
import { useWorkflowStore } from '../../stores/workflow.store';
import { Button } from '../ui/Button';
import { StatusChip, StatusChipTone } from '../ui/StatusChip';
import { Tooltip } from '../ui/Tooltip';
import { GlobalSettingsDialog } from './GlobalSettingsDialog';
import { WorkspaceOpeningOverlay } from './WorkspaceOpeningOverlay';

const FLOW_STEPS = ['Open workspace', 'Review context', 'Configure agents', 'Run workflow'];

function hasFileDrop(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes('Files');
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatRecentTimestamp(value: string): string {
  const openedAt = new Date(value);

  if (Number.isNaN(openedAt.getTime())) {
    return 'Opened recently';
  }

  return `Opened ${openedAt.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

const RecentActionButton: React.FC<{
  label: string;
  disabled: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}> = ({ label, disabled, onClick, children }) => (
  <Tooltip content={label}>
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-canvas)] disabled:cursor-not-allowed"
      style={{
        color: disabled ? 'var(--color-muted-soft)' : 'var(--color-muted)',
      }}
    >
      {children}
    </button>
  </Tooltip>
);

const RecentWorkspaceRow: React.FC<{
  entry: RecentWorkspaceEntry;
  disabled: boolean;
  onOpen: (workspacePath: string) => void;
  onReveal: (workspacePath: string) => void;
  onRemove: (workspacePath: string) => void;
}> = ({ entry, disabled, onOpen, onReveal, onRemove }) => (
  <div
    className="flex min-w-0 items-center gap-2 rounded-md px-2 py-2 transition-colors hover:bg-[var(--color-canvas)]"
    style={{
      background: 'var(--color-canvas-soft)',
      border: '1px solid var(--color-hairline)',
    }}
    title={entry.path}
  >
    <button
      type="button"
      onClick={() => onOpen(entry.path)}
      disabled={disabled}
      className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-not-allowed"
      style={{
        color: disabled ? 'var(--color-muted-soft)' : 'var(--color-ink)',
      }}
    >
      <FolderOpen size={14} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{entry.name}</span>
        <span
          className="mt-0.5 block truncate text-[10px]"
          style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {entry.path}
        </span>
      </span>
      <span
        className="hidden shrink-0 text-[10px] md:inline"
        style={{ color: 'var(--color-muted-soft)' }}
      >
        {formatRecentTimestamp(entry.lastOpenedAt)}
      </span>
    </button>

    <div className="flex shrink-0 items-center gap-0.5">
      <RecentActionButton
        label="Reveal in Explorer"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onReveal(entry.path);
        }}
      >
        <ExternalLink size={13} />
      </RecentActionButton>
      <RecentActionButton
        label="Remove from Recent"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onRemove(entry.path);
        }}
      >
        <Trash2 size={13} />
      </RecentActionButton>
    </div>
  </div>
);

export const WelcomeScreen: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [recentWorkspaces, setRecentWorkspaces] = React.useState<RecentWorkspaceEntry[]>([]);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [workspaceActionError, setWorkspaceActionError] = React.useState<string | null>(null);
  const dragDepthRef = React.useRef(0);
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities);
  const workspaceOpenState = useWorkflowStore((state) => state.workspaceOpenState);
  const isProviderCapabilitiesLoading = useWorkflowStore(
    (state) => state.isProviderCapabilitiesLoading
  );
  const hasFetchedProviderCapabilities = useWorkflowStore(
    (state) => state.hasFetchedProviderCapabilities
  );
  const fetchProviderCapabilities = useWorkflowStore((state) => state.fetchProviderCapabilities);
  const { requestWorkspaceTrust, trustDialog } = useWorkspaceTrustPrompt();
  const codexReadiness = getCodexReadinessBadgeState(providerCapabilities, []);
  const providerReadiness = getProviderReadinessSummary(providerCapabilities);

  React.useEffect(() => {
    if (!hasFetchedProviderCapabilities) {
      void fetchProviderCapabilities();
    }
  }, [fetchProviderCapabilities, hasFetchedProviderCapabilities]);

  React.useEffect(() => {
    let isMounted = true;

    async function loadRecentWorkspaces(): Promise<void> {
      if (!window.api?.listRecentWorkspaces) {
        return;
      }

      try {
        const entries = await window.api.listRecentWorkspaces();
        if (isMounted) {
          setRecentWorkspaces(entries);
        }
      } catch {
        if (isMounted) {
          setRecentWorkspaces([]);
        }
      }
    }

    void loadRecentWorkspaces();
    return () => {
      isMounted = false;
    };
  }, []);

  const isWorkspaceOpening =
    workspaceOpenState.phase === 'selecting'
    || workspaceOpenState.phase === 'awaitingTrust'
    || workspaceOpenState.phase === 'opening';

  const readinessChipTone: StatusChipTone = isProviderCapabilitiesLoading
    ? 'running'
    : providerReadiness.blockingCount > 0 || codexReadiness.tone === 'blocked'
      ? 'error'
      : providerReadiness.warningCount > 0 || codexReadiness.tone !== 'ready'
        ? 'warning'
        : 'success';
  const readinessStatusLabel = isProviderCapabilitiesLoading
    ? 'Checking runtime...'
    : codexReadiness.tone === 'ready'
      ? `Codex ready · ${providerReadiness.availableCount} provider${
          providerReadiness.availableCount === 1 ? '' : 's'
        } available`
      : `${codexReadiness.summary} · ${providerReadiness.availableCount} provider${
          providerReadiness.availableCount === 1 ? '' : 's'
        } available`;

  const handleOpenWorkspace = async (): Promise<void> => {
    setWorkspaceActionError(null);

    try {
      await openWorkspaceFromDialog({ requestWorkspaceTrust });
    } catch {
      // The opening overlay owns the visible error state.
    }
  };

  const handleOpenRecentWorkspace = async (workspacePath: string): Promise<void> => {
    setWorkspaceActionError(null);

    try {
      await openWorkspacePath(workspacePath, { requestWorkspaceTrust });
    } catch {
      // The opening overlay owns the visible error state.
    }
  };

  const resetDragState = (): void => {
    dragDepthRef.current = 0;
    setIsDragActive(false);
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>): void => {
    if (!hasFileDrop(event.dataTransfer)) {
      return;
    }

    event.preventDefault();

    if (isWorkspaceOpening) {
      return;
    }

    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    if (!hasFileDrop(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = isWorkspaceOpening ? 'none' : 'copy';
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>): void => {
    if (!hasFileDrop(event.dataTransfer)) {
      return;
    }

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>): Promise<void> => {
    if (!hasFileDrop(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    resetDragState();

    if (isWorkspaceOpening) {
      return;
    }

    const droppedFile = Array.from(event.dataTransfer.files)[0];
    if (!droppedFile) {
      setWorkspaceActionError('Drop a project folder to open it as a workspace.');
      return;
    }

    let droppedPath = '';
    try {
      droppedPath = window.api?.getPathForFile?.(droppedFile) ?? '';
    } catch {
      droppedPath = '';
    }

    if (!droppedPath) {
      setWorkspaceActionError('Fluxion could not read the dropped folder path.');
      return;
    }

    if (!window.api?.validateWorkspaceDirectory) {
      setWorkspaceActionError('Workspace validation is not available.');
      return;
    }

    try {
      const validation = await window.api.validateWorkspaceDirectory(droppedPath);
      if (!validation.ok) {
        setWorkspaceActionError(validation.message);
        return;
      }

      setWorkspaceActionError(null);
      await openWorkspacePath(validation.path, { requestWorkspaceTrust });
    } catch (error) {
      setWorkspaceActionError(getErrorMessage(error, 'Failed to open dropped workspace.'));
    }
  };

  const handleRevealRecentWorkspace = async (workspacePath: string): Promise<void> => {
    if (!window.api?.revealPath) {
      return;
    }

    try {
      await window.api.revealPath(workspacePath);
    } catch (error) {
      setWorkspaceActionError(getErrorMessage(error, 'Failed to reveal workspace.'));
    }
  };

  const handleRemoveRecentWorkspace = async (workspacePath: string): Promise<void> => {
    if (!window.api?.removeRecentWorkspace) {
      return;
    }

    try {
      const entries = await window.api.removeRecentWorkspace(workspacePath);
      setRecentWorkspaces(entries);
      setWorkspaceActionError(null);
    } catch (error) {
      setWorkspaceActionError(
        getErrorMessage(error, 'Failed to remove workspace from recent list.')
      );
    }
  };

  return (
    <div
      className="flex h-screen w-full flex-1 select-none overflow-auto px-5 py-8 sm:px-8"
      style={{ background: 'var(--color-canvas)' }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(event) => {
        void handleDrop(event);
      }}
    >
      <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center gap-6">
        <section className="flex w-full flex-col items-center gap-5 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-lg"
            style={{
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)',
            }}
          >
            <Workflow size={31} style={{ color: 'var(--color-primary)' }} />
          </div>

          <div className="max-w-xl">
            <h1
              className="text-3xl font-normal"
              style={{
                color: 'var(--color-ink)',
                letterSpacing: 0,
                lineHeight: 1.2,
              }}
            >
              Fluxion
            </h1>
            <p className="mt-3 text-base leading-7" style={{ color: 'var(--color-body)' }}>
              Turn a local workspace into a reviewable agent workflow.
            </p>
            <p className="mt-2 text-sm leading-6" style={{ color: 'var(--color-muted)' }}>
              Fluxion reads project context, prepares agent workflows, and keeps outputs
              reviewable.
            </p>
          </div>
        </section>

        <section
          className="w-full rounded-xl px-5 py-6 text-center transition-colors sm:px-8 sm:py-7"
          style={{
            background: isDragActive
              ? 'var(--color-canvas-soft)'
              : 'var(--color-surface-card)',
            border: isDragActive
              ? '1px solid var(--color-primary)'
              : '1px solid var(--color-hairline)',
            boxShadow: isDragActive
              ? '0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent)'
              : '0 18px 44px rgba(38, 37, 30, 0.08)',
          }}
        >
          <div className="mx-auto flex max-w-md flex-col items-center gap-4">
            
            <Button
              variant="primary"
              size="lg"
              onClick={handleOpenWorkspace}
              disabled={isWorkspaceOpening}
              className="min-w-[180px]"
            >
              <FolderOpen size={16} />
              {isWorkspaceOpening ? 'Opening...' : 'Open Workspace'}
            </Button>

            <p
              className="text-xs font-medium"
              style={{ color: isDragActive ? 'var(--color-ink)' : 'var(--color-body)' }}
            >
              Drop a project folder here
            </p>

            <Tooltip content={codexReadiness.detail}>
              <div className="max-w-full">
                <StatusChip
                  tone={readinessChipTone}
                  label={readinessStatusLabel}
                  animate={isProviderCapabilitiesLoading}
                  className="max-w-full"
                />
              </div>
            </Tooltip>
          </div>

          {workspaceActionError ? (
            <div
              className="mx-auto mt-4 flex max-w-md items-start gap-2 rounded-md px-3 py-2 text-left text-xs leading-5"
              style={{
                color: 'var(--color-semantic-error)',
                background: 'var(--color-canvas)',
                border: '1px solid var(--color-hairline)',
              }}
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{workspaceActionError}</span>
            </div>
          ) : null}
        </section>

        <section className="flex max-w-full flex-wrap items-center justify-center gap-2 text-xs">
          {FLOW_STEPS.map((step, index) => (
            <React.Fragment key={step}>
              <span
                className="inline-flex items-center gap-1.5"
                style={{ color: index === 0 ? 'var(--color-body-strong)' : 'var(--color-muted)' }}
              >
                {index === 0 ? <CheckCircle2 size={13} /> : null}
                {step}
              </span>
              {index < FLOW_STEPS.length - 1 ? (
                <span style={{ color: 'var(--color-muted-soft)' }}>→</span>
              ) : null}
            </React.Fragment>
          ))}
        </section>

        <section className="w-full">
          {recentWorkspaces.length > 0 ? (
            <div
              className="rounded-lg px-3 py-3"
              style={{
                background: 'var(--color-surface-card)',
                border: '1px solid var(--color-hairline)',
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                  Recent Workspaces
                </h2>
                <span
                  className="text-[11px]"
                  style={{ color: 'var(--color-muted-soft)', fontFamily: 'var(--font-mono)' }}
                >
                  {recentWorkspaces.length}
                </span>
              </div>
              <div className="grid gap-2">
                {recentWorkspaces.map((entry) => (
                  <RecentWorkspaceRow
                    key={entry.path}
                    entry={entry}
                    disabled={isWorkspaceOpening}
                    onOpen={(workspacePath) => {
                      void handleOpenRecentWorkspace(workspacePath);
                    }}
                    onReveal={(workspacePath) => {
                      void handleRevealRecentWorkspace(workspacePath);
                    }}
                    onRemove={(workspacePath) => {
                      void handleRemoveRecentWorkspace(workspacePath);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <span style={{ color: 'var(--color-muted)' }}>
                No recent workspaces yet.
              </span>
              <button
                type="button"
                onClick={handleOpenWorkspace}
                disabled={isWorkspaceOpening}
                className="rounded-md px-2 py-1 font-medium transition-colors hover:bg-[var(--color-surface-card)] disabled:cursor-not-allowed"
                style={{
                  color: isWorkspaceOpening ? 'var(--color-muted-soft)' : 'var(--color-primary)',
                }}
              >
                Browse existing workspace
              </button>
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--color-surface-card)]"
          style={{ color: 'var(--color-muted)' }}
        >
          <Settings size={13} />
          Settings
        </button>
      </main>

      <GlobalSettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      {trustDialog}
      <WorkspaceOpeningOverlay />
    </div>
  );
};
