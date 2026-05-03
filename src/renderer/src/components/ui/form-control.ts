import React from 'react';

export type FormControlSize = 'sm' | 'md';
export type FormControlFont = 'sans' | 'mono';
export type FormControlTone = 'default' | 'accent';
export type FormControlSurface = 'card' | 'canvas';

interface FormControlStyleOptions {
  size?: FormControlSize;
  font?: FormControlFont;
  tone?: FormControlTone;
  surface?: FormControlSurface;
  disabled?: boolean;
  invalid?: boolean;
  isFocused?: boolean;
  multiline?: boolean;
  resize?: React.CSSProperties['resize'];
}

interface FormControlMetrics {
  fontSize: string;
  height: string;
  paddingInline: string;
  paddingBlock: string;
}

const CONTROL_METRICS: Record<FormControlSize, FormControlMetrics> = {
  sm: {
    fontSize: '13px',
    height: '32px',
    paddingInline: '12px',
    paddingBlock: '8px',
  },
  md: {
    fontSize: '14px',
    height: '36px',
    paddingInline: '12px',
    paddingBlock: '10px',
  },
};

function getBackground(surface: FormControlSurface, disabled: boolean | undefined): string {
  if (disabled) {
    return 'var(--color-canvas-soft)';
  }

  return surface === 'canvas'
    ? 'var(--color-canvas)'
    : 'var(--color-surface-card)';
}

export function getFormControlStyle({
  size = 'md',
  font = 'sans',
  tone = 'default',
  surface = 'card',
  disabled = false,
  invalid = false,
  isFocused = false,
  multiline = false,
  resize,
}: FormControlStyleOptions = {}): React.CSSProperties {
  const metrics = CONTROL_METRICS[size];
  const borderColor = invalid
    ? 'var(--color-semantic-error)'
    : isFocused
      ? 'var(--color-primary)'
      : 'var(--color-hairline)';

  return {
    width: '100%',
    borderRadius: 'var(--radius-md)',
    border: `1px solid ${borderColor}`,
    background: getBackground(surface, disabled),
    color: disabled
      ? 'var(--color-muted-soft)'
      : tone === 'accent'
        ? 'var(--color-primary)'
        : 'var(--color-ink)',
    fontFamily: font === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)',
    fontSize: metrics.fontSize,
    fontWeight: tone === 'accent' ? 600 : 400,
    lineHeight: font === 'mono' ? '1.6' : '1.45',
    outline: 'none',
    transition: 'border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease',
    boxShadow: 'none',
    opacity: disabled ? 0.9 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
    padding: multiline
      ? `${metrics.paddingBlock} ${metrics.paddingInline}`
      : `0 ${metrics.paddingInline}`,
    minHeight: multiline ? undefined : metrics.height,
    resize: multiline ? resize ?? 'vertical' : undefined,
  };
}
