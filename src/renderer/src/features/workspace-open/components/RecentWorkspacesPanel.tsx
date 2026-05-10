import React from 'react'
import { ChevronRight } from 'lucide-react'
import type { RecentWorkspaceEntry } from '@shared'
import { RecentWorkspaceRow } from './RecentWorkspaceRow'

interface RecentWorkspacesPanelProps {
  disabled: boolean
  entries: RecentWorkspaceEntry[]
  onOpen: (workspacePath: string) => void
  onRemove: (workspacePath: string) => void
  onReveal: (workspacePath: string) => void
}

export const RecentWorkspacesPanel: React.FC<RecentWorkspacesPanelProps> = ({
  disabled,
  entries,
  onOpen,
  onRemove,
  onReveal
}) => (
  <div
    className="rounded-lg px-4 py-4"
    style={{
      background: 'var(--color-surface-card)',
      border: '1px solid var(--color-hairline)'
    }}
  >
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
        Recent Workspaces
      </h2>
      {entries.length > 0 && (
        <button
          type="button"
          className="inline-flex items-center gap-0.5 text-xs font-medium transition-colors hover:opacity-80"
          style={{
            color: 'var(--color-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          View all
          <ChevronRight size={12} />
        </button>
      )}
    </div>
    {entries.length > 0 ? (
      <div className="grid gap-1.5">
        {entries.map((entry) => (
          <RecentWorkspaceRow
            key={entry.path}
            entry={entry}
            disabled={disabled}
            onOpen={onOpen}
            onReveal={onReveal}
            onRemove={onRemove}
          />
        ))}
      </div>
    ) : (
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        No recent workspaces yet. Open a project folder to get started.
      </p>
    )}
  </div>
)
