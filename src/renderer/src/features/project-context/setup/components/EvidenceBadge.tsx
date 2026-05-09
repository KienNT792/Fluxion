import React from 'react'
import { StatusChip, StatusChipTone } from '@renderer/components/ui/StatusChip'

const CONFIDENCE_TONE: Record<'high' | 'medium' | 'low', StatusChipTone> = {
  high: 'success',
  medium: 'warning',
  low: 'error'
}

export const EvidenceBadge: React.FC<{
  sourcePath: string
  confidence: 'high' | 'medium' | 'low'
  note?: string
}> = ({ sourcePath, confidence, note }) => (
  <div
    className="rounded-md px-2.5 py-2"
    style={{
      background: 'var(--color-surface-card)',
      border: '1px solid var(--color-hairline)'
    }}
    title={note}
  >
    <div className="flex items-center justify-between gap-2">
      <span
        className="truncate text-[11px]"
        style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}
      >
        {sourcePath}
      </span>
      <StatusChip tone={CONFIDENCE_TONE[confidence]} label={confidence} />
    </div>
    {note ? (
      <p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
        {note}
      </p>
    ) : null}
  </div>
)
