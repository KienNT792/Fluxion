import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Copy, KeyRound } from 'lucide-react';
import { ProviderSettingsSummaryPayload } from '@shared';
import { getCodexReadinessBadgeState } from '../../lib/provider-capabilities';
import { useModalFocusTrap } from '../../lib/use-modal-focus-trap';
import { useWorkflowStore } from '../../stores/workflow.store';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { StatusChip, StatusChipTone } from '../ui/StatusChip';

interface GlobalSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandRow {
  id: string;
  label: string;
  command: string;
}

const CODEX_COMMANDS: CommandRow[] = [
  { id: 'install', label: 'Install', command: 'npm i -g @openai/codex' },
  { id: 'login', label: 'Login', command: 'codex login' },
  { id: 'check', label: 'Check', command: 'codex login status' },
];

function getStatusCopy(summary: ProviderSettingsSummaryPayload | null): {
  label: string;
  detail: string;
  tone: StatusChipTone;
} {
  if (!summary || !summary.openaiApiKeyConfigured) {
    return {
      label: 'Not configured',
      detail: 'Not required for Codex CLI workflows. Add a key only for OpenAI API provider features.',
      tone: 'idle',
    };
  }

  if (summary.openaiApiKeySource === 'env') {
    return {
      label: 'Environment',
      detail: `Using ${summary.openaiApiKeyMasked ?? 'OPENAI_API_KEY'} from the process environment.`,
      tone: 'warning',
    };
  }

  return {
    label: summary.storageMode === 'secure' ? 'Stored Securely' : 'Stored Locally',
    detail: `Using ${summary.openaiApiKeyMasked ?? 'saved key'} from Fluxion settings.`,
    tone: 'success',
  };
}

function getCodexCopy(
  tone: 'ready' | 'warning' | 'blocked',
  detail: string
): {
  title: string;
  detail: string;
  tone: StatusChipTone;
} {
  if (tone === 'ready') {
    return {
      title: 'Codex CLI ready',
      detail: 'Codex CLI is ready. Fluxion can run workflows through your local Codex login.',
      tone: 'success',
    };
  }

  if (tone === 'blocked') {
    return {
      title: 'Codex setup needed',
      detail,
      tone: 'error',
    };
  }

  return {
    title: 'Codex warning',
    detail,
    tone: 'warning',
  };
}

export const GlobalSettingsDialog: React.FC<GlobalSettingsDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const fetchProviderCapabilities = useWorkflowStore((state) => state.fetchProviderCapabilities);
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities);
  const isProviderCapabilitiesLoading = useWorkflowStore(
    (state) => state.isProviderCapabilitiesLoading
  );

  const [summary, setSummary] = useState<ProviderSettingsSummaryPayload | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCodexCommands, setShowCodexCommands] = useState(false);
  const [isApiKeyEditorOpen, setIsApiKeyEditorOpen] = useState(false);
  const [copiedCommandId, setCopiedCommandId] = useState<string | null>(null);

  const statusCopy = getStatusCopy(summary);
  const codexReadiness = getCodexReadinessBadgeState(providerCapabilities, []);
  const codexCopy = getCodexCopy(codexReadiness.tone, codexReadiness.detail);
  const canClearStoredKey = summary?.openaiApiKeySource === 'stored';
  const apiKeyActionLabel = summary?.openaiApiKeyConfigured ? 'Replace Key' : 'Add API Key';

  useEffect(() => {
    if (!isOpen) {
      setApiKeyInput('');
      setError(null);
      setIsApiKeyEditorOpen(false);
      setCopiedCommandId(null);
      return;
    }

    let isCancelled = false;

    const loadSummary = async (): Promise<void> => {
      if (!window.api?.getProviderSettingsSummary) {
        setSummary(null);
        setError('Settings API is not available.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const nextSummary = await window.api.getProviderSettingsSummary();
        if (!isCancelled) {
          setSummary(nextSummary);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load provider settings.'
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSummary();

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setShowCodexCommands(codexReadiness.blocking);
    }
  }, [codexReadiness.blocking, isOpen]);

  useModalFocusTrap(isOpen, dialogRef);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isApiKeyEditorOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isApiKeyEditorOpen]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const handleRefreshCodex = async (): Promise<void> => {
    await fetchProviderCapabilities(true);
  };

  const handleCopyCommand = async (command: CommandRow): Promise<void> => {
    try {
      await navigator.clipboard.writeText(command.command);
      setCopiedCommandId(command.id);
      window.setTimeout(() => setCopiedCommandId(null), 1200);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : 'Failed to copy command.');
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!window.api?.setOpenAIApiKey) {
      setError('Settings API is not available.');
      return;
    }

    const normalizedApiKey = apiKeyInput.trim();
    if (!normalizedApiKey) {
      setError('Paste an OpenAI API key before saving.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const nextSummary = await window.api.setOpenAIApiKey(normalizedApiKey);
      setSummary(nextSummary);
      setApiKeyInput('');
      setIsApiKeyEditorOpen(false);
      await fetchProviderCapabilities();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Failed to save the OpenAI API key.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearStoredKey = async (): Promise<void> => {
    if (!window.api?.setOpenAIApiKey || !canClearStoredKey) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const nextSummary = await window.api.setOpenAIApiKey(null);
      setSummary(nextSummary);
      setApiKeyInput('');
      setIsApiKeyEditorOpen(false);
      await fetchProviderCapabilities();
    } catch (clearError) {
      setError(
        clearError instanceof Error ? clearError.message : 'Failed to clear the stored OpenAI API key.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center px-4 py-4"
      style={{ background: 'rgba(38, 37, 30, 0.4)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Global Settings"
        tabIndex={-1}
        className="flex max-h-[calc(100vh-32px)] w-full max-w-lg flex-col overflow-hidden rounded-lg"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-start gap-3 px-4 py-3 sm:px-5 sm:py-4"
          style={{ borderBottom: '1px solid var(--color-hairline)' }}
        >
          <div
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
            style={{
              background: 'var(--color-canvas-soft)',
              border: '1px solid var(--color-hairline)',
              color: 'var(--color-primary)',
            }}
          >
            <KeyRound size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              Global Settings
            </h3>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
              Codex CLI is the runtime for Fluxion workflows. OpenAI API credentials are optional
              and only needed for API provider features.
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
          <section
            className="rounded-lg px-3 py-3"
            style={{
              background: 'var(--color-canvas)',
              border: '1px solid var(--color-hairline)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: 'var(--color-muted)' }}
              >
                Codex CLI
              </span>
              <StatusChip
                tone={isProviderCapabilitiesLoading ? 'running' : codexCopy.tone}
                label={isProviderCapabilitiesLoading ? 'Checking...' : codexReadiness.label}
                animate={isProviderCapabilitiesLoading}
              />
            </div>
            <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
              {isProviderCapabilitiesLoading ? 'Checking Codex CLI...' : codexCopy.title}
            </p>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
              {isProviderCapabilitiesLoading
                ? 'Verifying local Codex CLI, login, and model catalog state.'
                : codexCopy.detail}
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                aria-expanded={showCodexCommands}
                aria-controls="codex-setup-commands"
                onClick={() => setShowCodexCommands((current) => !current)}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-[var(--color-surface-card)]"
                style={{ color: 'var(--color-muted)' }}
              >
                {showCodexCommands ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {showCodexCommands ? 'Hide setup commands' : 'Show setup commands'}
              </button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleRefreshCodex}
                disabled={isProviderCapabilitiesLoading || isSaving}
              >
                {isProviderCapabilitiesLoading ? 'Refreshing...' : 'Refresh Codex'}
              </Button>
            </div>

            {showCodexCommands && (
              <div id="codex-setup-commands" className="mt-3 grid gap-2">
                {CODEX_COMMANDS.map((command) => (
                  <div
                    key={command.id}
                    className="flex items-center justify-between gap-3 rounded-md px-3 py-2"
                    style={{
                      background: 'var(--color-surface-card)',
                      border: '1px solid var(--color-hairline)',
                    }}
                  >
                    <div className="min-w-0">
                      <div
                        className="text-[10px] font-semibold uppercase tracking-[0.08em]"
                        style={{ color: 'var(--color-muted)' }}
                      >
                        {command.label}
                      </div>
                      <div
                        className="truncate text-[11px]"
                        style={{ color: 'var(--color-body)', fontFamily: 'var(--font-mono)' }}
                      >
                        {command.command}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`Copy ${command.label.toLowerCase()} command`}
                      onClick={() => void handleCopyCommand(command)}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-canvas)]"
                      style={{ color: 'var(--color-muted)' }}
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                ))}
                {copiedCommandId && (
                  <div
                    className="text-[11px]"
                    style={{ color: 'var(--color-semantic-success)', fontFamily: 'var(--font-mono)' }}
                  >
                    Command copied.
                  </div>
                )}
              </div>
            )}
          </section>

          <section
            className="rounded-lg px-3 py-3"
            style={{
              background: 'var(--color-canvas)',
              border: '1px solid var(--color-hairline)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: 'var(--color-muted)' }}
              >
                OpenAI API Key
              </span>
              <StatusChip
                tone={isLoading ? 'running' : statusCopy.tone}
                label={isLoading ? 'Loading...' : statusCopy.label}
                animate={isLoading}
              />
            </div>
            <p className="mt-2 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
              {isLoading ? 'Checking current provider settings...' : statusCopy.detail}
            </p>
            <p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
              Stored outside the workspace and never written into workflow files.
              {summary?.storageMode === 'secure'
                ? ' Electron safeStorage is active for the saved key.'
                : ''}
            </p>

            {!isApiKeyEditorOpen ? (
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {canClearStoredKey && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleClearStoredKey}
                    disabled={isSaving}
                  >
                    Clear Stored Key
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    setIsApiKeyEditorOpen(true);
                  }}
                  disabled={isSaving}
                >
                  {apiKeyActionLabel}
                </Button>
              </div>
            ) : (
              <div className="mt-3">
                <label
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em]"
                  style={{ color: 'var(--color-muted)' }}
                >
                  OpenAI API Key
                </label>
                <Input
                  ref={inputRef}
                  type="password"
                  value={apiKeyInput}
                  onChange={(event) => setApiKeyInput(event.target.value)}
                  placeholder="sk-..."
                  surface="card"
                  font="mono"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
                  Optional. Saving a new key replaces the stored one immediately.
                </p>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setApiKeyInput('');
                      setIsApiKeyEditorOpen(false);
                      setError(null);
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Key'}
                  </Button>
                </div>
              </div>
            )}
          </section>

          {error && (
            <div
              className="rounded-md px-3 py-2 text-xs"
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: 'var(--color-semantic-error)',
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          className="flex shrink-0 items-center justify-end gap-2 px-4 py-3 sm:px-5 sm:py-4"
          style={{ borderTop: '1px solid var(--color-hairline)' }}
        >
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
