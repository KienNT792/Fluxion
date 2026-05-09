import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { CopyableCommand } from './CopyableCommand'

interface PrerequisiteBlockProps {
  code: 'cli_missing' | 'auth_missing'
  actionCommand?: string
}

export const PrerequisiteBlock: React.FC<PrerequisiteBlockProps> = ({ code, actionCommand }) => {
  const isCliMissing = code === 'cli_missing'

  const title = isCliMissing ? 'Codex CLI is not installed' : 'Codex CLI is not logged in'
  const description = isCliMissing
    ? 'Fluxion requires Codex CLI to run workflows. Install it with npm, then log in.'
    : 'Codex CLI is installed but you are not authenticated. Run the command below, then refresh.'

  const installCommand = 'npm install -g @openai/codex'
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
  )
}
