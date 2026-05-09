import React from 'react'
import { ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { Button } from '@renderer/components/ui/Button'
import { StatusChip, StatusChipTone } from '@renderer/components/ui/StatusChip'
import { CODEX_COMMANDS, CommandRow } from '../lib/settings-copy'

interface CodexCliSettingsSectionProps {
  codexCopy: {
    title: string
    detail: string
    tone: StatusChipTone
  }
  codexReadiness: {
    label: string
  }
  copiedCommandId: string | null
  isProviderCapabilitiesLoading: boolean
  isSaving: boolean
  onCopyCommand: (command: CommandRow) => void
  onRefreshCodex: () => void
  setShowCodexCommands: React.Dispatch<React.SetStateAction<boolean>>
  showCodexCommands: boolean
}

export const CodexCliSettingsSection: React.FC<CodexCliSettingsSectionProps> = ({
  codexCopy,
  codexReadiness,
  copiedCommandId,
  isProviderCapabilitiesLoading,
  isSaving,
  onCopyCommand,
  onRefreshCodex,
  setShowCodexCommands,
  showCodexCommands
}) => (
  <section
    className="rounded-lg px-3 py-3"
    style={{
      background: 'var(--color-canvas)',
      border: '1px solid var(--color-hairline)'
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
        onClick={onRefreshCodex}
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
              border: '1px solid var(--color-hairline)'
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
              onClick={() => onCopyCommand(command)}
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
)
