import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { CopyableCommand } from './CopyableCommand'

interface PrerequisiteBlockProps {
  code: 'cli_missing' | 'windowsapps_alias_blocked' | 'auth_missing'
  actionCommand?: string
}

export const PrerequisiteBlock: React.FC<PrerequisiteBlockProps> = ({ code, actionCommand }) => {
  const isCliMissing = code === 'cli_missing'
  const isAliasBlocked = code === 'windowsapps_alias_blocked'

  const title = isAliasBlocked
    ? 'Codex WindowsApps alias is blocking Fluxion'
    : isCliMissing
      ? 'Codex CLI is not available to Fluxion'
      : 'Codex CLI is not logged in'
  const description = isAliasBlocked
    ? 'Windows resolved codex to an App Execution Alias that Fluxion cannot spawn. Install or update the Codex CLI in Windows, then put that command ahead of WindowsApps in PATH or disable the alias.'
    : isCliMissing
      ? 'Fluxion requires a Windows-visible Codex CLI to run workflows. Install it in the Windows environment or expose the existing codex command in PATH, then log in.'
      : 'Codex CLI is installed but you are not authenticated. Run the command below, then refresh.'

  const installCommand = actionCommand && actionCommand !== 'codex login' ? actionCommand : 'pnpm add -g @openai/codex'
  const loginCommand = actionCommand ?? 'codex login'

  return (
    <div
      className="w-full rounded-xl px-5 py-5 sm:px-7"
      style={{
        background: 'var(--color-canvas-soft)',
        border: '1px solid var(--color-hairline)'
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
            {(isCliMissing || isAliasBlocked) && <CopyableCommand command={installCommand} />}
            {!isAliasBlocked && <CopyableCommand command={loginCommand} />}
          </div>
          {(isCliMissing || isAliasBlocked) && (
            <p className="mt-3 text-[11px] leading-5" style={{ color: 'var(--color-muted-soft)' }}>
              After installation and PATH or alias changes, relaunch Fluxion or click{' '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>Refresh readiness</span> in Settings.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
