import React from 'react';
import { AlertTriangle, Clock3, FolderOpen, Settings, Workflow } from 'lucide-react';
import { RecentWorkspaceEntry } from '@shared';
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

const ONBOARDING_STEPS = [
  'Open your codebase',
  'Configure agents',
  'Run and review outputs',
] as const;

export const WelcomeScreen: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [recentWorkspaces, setRecentWorkspaces] = React.useState<RecentWorkspaceEntry[]>([]);
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

  const handleOpenWorkspace = async (): Promise<void> => {
    try {
      await openWorkspaceFromDialog({ requestWorkspaceTrust });
    } catch {
      // The opening overlay owns the visible error state.
    }
  };

  const handleOpenRecentWorkspace = async (workspacePath: string): Promise<void> => {
    try {
      await openWorkspacePath(workspacePath, { requestWorkspaceTrust });
    } catch {
      // The opening overlay owns the visible error state.
    }
  };

  const isWorkspaceOpening =
    workspaceOpenState.phase === 'selecting'
    || workspaceOpenState.phase === 'awaitingTrust'
    || workspaceOpenState.phase === 'opening';

  const readinessTone =
    codexReadiness.tone === 'ready'
      ? 'var(--color-semantic-success)'
      : codexReadiness.tone === 'blocked'
        ? 'var(--color-semantic-error)'
        : 'var(--color-timeline-done)';
  const readinessChipTone: StatusChipTone = isProviderCapabilitiesLoading
    ? 'running'
    : providerReadiness.blockingCount > 0
      ? 'error'
      : providerReadiness.warningCount > 0 || codexReadiness.tone !== 'ready'
        ? 'warning'
        : 'success';
  const compactReadinessLabel = isProviderCapabilitiesLoading
    ? 'Checking providers...'
    : `${providerReadiness.availableCount} provider${
        providerReadiness.availableCount === 1 ? '' : 's'
      } ready`;
  const shouldShowReadinessCard =
    !isProviderCapabilitiesLoading
    && (providerReadiness.blockingCount > 0 || providerReadiness.warningCount > 0);
  const readinessCardTitle = providerReadiness.blockingCount > 0
    ? 'Provider setup needed'
    : 'Provider warning';

  return (
    <div
      className="relative flex h-screen w-full flex-1 select-none items-center justify-center overflow-auto px-5 py-10"
      style={{ background: 'var(--color-canvas)' }}
    >
      <div className="absolute right-5 top-5">
        <Tooltip content="Global Settings">
          <button
            type="button"
            aria-label="Open Global Settings"
            onClick={() => setIsSettingsOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-surface-card)]"
            style={{
              color: 'var(--color-muted)',
              border: '1px solid var(--color-hairline)',
              background: 'var(--color-canvas-soft)',
            }}
          >
            <Settings size={16} />
          </button>
        </Tooltip>
      </div>

      <div className="flex w-full max-w-xl flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-5 text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl"
            style={{
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)',
            }}
          >
            <Workflow size={36} style={{ color: 'var(--color-primary)' }} />
          </div>

          <div>
            <h1
              className="text-3xl font-normal"
              style={{
                color: 'var(--color-ink)',
                letterSpacing: '-0.72px',
                lineHeight: 1.2,
              }}
            >
              Fluxion
            </h1>
            <p
              className="mt-2 text-sm"
              style={{ color: 'var(--color-muted)', lineHeight: 1.5 }}
            >
              Run local agents across your codebase as a workflow.
            </p>
          </div>
        </div>

        <div
          className="h-px w-full"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, var(--color-hairline-strong) 50%, transparent 100%)',
          }}
        />

        <div
          className="w-full rounded-lg px-4 py-4"
          style={{
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-hairline)',
          }}
        >
          <p
            className="text-center text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
          >
            Build AI workflows in 3 steps
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {ONBOARDING_STEPS.map((step, index) => (
              <div
                key={step}
                className="flex min-w-0 items-center gap-2 sm:flex-col sm:text-center"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold"
                  style={{
                    color: 'var(--color-primary)',
                    background: 'var(--color-canvas)',
                    border: '1px solid var(--color-hairline)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {index + 1}
                </span>
                <span
                  className="min-w-0 text-xs font-medium"
                  style={{ color: 'var(--color-body-strong)' }}
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-4">
          <p
            className="max-w-lg text-center text-xs"
            style={{ color: 'var(--color-muted)', lineHeight: 1.6 }}
          >
            Open a project folder so Fluxion can read context, save workflow files, and
            write agent output locally.
          </p>

          <Button
            variant="primary"
            size="lg"
            onClick={handleOpenWorkspace}
            disabled={isWorkspaceOpening}
          >
            <FolderOpen size={16} />
            {isWorkspaceOpening ? 'Opening...' : 'Open Project Folder'}
          </Button>

          <p
            className="text-[11px]"
            style={{ color: 'var(--color-muted-soft)', fontFamily: 'var(--font-mono)' }}
          >
            You can also drop a project folder here.
          </p>
        </div>

        {recentWorkspaces.length > 0 ? (
          <div
            className="w-full rounded-lg px-4 py-4"
            style={{
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)',
            }}
          >
            <div className="mb-3 flex items-center gap-2">
              <Clock3 size={14} style={{ color: 'var(--color-muted)' }} />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                Recent
              </h2>
            </div>
            <div className="grid gap-2">
              {recentWorkspaces.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  onClick={() => handleOpenRecentWorkspace(entry.path)}
                  disabled={isWorkspaceOpening}
                  className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--color-canvas)] disabled:cursor-not-allowed"
                  style={{
                    color: isWorkspaceOpening ? 'var(--color-muted-soft)' : 'var(--color-ink)',
                    border: '1px solid var(--color-hairline)',
                    background: 'var(--color-canvas-soft)',
                  }}
                >
                  <FolderOpen size={15} className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{entry.name}</span>
                    <span
                      className="block truncate text-[11px]"
                      style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                    >
                      {entry.path}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {shouldShowReadinessCard ? (
          <div
            className="w-full rounded-lg px-4 py-3"
            style={{
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)',
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                style={{
                  background: 'var(--color-canvas)',
                  border: '1px solid var(--color-hairline)',
                  color: readinessTone,
                }}
              >
                <AlertTriangle size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                    {readinessCardTitle}
                  </h2>
                  <StatusChip
                    tone={readinessChipTone}
                    label={codexReadiness.label}
                    className="shrink-0"
                  />
                </div>
                <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                  {providerReadiness.primaryDetail}
                </p>
              </div>
            </div>

            <div
              className="mt-3 flex items-center justify-between gap-3 rounded-md px-3 py-2"
              style={{
                background: 'var(--color-canvas)',
                border: '1px solid var(--color-hairline)',
              }}
            >
              <span
                className="truncate text-[11px]"
                style={{ color: 'var(--color-body)', fontFamily: 'var(--font-mono)' }}
              >
                {providerReadiness.primaryActionCommand ?? 'codex login status'}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchProviderCapabilities(true)}
                disabled={isProviderCapabilitiesLoading}
              >
                Refresh
              </Button>
            </div>
          </div>
        ) : (
          <Tooltip content={codexReadiness.detail}>
            <div className="flex items-center justify-center">
              <StatusChip
                tone={readinessChipTone}
                label={compactReadinessLabel}
                animate={isProviderCapabilitiesLoading}
              />
            </div>
          </Tooltip>
        )}
      </div>

      <GlobalSettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      {trustDialog}
      <WorkspaceOpeningOverlay />
    </div>
  );
};
