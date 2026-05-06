import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound } from 'lucide-react';
import { ProviderSettingsSummaryPayload } from '@shared';
import { getCodexReadinessBadgeState } from '../../lib/provider-capabilities';
import { useWorkflowStore } from '../../stores/workflow.store';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface GlobalSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function getStatusCopy(summary: ProviderSettingsSummaryPayload | null): {
  label: string;
  detail: string;
  tone: string;
} {
  if (!summary || !summary.openaiApiKeyConfigured) {
    return {
      label: 'Missing',
      detail: 'No OpenAI API key is configured.',
      tone: 'var(--color-semantic-error)',
    };
  }

  if (summary.openaiApiKeySource === 'env') {
    return {
      label: 'Environment',
      detail: `Using ${summary.openaiApiKeyMasked ?? 'OPENAI_API_KEY'} from the process environment.`,
      tone: 'var(--color-timeline-done)',
    };
  }

  return {
    label: summary.storageMode === 'secure' ? 'Stored Securely' : 'Stored Locally',
    detail: `Using ${summary.openaiApiKeyMasked ?? 'saved key'} from Fluxion settings.`,
    tone: 'var(--color-semantic-success)',
  };
}

export const GlobalSettingsDialog: React.FC<GlobalSettingsDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    if (!isOpen) {
      setApiKeyInput('');
      setError(null);
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
    if (!isOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen]);

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

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const statusCopy = getStatusCopy(summary);
  const codexReadiness = getCodexReadinessBadgeState(providerCapabilities, []);
  const codexTone =
    codexReadiness.tone === 'ready'
      ? 'var(--color-semantic-success)'
      : codexReadiness.tone === 'blocked'
        ? 'var(--color-semantic-error)'
        : 'var(--color-timeline-edit)';
  const canClearStoredKey = summary?.openaiApiKeySource === 'stored';

  const handleRefreshCodex = async (): Promise<void> => {
    await fetchProviderCapabilities(true);
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
      await fetchProviderCapabilities();
      onClose();
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
      className="fixed inset-0 z-[130] flex items-center justify-center px-4"
      style={{ background: 'rgba(38, 37, 30, 0.4)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global Settings"
        className="w-full max-w-lg overflow-hidden rounded-lg"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex items-start gap-3 px-5 py-4"
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
              Check the local Codex CLI runtime and configure optional OpenAI API credentials.
              Settings are stored outside the workspace and never written into `workflow.json`.
            </p>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div
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
              <span
                className="rounded-md px-2 py-1 text-[11px] font-semibold"
                style={{
                  color: codexTone,
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-hairline)',
                }}
              >
                {isProviderCapabilitiesLoading ? 'Checking...' : codexReadiness.label}
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
              {codexReadiness.summary}
            </p>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
              {codexReadiness.detail}
            </p>
            <div className="mt-3 grid gap-1 text-[11px]" style={{ color: 'var(--color-muted)' }}>
              <span style={{ fontFamily: 'var(--font-mono)' }}>Install: npm i -g @openai/codex</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>Login: codex login</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>Check: codex login status</span>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRefreshCodex}
                disabled={isProviderCapabilitiesLoading || isSaving}
              >
                {isProviderCapabilitiesLoading ? 'Refreshing...' : 'Refresh Codex'}
              </Button>
            </div>
          </div>

          <div
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
                OpenAI Auth
              </span>
              <span
                className="rounded-md px-2 py-1 text-[11px] font-semibold"
                style={{
                  color: statusCopy.tone,
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-hairline)',
                }}
              >
                {isLoading ? 'Loading...' : statusCopy.label}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
              {isLoading ? 'Checking current provider settings...' : statusCopy.detail}
            </p>
          </div>

          <div>
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
              surface="canvas"
              font="mono"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
              Leave the field empty to keep the current key. Saving a new key replaces the stored
              one immediately.
            </p>
          </div>

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
          className="flex items-center justify-between gap-2 px-5 py-4"
          style={{ borderTop: '1px solid var(--color-hairline)' }}
        >
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClearStoredKey}
              disabled={!canClearStoredKey || isSaving}
            >
              Clear Stored Key
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
              Close
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Key'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
