import React from 'react'
import { Tooltip } from '@renderer/components/ui/Tooltip'

interface ActionTextButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  dimmed?: boolean
}

export const ActionTextButton = React.forwardRef<HTMLButtonElement, ActionTextButtonProps>(
  ({ className = '', dimmed = false, disabled = false, children, style, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-ink)] ${className}`}
      style={{
        color: disabled ? 'var(--color-muted-soft)' : 'var(--color-muted)',
        opacity: dimmed ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style
      }}
      {...props}
    >
      {children}
    </button>
  )
)

ActionTextButton.displayName = 'ActionTextButton'

export const ActionIconButton = React.forwardRef<HTMLButtonElement, ActionTextButtonProps>(
  ({ className = '', dimmed = false, disabled = false, children, style, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={`relative inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-ink)] ${className}`}
      style={{
        color: disabled ? 'var(--color-muted-soft)' : 'var(--color-muted)',
        opacity: dimmed ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style
      }}
      {...props}
    >
      {children}
    </button>
  )
)

ActionIconButton.displayName = 'ActionIconButton'

export const ActivityFileAction: React.FC<{
  label: string
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
}> = ({ label, onClick, children }) => (
  <Tooltip content={label}>
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-canvas)]"
      style={{ color: 'var(--color-muted)' }}
    >
      {children}
    </button>
  </Tooltip>
)
