import React from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { FormControlFont, FormControlSize } from '../form-control'
import { DEFAULT_MENU_HEIGHT, ParsedOption } from './select-options'
import { MenuPosition } from './use-select-position'

interface SelectMenuProps {
  currentValue: string
  font: FormControlFont
  highlightedIndex: number
  listboxId: string
  menuClassName: string
  menuPosition: MenuPosition | null
  menuRef: React.RefObject<HTMLDivElement | null>
  onHighlight: (index: number) => void
  onSelect: (value: string) => void
  options: ParsedOption[]
  size: FormControlSize
}

export function SelectMenu({
  currentValue,
  font,
  highlightedIndex,
  listboxId,
  menuClassName,
  menuPosition,
  menuRef,
  onHighlight,
  onSelect,
  options,
  size
}: SelectMenuProps): React.JSX.Element | null {
  if (!menuPosition) {
    return null
  }

  return createPortal(
    <div
      ref={menuRef}
      role="listbox"
      id={listboxId}
      aria-activedescendant={
        highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
      }
      className={`overflow-y-auto rounded-lg ${menuClassName}`}
      style={{
        position: 'fixed',
        top: menuPosition.top,
        left: menuPosition.left,
        width: menuPosition.width,
        maxHeight: `${DEFAULT_MENU_HEIGHT}px`,
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-lg)',
        padding: '6px',
        zIndex: 120
      }}
    >
      {options.map((option, index) => {
        const isActive = option.value === currentValue
        const isHighlighted = highlightedIndex === index

        return (
          <button
            key={option.key}
            id={`${listboxId}-option-${index}`}
            type="button"
            role="option"
            aria-selected={isActive}
            data-form-control="true"
            data-select-option-index={index}
            disabled={option.disabled}
            tabIndex={-1}
            className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors"
            style={{
              background: isHighlighted
                ? 'var(--color-canvas-soft)'
                : isActive
                  ? 'var(--color-canvas)'
                  : 'transparent',
              color: option.disabled
                ? 'var(--color-muted-soft)'
                : isActive
                  ? 'var(--color-primary)'
                  : 'var(--color-ink)',
              cursor: option.disabled ? 'not-allowed' : 'pointer',
              fontFamily: font === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)',
              fontSize: size === 'sm' ? '13px' : '14px',
              fontWeight: isActive ? 600 : 400,
              opacity: option.disabled ? 0.65 : 1
            }}
            onMouseDown={(event) => {
              event.preventDefault()
            }}
            onMouseEnter={() => {
              if (!option.disabled) {
                onHighlight(index)
              }
            }}
            onClick={() => {
              if (!option.disabled) {
                onSelect(option.value)
              }
            }}
          >
            <span className="truncate">{option.label}</span>
            <span
              className="flex h-4 w-4 items-center justify-center"
              style={{
                color: isActive ? 'var(--color-primary)' : 'transparent'
              }}
            >
              <Check size={14} />
            </span>
          </button>
        )
      })}
    </div>,
    document.body
  )
}
