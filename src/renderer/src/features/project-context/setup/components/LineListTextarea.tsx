import React from 'react'
import { Textarea } from '@renderer/components/ui/Textarea'
import { splitLines } from '../lib/context-setup-model'

export const LineListTextarea: React.FC<{
  label: string
  values: string[]
  placeholder: string
  hint?: string
  rows?: number
  onChange: (values: string[]) => void
}> = ({ label, values, placeholder, hint, rows = 4, onChange }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
        {label}
      </label>
      {hint ? (
        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
          {hint}
        </span>
      ) : null}
    </div>
    <Textarea
      value={values.join('\n')}
      onChange={(event) => onChange(splitLines(event.target.value))}
      rows={rows}
      placeholder={placeholder}
      surface="canvas"
    />
  </div>
)
