import React, { Children } from 'react'

interface SelectChangeTarget {
  name?: string
  value: string
}

export interface SelectChangeEvent {
  currentTarget: SelectChangeTarget
  target: SelectChangeTarget
  preventDefault: () => void
  stopPropagation: () => void
}

export interface ParsedOption {
  disabled: boolean
  key: React.Key
  label: React.ReactNode
  value: string
}

type NativeOptionElement = React.ReactElement<
  React.OptionHTMLAttributes<HTMLOptionElement>,
  'option'
>

export const DEFAULT_MENU_HEIGHT = 240

function getOptionValue(option: NativeOptionElement): string {
  if (option.props.value !== undefined && option.props.value !== null) {
    return String(option.props.value)
  }

  if (typeof option.props.children === 'string') {
    return option.props.children
  }

  return ''
}

function isOptionElement(child: React.ReactNode): child is NativeOptionElement {
  return (
    React.isValidElement<React.OptionHTMLAttributes<HTMLOptionElement>>(child) &&
    child.type === 'option'
  )
}

export function parseOptions(children: React.ReactNode): ParsedOption[] {
  return Children.toArray(children).flatMap((child, index) => {
    if (!isOptionElement(child)) {
      return []
    }

    return [
      {
        disabled: Boolean(child.props.disabled),
        key: child.key ?? `${getOptionValue(child)}-${index}`,
        label: child.props.children,
        value: getOptionValue(child)
      }
    ]
  })
}

export function buildChangeEvent(name: string | undefined, value: string): SelectChangeEvent {
  const target = { name, value }

  return {
    currentTarget: target,
    target,
    preventDefault: () => undefined,
    stopPropagation: () => undefined
  }
}
