import React from 'react'
import { getNextBinarySwitchValueFromKey } from './binary-switch.helpers'

interface BinarySwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  leftLabel: string
  rightLabel: string
  disabled?: boolean
  ariaLabel?: string
  className?: string
  title?: string
}

export const BinarySwitch: React.FC<BinarySwitchProps> = ({
  checked,
  onChange,
  leftLabel,
  rightLabel,
  disabled = false,
  ariaLabel,
  className = '',
  title
}) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    const nextValue = getNextBinarySwitchValueFromKey(event.key, checked)
    if (nextValue == null) {
      return
    }

    event.preventDefault()
    if (!disabled && nextValue !== checked) {
      onChange(nextValue)
    } else if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
      onChange(nextValue)
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? `${leftLabel} / ${rightLabel}`}
      disabled={disabled}
      title={title}
      onClick={() => {
        if (!disabled) {
          onChange(!checked)
        }
      }}
      onKeyDown={handleKeyDown}
      className={`relative inline-grid h-8 min-w-[136px] grid-cols-2 items-center rounded-md p-0.5 text-[11px] font-semibold uppercase transition-colors ${className}`}
      style={{
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline)',
        color: disabled ? 'var(--color-muted-soft)' : 'var(--color-muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.72 : 1
      }}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-0.5 top-0.5 w-[calc(50%-2px)] rounded-[5px] transition-transform"
        style={{
          background: 'var(--color-primary)',
          transform: checked ? 'translateX(calc(100% + 0px))' : 'translateX(0)',
          left: '2px'
        }}
      />
      <span
        className="relative z-10 flex items-center justify-center px-2"
        style={{ color: checked ? 'var(--color-muted)' : 'var(--color-on-primary)' }}
      >
        {leftLabel}
      </span>
      <span
        className="relative z-10 flex items-center justify-center px-2"
        style={{ color: checked ? 'var(--color-on-primary)' : 'var(--color-muted)' }}
      >
        {rightLabel}
      </span>
    </button>
  )
}
