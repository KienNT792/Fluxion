import React from 'react'

export const PreviewTabButton: React.FC<{
  active: boolean
  onClick: () => void
  label: string
}> = ({ active, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center rounded-md px-2.5 py-1.5 text-xs transition-colors"
    style={{
      color: active ? 'var(--color-ink)' : 'var(--color-muted)',
      background: active ? 'var(--color-surface-card)' : 'transparent',
      border: `1px solid ${active ? 'var(--color-hairline)' : 'transparent'}`
    }}
  >
    {label}
  </button>
)
