import React from 'react'
import { ExternalLink, FolderOpen, Trash2 } from 'lucide-react'
import type { RecentWorkspaceEntry } from '@shared'
import { Tooltip } from '@renderer/components/ui/Tooltip'
import { formatRecentTimestamp } from '../lib/workspace-open-helpers'

const RecentActionButton: React.FC<{
  label: string
  disabled: boolean
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
}> = ({ label, disabled, onClick, children }) => (
  <Tooltip content={label}>
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-canvas)] disabled:cursor-not-allowed"
      style={{
        color: disabled ? 'var(--color-muted-soft)' : 'var(--color-muted)'
      }}
    >
      {children}
    </button>
  </Tooltip>
)

export const RecentWorkspaceRow: React.FC<{
  entry: RecentWorkspaceEntry
  disabled: boolean
  onOpen: (workspacePath: string) => void
  onReveal: (workspacePath: string) => void
  onRemove: (workspacePath: string) => void
}> = ({ entry, disabled, onOpen, onReveal, onRemove }) => (
  <div
    className="flex min-w-0 items-center gap-2 rounded-md px-2 py-2 transition-colors hover:bg-[var(--color-canvas)]"
    style={{
      background: 'var(--color-canvas-soft)',
      border: '1px solid var(--color-hairline)'
    }}
    title={entry.path}
  >
    <button
      type="button"
      onClick={() => onOpen(entry.path)}
      disabled={disabled}
      className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-not-allowed"
      style={{
        color: disabled ? 'var(--color-muted-soft)' : 'var(--color-ink)'
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
          event.stopPropagation()
          onReveal(entry.path)
        }}
      >
        <ExternalLink size={13} />
      </RecentActionButton>
      <RecentActionButton
        label="Remove from Recent"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation()
          onRemove(entry.path)
        }}
      >
        <Trash2 size={13} />
      </RecentActionButton>
    </div>
  </div>
)
