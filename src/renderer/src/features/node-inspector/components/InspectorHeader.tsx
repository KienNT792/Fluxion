import React from 'react'
import { ArrowRightFromLine, TerminalSquare, Trash2 } from 'lucide-react'

interface InspectorHeaderProps {
  title: string
  onClose: () => void
  onDelete: () => void
}

export const InspectorHeader: React.FC<InspectorHeaderProps> = ({ title, onClose, onDelete }) => (
  <div
    className="flex h-12 flex-shrink-0 items-center justify-between px-5"
    style={{
      background: 'var(--color-surface-card)',
      borderBottom: '1px solid var(--color-hairline)'
    }}
  >
    <div className="flex items-center gap-2.5">
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md"
        style={{
          background: 'var(--color-canvas)',
          border: '1px solid var(--color-hairline)',
          color: 'var(--color-primary)'
        }}
      >
        <TerminalSquare size={15} />
      </div>
      <span
        className="truncate text-xs font-semibold"
        style={{ color: 'var(--color-ink)', maxWidth: '220px', letterSpacing: '-0.1px' }}
      >
        {title}
      </span>
    </div>

    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Delete node"
        onClick={onDelete}
        className="rounded-md p-1.5 transition-colors"
        style={{ color: 'var(--color-semantic-error)' }}
        title="Delete Node"
        onMouseEnter={(event) => {
          event.currentTarget.style.background = '#fef2f2'
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = 'transparent'
        }}
      >
        <Trash2 size={14} />
      </button>
      <button
        type="button"
        aria-label="Close node inspector"
        onClick={onClose}
        className="rounded-md p-1.5 transition-colors"
        style={{ color: 'var(--color-muted)' }}
        title="Close"
        onMouseEnter={(event) => {
          event.currentTarget.style.background = 'var(--color-surface-strong)'
          event.currentTarget.style.color = 'var(--color-ink)'
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = 'transparent'
          event.currentTarget.style.color = 'var(--color-muted)'
        }}
      >
        <ArrowRightFromLine size={14} />
      </button>
    </div>
  </div>
)
