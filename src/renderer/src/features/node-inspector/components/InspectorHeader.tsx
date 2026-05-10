import React from 'react'
import { ArrowRightFromLine, TerminalSquare, Trash2 } from 'lucide-react'
import type { NodeStatus } from '@shared'
import { StatusChip } from '@renderer/components/ui/StatusChip'
import { getNodeStatusLabel, NODE_STATUS_TONE } from '../lib/node-display'

interface InspectorHeaderProps {
  label: string
  modelDisplayName: string
  nodeStatus: NodeStatus
  onClose: () => void
  onDelete: () => void
  onLabelChange: (value: string) => void
  title: string
}

export const InspectorHeader: React.FC<InspectorHeaderProps> = ({
  label,
  modelDisplayName,
  nodeStatus,
  onClose,
  onDelete,
  onLabelChange,
  title
}) => (
  <div
    className="flex flex-shrink-0 items-start justify-between gap-3 px-5 py-4"
    style={{
      background: 'var(--color-surface-card)',
      borderBottom: '1px solid var(--color-hairline)'
    }}
  >
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <div
        className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
        style={{
          background: 'var(--color-canvas)',
          border: '1px solid var(--color-hairline)',
          color: nodeStatus === 'idle' ? 'var(--color-muted)' : 'var(--color-primary)'
        }}
      >
        <TerminalSquare size={15} />
      </div>

      <div className="min-w-0 flex-1">
        <input
          value={label}
          onChange={(event) => onLabelChange(event.target.value)}
          placeholder={title}
          className="w-full rounded-md border px-2.5 py-1.5 text-sm font-semibold outline-none transition-colors placeholder:text-[var(--color-muted-soft)] focus:border-[var(--color-primary)]"
          style={{
            background: 'var(--color-canvas-soft)',
            borderColor: 'var(--color-hairline)',
            color: 'var(--color-ink)',
            letterSpacing: 0
          }}
          title={title}
        />
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <StatusChip
            tone={NODE_STATUS_TONE[nodeStatus]}
            label={getNodeStatusLabel(nodeStatus)}
            animate={nodeStatus === 'running' || nodeStatus === 'stopping'}
          />
          <span
            className="min-w-0 truncate text-[11px]"
            style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
            title={modelDisplayName}
          >
            Codex / {modelDisplayName}
          </span>
        </div>
      </div>
    </div>

    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label="Delete node"
        onClick={onDelete}
        className="rounded-md p-1.5 transition-colors hover:bg-[var(--color-canvas-soft)]"
        style={{ color: 'var(--color-semantic-error)' }}
        title="Delete Node"
      >
        <Trash2 size={14} />
      </button>
      <button
        type="button"
        aria-label="Close node inspector"
        onClick={onClose}
        className="rounded-md p-1.5 transition-colors hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)]"
        style={{ color: 'var(--color-muted)' }}
        title="Close"
      >
        <ArrowRightFromLine size={14} />
      </button>
    </div>
  </div>
)
