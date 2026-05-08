import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  FolderOpen,
  Settings,
  Terminal,
  Trash2,
  Workflow,
} from 'lucide-react';
import type { RecentWorkspaceEntry } from '@shared';
import { getCodexReadiness, getCodexReadinessBadgeState, getProviderReadinessSummary } from '../../lib/provider-capabilities';
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

const CopyableCommand: React.FC<{ command: string }> = ({ command }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be unavailable in some contexts
    }
  };

  return (
    <div
      className="flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs"
      style={{
        background: 'var(--color-canvas)',
        border: '1px solid var(--color-hairline)',
        color: 'var(--color-ink)',
      }}
    >
      <Terminal size={12} className="shrink-0" style={{ color: 'var(--color-muted)' }} />
      <code className="flex-1 select-all">{command}</code>
      <button
        type="button"
        onClick={() => { void handleCopy(); }}
        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-sans transition-colors hover:bg-[var(--color-canvas-soft)]"
        style={{ color: copied ? 'var(--color-semantic-success)' : 'var(--color-muted)' }}
        aria-label="Copy command"
      >
        {copied ? 'Copied' : <Copy size={11} />}
      </button>
    </div>
  );
};

interface PrerequisiteBlockProps {
  code: 'cli_missing' | 'auth_missing';
  actionCommand?: string;
}

const PrerequisiteBlock: React.FC<PrerequisiteBlockProps> = ({ code, actionCommand }) => {
  const isCliMissing = code === 'cli_missing';

  const title = isCliMissing ? 'Codex CLI is not installed' : 'Codex CLI is not logged in';
  const description = isCliMissing
    ? 'Fluxion requires Codex CLI to run workflows. Install it with npm, then log in.'
    : 'Codex CLI is installed but you are not authenticated. Run the command below, then refresh.';

  const installCommand = 'npm install -g @openai/codex';
  const loginCommand = actionCommand ?? 'codex login';

  return (
    <div
      className="w-full rounded-xl px-5 py-5 sm:px-7"
      style={{
        background: 'var(--color-canvas-soft)',
        border: '1px solid var(--color-hairline)',
      }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={16}
          className="mt-0.5 shrink-0"
          style={{ color: 'var(--color-semantic-error)' }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
            {title}
          </p>
          <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
            {description}
          </p>
          <div className="mt-3 grid gap-2">
            {isCliMissing && <CopyableCommand command={installCommand} />}
            <CopyableCommand command={loginCommand} />
          </div>
          {isCliMissing && (
            <p className="mt-3 text-[11px] leading-5" style={{ color: 'var(--color-muted-soft)' }}>
              After installation and login, relaunch Fluxion or click{' '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>Refresh readiness</span> in Settings.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

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
  const codexRawReadiness = getCodexReadiness(providerCapabilities);
  const providerReadiness = getProviderReadinessSummary(providerCapabilities);

  // Determine if we should show a prerequisite hard-block for Stage 1.
  // cli_missing and auth_missing are the two distinct states that need separate copy.
  const prerequisiteCode =
    !isProviderCapabilitiesLoading && hasFetchedProviderCapabilities
      ? codexRawReadiness?.code === 'cli_missing' || codexRawReadiness?.code === 'auth_missing'
        ? codexRawReadiness.code
        : null
      : null;

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
      ? 'Codex is ready'
      : codexReadiness.summary;

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

        {prerequisiteCode ? (
          <PrerequisiteBlock
            code={prerequisiteCode}
            actionCommand={codexRawReadiness?.actionCommand}
          />
        ) : null}

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

        <section className="flex max-w-full flex-col items-center gap-2">
          <p
            className="text-[11px] uppercase tracking-[0.08em]"
            style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
          >
            How Fluxion works
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            {FLOW_STEPS.map((step, index) => (
              <React.Fragment key={step}>
                <span
                  className="inline-flex items-center gap-1.5 font-medium"
                  style={{
                    color: index === 0
                      ? 'var(--color-primary)'
                      : index === 1
                        ? 'var(--color-body-strong)'
                        : 'var(--color-muted)',
                  }}
                >
                  {index === 0 ? <CheckCircle2 size={13} /> : null}
                  {step}
                </span>
                {index < FLOW_STEPS.length - 1 ? (
                  <span style={{ color: 'var(--color-hairline-strong)' }}>→</span>
                ) : null}
              </React.Fragment>
            ))}
          </div>
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
            <p className="text-center text-xs" style={{ color: 'var(--color-muted)' }}>
              No recent workspaces yet. Open a project folder above to get started.
            </p>
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
