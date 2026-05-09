import React from 'react'
import { getFormControlStyle } from '@renderer/components/ui/form-control'

export const LABEL_STYLE: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-ink)',
  letterSpacing: '-0.1px',
  display: 'block',
  marginBottom: '6px'
}

export const READONLY_INLINE_STYLE: React.CSSProperties = {
  ...getFormControlStyle({ font: 'mono' }),
  display: 'flex',
  alignItems: 'center',
  cursor: 'default'
}

export const READONLY_BLOCK_STYLE: React.CSSProperties = {
  ...getFormControlStyle({ font: 'mono', multiline: true, resize: 'none' }),
  cursor: 'default'
}

export const MUTED_NOTE_STYLE: React.CSSProperties = {
  fontSize: '11px',
  lineHeight: 1.5,
  color: 'var(--color-muted)'
}
