import React, { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  FormControlFont,
  FormControlSize,
  FormControlSurface,
  FormControlTone
} from '../form-control'
import { SelectMenu } from './SelectMenu'
import { SelectTrigger } from './SelectTrigger'
import {
  buildChangeEvent,
  DEFAULT_MENU_HEIGHT,
  parseOptions,
  SelectChangeEvent
} from './select-options'
import { useSelectPosition } from './use-select-position'

export type { SelectChangeEvent } from './select-options'

export interface SelectProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'defaultValue' | 'onChange' | 'size' | 'type' | 'value'
> {
  children: React.ReactNode
  defaultValue?: string
  invalid?: boolean
  menuClassName?: string
  name?: string
  onChange?: (event: SelectChangeEvent) => void
  onValueChange?: (value: string) => void
  placeholder?: string
  size?: FormControlSize
  font?: FormControlFont
  tone?: FormControlTone
  surface?: FormControlSurface
  value?: string
  wrapperClassName?: string
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      children,
      className = '',
      defaultValue,
      disabled = false,
      font = 'sans',
      invalid = false,
      menuClassName = '',
      name,
      onBlur,
      onChange,
      onFocus,
      onValueChange,
      placeholder = 'Select an option',
      size = 'md',
      style,
      surface = 'card',
      tone = 'default',
      value,
      wrapperClassName = '',
      ...props
    },
    ref
  ) => {
    const listboxId = useId()
    const wrapperRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const isControlled = value !== undefined
    const options = useMemo(() => parseOptions(children), [children])
    const [internalValue, setInternalValue] = useState(defaultValue ?? '')
    const [isFocused, setIsFocused] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const { clearMenuPosition, menuPosition, updateMenuPosition } = useSelectPosition(triggerRef)

    const currentValue = isControlled ? String(value ?? '') : internalValue
    const selectedIndex = options.findIndex((option) => option.value === currentValue)
    const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null

    const setTriggerRef = useCallback(
      (node: HTMLButtonElement | null) => {
        triggerRef.current = node

        if (!ref) {
          return
        }

        if (typeof ref === 'function') {
          ref(node)
          return
        }

        ref.current = node
      },
      [ref]
    )

    const getEnabledIndex = useCallback(
      (startIndex: number, direction: 1 | -1): number => {
        if (options.length === 0) {
          return -1
        }

        let index = startIndex

        for (let steps = 0; steps < options.length; steps += 1) {
          index = (index + direction + options.length) % options.length

          if (!options[index].disabled) {
            return index
          }
        }

        return -1
      },
      [options]
    )

    const closeMenu = useCallback(() => {
      setIsOpen(false)
      clearMenuPosition()
    }, [clearMenuPosition])

    const emitChange = useCallback(
      (nextValue: string) => {
        onValueChange?.(nextValue)
        onChange?.(buildChangeEvent(name, nextValue))
      },
      [name, onChange, onValueChange]
    )

    const selectValue = useCallback(
      (nextValue: string) => {
        if (!isControlled) {
          setInternalValue(nextValue)
        }

        emitChange(nextValue)
        closeMenu()
        triggerRef.current?.focus()
      },
      [closeMenu, emitChange, isControlled]
    )

    useEffect(() => {
      if (disabled && isOpen) {
        closeMenu()
      }
    }, [closeMenu, disabled, isOpen])

    useEffect(() => {
      if (isControlled) {
        return
      }

      if (options.some((option) => option.value === internalValue)) {
        return
      }

      const fallbackValue =
        (defaultValue && options.find((option) => option.value === defaultValue)?.value) ??
        options.find((option) => !option.disabled)?.value ??
        ''

      setInternalValue(fallbackValue)
    }, [defaultValue, internalValue, isControlled, options])

    useEffect(() => {
      if (!isOpen) {
        return
      }

      const startingIndex =
        selectedIndex >= 0 && !options[selectedIndex]?.disabled
          ? selectedIndex
          : options.findIndex((option) => !option.disabled)

      setHighlightedIndex(startingIndex)
    }, [isOpen, options, selectedIndex])

    useEffect(() => {
      if (!isOpen) {
        return
      }

      updateMenuPosition(menuRef.current?.offsetHeight ?? DEFAULT_MENU_HEIGHT)

      const handlePointerDown = (event: PointerEvent): void => {
        const target = event.target as Node

        if (wrapperRef.current?.contains(target) || menuRef.current?.contains(target)) {
          return
        }

        closeMenu()
      }

      const handleViewportChange = (): void => {
        updateMenuPosition(menuRef.current?.offsetHeight ?? DEFAULT_MENU_HEIGHT)
      }

      document.addEventListener('pointerdown', handlePointerDown)
      window.addEventListener('resize', handleViewportChange)
      window.addEventListener('scroll', handleViewportChange, true)

      return () => {
        document.removeEventListener('pointerdown', handlePointerDown)
        window.removeEventListener('resize', handleViewportChange)
        window.removeEventListener('scroll', handleViewportChange, true)
      }
    }, [closeMenu, isOpen, updateMenuPosition])

    useEffect(() => {
      if (!isOpen || highlightedIndex < 0) {
        return
      }

      const highlightedOption = menuRef.current?.querySelector<HTMLElement>(
        `[data-select-option-index="${highlightedIndex}"]`
      )

      highlightedOption?.scrollIntoView({ block: 'nearest' })
    }, [highlightedIndex, isOpen])

    const toggleMenu = (): void => {
      if (disabled || options.length === 0) {
        return
      }

      setIsOpen((previous) => {
        if (previous) {
          clearMenuPosition()
        }

        return !previous
      })
    }

    const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
      if (disabled) {
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()

        if (!isOpen) {
          setIsOpen(true)
          return
        }

        setHighlightedIndex((previous) => getEnabledIndex(previous, 1))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()

        if (!isOpen) {
          setIsOpen(true)
          return
        }

        setHighlightedIndex((previous) => getEnabledIndex(previous, -1))
        return
      }

      if (event.key === 'Home') {
        if (!isOpen) {
          return
        }

        event.preventDefault()
        setHighlightedIndex(options.findIndex((option) => !option.disabled))
        return
      }

      if (event.key === 'End') {
        if (!isOpen) {
          return
        }

        event.preventDefault()

        for (let index = options.length - 1; index >= 0; index -= 1) {
          if (!options[index].disabled) {
            setHighlightedIndex(index)
            break
          }
        }

        return
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()

        if (!isOpen) {
          setIsOpen(true)
          return
        }

        if (highlightedIndex >= 0 && !options[highlightedIndex]?.disabled) {
          selectValue(options[highlightedIndex].value)
        }

        return
      }

      if (event.key === 'Escape') {
        if (!isOpen) {
          return
        }

        event.preventDefault()
        closeMenu()
        return
      }

      if (event.key === 'Tab') {
        closeMenu()
      }
    }

    return (
      <>
        {name ? <input type="hidden" name={name} value={currentValue} /> : null}

        <div
          ref={wrapperRef}
          className={`relative w-full ${wrapperClassName}`}
          data-form-control="true"
        >
          <SelectTrigger
            {...props}
            className={className}
            disabled={disabled}
            font={font}
            invalid={invalid}
            isFocused={isFocused}
            isOpen={isOpen}
            listboxId={listboxId}
            placeholder={placeholder}
            selectedOption={selectedOption}
            setTriggerRef={setTriggerRef}
            size={size}
            style={style}
            surface={surface}
            tone={tone}
            onClick={toggleMenu}
            onFocus={(event) => {
              setIsFocused(true)
              onFocus?.(event)
            }}
            onBlur={(event) => {
              setIsFocused(false)
              closeMenu()
              onBlur?.(event)
            }}
            onKeyDown={handleTriggerKeyDown}
          />
        </div>

        {isOpen ? (
          <SelectMenu
            currentValue={currentValue}
            font={font}
            highlightedIndex={highlightedIndex}
            listboxId={listboxId}
            menuClassName={menuClassName}
            menuPosition={menuPosition}
            menuRef={menuRef}
            options={options}
            size={size}
            onHighlight={setHighlightedIndex}
            onSelect={selectValue}
          />
        ) : null}
      </>
    )
  }
)

Select.displayName = 'Select'
