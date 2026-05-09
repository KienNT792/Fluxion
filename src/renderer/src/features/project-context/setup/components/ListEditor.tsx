import React, { useCallback, useState } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'

export const ListEditor: React.FC<{
  label: string
  values: string[]
  placeholder: string
  hint?: string
  monospace?: boolean
  suggestions?: string[]
  onChange: (values: string[]) => void
}> = ({ label, values, placeholder, hint, monospace = false, suggestions = [], onChange }) => {
  const [pendingValue, setPendingValue] = useState('')

  const handleAdd = useCallback(
    (value: string) => {
      const nextValue = value.trim()
      if (!nextValue || values.includes(nextValue)) {
        setPendingValue('')
        return
      }

      onChange([...values, nextValue])
      setPendingValue('')
    },
    [onChange, values]
  )

  return (
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

      <div className="flex items-center gap-2">
        <Input
          value={pendingValue}
          onChange={(event) => setPendingValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleAdd(pendingValue)
            }
          }}
          placeholder={placeholder}
          surface="canvas"
          font={monospace ? 'mono' : 'sans'}
        />
        <Button
          variant="secondary"
          onClick={() => handleAdd(pendingValue)}
          disabled={!pendingValue.trim()}
        >
          Add
        </Button>
      </div>

      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleAdd(suggestion)}
              className="rounded-full px-2.5 py-1 text-[11px] transition-colors"
              style={{
                background: 'var(--color-canvas-soft)',
                border: '1px solid var(--color-hairline)',
                color: 'var(--color-muted)',
                fontFamily: monospace ? 'var(--font-mono)' : 'inherit'
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(values.filter((entry) => entry !== value))}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors"
              style={{
                background: 'var(--color-surface-card)',
                border: '1px solid var(--color-hairline)',
                color: 'var(--color-ink)',
                fontFamily: monospace ? 'var(--font-mono)' : 'inherit'
              }}
            >
              <span>{value}</span>
              <span style={{ color: 'var(--color-muted)' }}>x</span>
            </button>
          ))
        ) : (
          <div
            className="rounded-md px-3 py-2 text-xs"
            style={{
              color: 'var(--color-muted)',
              border: '1px dashed var(--color-hairline-strong)',
              background: 'var(--color-canvas-soft)'
            }}
          >
            Unknown is better than guessed. Add items only when they are true.
          </div>
        )}
      </div>
    </div>
  )
}
