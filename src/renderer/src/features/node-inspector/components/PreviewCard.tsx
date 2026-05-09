import React from 'react'
import { TextSummary } from '../lib/node-display'

export const PreviewCard: React.FC<{
  summary: TextSummary
  emptyTone?: boolean
}> = ({ summary, emptyTone = false }) => (
  <div
    className="rounded-md px-3 py-2"
    style={{
      background: 'var(--color-surface-card)',
      border: '1px solid var(--color-hairline)'
    }}
  >
    <pre
      className="max-h-[120px] overflow-hidden whitespace-pre-wrap text-[11px] leading-5"
      style={{
        color: emptyTone || summary.isEmpty ? 'var(--color-muted)' : 'var(--color-body)',
        fontFamily: 'var(--font-mono)'
      }}
    >
      {summary.preview}
    </pre>
    <div
      className="mt-2 text-[10px]"
      style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
    >
      {summary.lineCount} lines / {summary.characterCount} chars
    </div>
  </div>
)
