import React from 'react'

export function DockTabButton({
  label,
  icon,
  active,
  attentionColor,
  attentionPulse = false,
  badge,
  onClick
}: {
  label: string
  icon: React.ReactNode
  active: boolean
  attentionColor?: string
  attentionPulse?: boolean
  badge?: number
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors"
      style={{
        color: active ? 'var(--color-ink)' : 'var(--color-muted)',
        borderBottom: active ? '1.5px solid var(--color-primary)' : '1.5px solid transparent',
        background: active ? 'var(--color-canvas-soft)' : 'transparent'
      }}
      onMouseEnter={(event) => {
        if (!active) {
          event.currentTarget.style.color = 'var(--color-ink)'
          event.currentTarget.style.background = 'var(--color-canvas-soft)'
        }
      }}
      onMouseLeave={(event) => {
        if (!active) {
          event.currentTarget.style.color = 'var(--color-muted)'
          event.currentTarget.style.background = 'transparent'
        }
      }}
    >
      {icon}
      {label}
      {typeof badge === 'number' && badge > 0 ? (
        <span
          className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none"
          style={{
            color: badge > 0 ? 'white' : 'var(--color-ink)',
            background: attentionColor ?? 'var(--color-primary)'
          }}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
      {!badge && attentionColor ? (
        <span
          className={`h-1.5 w-1.5 rounded-full ${attentionPulse ? 'animate-pulse' : ''}`}
          style={{ background: attentionColor }}
        />
      ) : null}
    </button>
  )
}
