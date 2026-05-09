import React from 'react'
import { ChevronDown } from 'lucide-react'
import {
  FormControlFont,
  FormControlSize,
  FormControlSurface,
  FormControlTone,
  getFormControlStyle
} from '../form-control'
import { ParsedOption } from './select-options'

interface SelectTriggerProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  font: FormControlFont
  invalid: boolean
  isFocused: boolean
  isOpen: boolean
  listboxId: string
  placeholder: string
  selectedOption: ParsedOption | null
  setTriggerRef: (node: HTMLButtonElement | null) => void
  size: FormControlSize
  surface: FormControlSurface
  tone: FormControlTone
}

export function SelectTrigger({
  className = '',
  disabled = false,
  font,
  invalid,
  isFocused,
  isOpen,
  listboxId,
  placeholder,
  selectedOption,
  setTriggerRef,
  size,
  style,
  surface,
  tone,
  ...props
}: SelectTriggerProps): React.JSX.Element {
  return (
    <button
      {...props}
      ref={setTriggerRef}
      type="button"
      disabled={disabled}
      role="combobox"
      aria-controls={isOpen ? listboxId : undefined}
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      data-form-control="true"
      className={`flex items-center justify-between gap-3 rounded-md text-left ${className}`}
      style={{
        ...getFormControlStyle({
          size,
          font,
          tone,
          surface,
          invalid,
          disabled,
          isFocused: isFocused || isOpen
        }),
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style
      }}
    >
      <span
        className="min-w-0 flex-1 truncate"
        style={{
          color: selectedOption
            ? tone === 'accent'
              ? 'var(--color-primary)'
              : 'var(--color-ink)'
            : 'var(--color-muted)',
          fontWeight: selectedOption && tone === 'accent' ? 600 : undefined
        }}
      >
        {selectedOption?.label ?? placeholder}
      </span>

      <span
        className="flex shrink-0 items-center"
        style={{
          color: disabled
            ? 'var(--color-muted-soft)'
            : tone === 'accent'
              ? 'var(--color-primary)'
              : 'var(--color-muted)',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s ease'
        }}
      >
        <ChevronDown size={14} />
      </span>
    </button>
  )
}
