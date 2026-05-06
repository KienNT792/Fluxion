import React from 'react';
import { FolderOpen, KeyRound, Workflow } from 'lucide-react';
import { openWorkspaceFromDialog } from '../../lib/workflow-session';
import { Button } from '../ui/Button';
import { GlobalSettingsDialog } from './GlobalSettingsDialog';

export const WelcomeScreen: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  const handleOpenWorkspace = async (): Promise<void> => {
    await openWorkspaceFromDialog();
  };

  return (
    <div
      className="flex-1 h-screen w-full flex items-center justify-center select-none"
      style={{ background: 'var(--color-canvas)' }}
    >
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
            <Button variant="secondary" size="lg" onClick={() => setIsSettingsOpen(true)}>
              <KeyRound size={16} />
              Global Settings
            </Button>
            <Button variant="primary" size="lg" onClick={handleOpenWorkspace}>
              <FolderOpen size={16} />
              Open Project Folder
            </Button>
          </div>
        </div>

        {/* ── Keyboard hint ── */}
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
