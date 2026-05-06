import React from 'react';
import { AlertTriangle, CheckCircle2, FolderOpen, Settings, Workflow } from 'lucide-react';
import { getCodexReadinessBadgeState } from '../../lib/provider-capabilities';
import { openWorkspaceFromDialog } from '../../lib/workflow-session';
import { useWorkflowStore } from '../../stores/workflow.store';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { GlobalSettingsDialog } from './GlobalSettingsDialog';

export const WelcomeScreen: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities);
  const isProviderCapabilitiesLoading = useWorkflowStore(
    (state) => state.isProviderCapabilitiesLoading
  );
  const hasFetchedProviderCapabilities = useWorkflowStore(
    (state) => state.hasFetchedProviderCapabilities
  );
  const fetchProviderCapabilities = useWorkflowStore((state) => state.fetchProviderCapabilities);
  const codexReadiness = getCodexReadinessBadgeState(providerCapabilities, []);

  React.useEffect(() => {
    if (!hasFetchedProviderCapabilities) {
      void fetchProviderCapabilities();
    }
  }, [fetchProviderCapabilities, hasFetchedProviderCapabilities]);

  const handleOpenWorkspace = async (): Promise<void> => {
    await openWorkspaceFromDialog();
  };

  const readinessTone =
    codexReadiness.tone === 'ready'
      ? 'var(--color-semantic-success)'
      : codexReadiness.tone === 'blocked'
        ? 'var(--color-semantic-error)'
        : 'var(--color-timeline-done)';

  return (
    <div
      className="relative flex-1 h-screen w-full flex items-center justify-center select-none"
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

      <div className="flex flex-col items-center gap-10 max-w-md px-8">
        {/* ── Logo & Branding ── */}
        <div className="flex flex-col items-center gap-5">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)',
            }}
          >
            <Workflow size={36} style={{ color: 'var(--color-primary)' }} />
          </div>

          <div className="text-center">
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
              className="text-sm mt-2"
              style={{ color: 'var(--color-muted)', lineHeight: 1.5 }}
            >
              AI Agent Workflow Orchestrator
            </p>
          </div>
        </div>

        {/* ── Accent hairline ── */}
        <div
          className="w-full h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, var(--color-hairline-strong) 50%, transparent 100%)',
          }}
        />

        {/* ── CTA Section ── */}
        <div className="flex flex-col items-center gap-4 w-full">
          <p
            className="text-xs text-center"
            style={{ color: 'var(--color-muted)', lineHeight: 1.6 }}
          >
            Open a project folder to begin orchestrating your AI workflow.
            <br />
            Fluxion runs real workflows through your local Codex CLI.
          </p>

          <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button variant="primary" size="lg" onClick={handleOpenWorkspace}>
              <FolderOpen size={16} />
              Open Project Folder
            </Button>
          </div>
        </div>

        {/* ── Codex readiness ── */}
        <div
          className="w-full rounded-lg px-3 py-3"
          style={{
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-hairline)',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {codexReadiness.tone === 'ready' ? (
                <CheckCircle2 size={14} style={{ color: readinessTone }} />
              ) : (
                <AlertTriangle size={14} style={{ color: readinessTone }} />
              )}
              <span
                className="truncate text-xs font-semibold"
                style={{ color: 'var(--color-ink)' }}
              >
                Codex CLI
              </span>
            </div>
            <span
              className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold"
              style={{
                color: readinessTone,
                background: 'var(--color-canvas)',
                border: '1px solid var(--color-hairline)',
              }}
            >
              {isProviderCapabilitiesLoading ? 'Checking...' : codexReadiness.label}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
            {codexReadiness.detail}
          </p>
          {codexReadiness.blocking && (
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
                {codexReadiness.actionCommand ?? 'codex login status'}
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
          )}
        </div>

        <p
          className="text-[11px] font-mono"
          style={{ color: 'var(--color-muted-soft)' }}
        >
          or drag a folder onto this window
        </p>
      </div>

      <GlobalSettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
