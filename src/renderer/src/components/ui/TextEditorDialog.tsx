import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw } from 'lucide-react'
import { useModalFocusTrap } from '../../lib/use-modal-focus-trap'
import { Button } from './Button'
import { Textarea } from './Textarea'

interface TextEditorDialogProps {
  isOpen: boolean
  title: string
  helperText?: string
  value: string
  defaultValue?: string
  placeholder?: string
  saveLabel?: string
  cancelLabel?: string
  resetLabel?: string
  showReset?: boolean
  onSave: (value: string) => void
  onCancel: () => void
}

type TextEditorDialogContentProps = Omit<TextEditorDialogProps, 'isOpen'>

export const TextEditorDialog: React.FC<TextEditorDialogProps> = ({ isOpen, ...props }) => {
  if (!isOpen || typeof document === 'undefined') {
    return null
  }

  return <TextEditorDialogContent key={props.value} {...props} />
}

const TextEditorDialogContent: React.FC<TextEditorDialogContentProps> = ({
  title,
  helperText,
  value,
  defaultValue = '',
  placeholder,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  resetLabel = 'Reset to Default',
  showReset = false,
  onSave,
  onCancel
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [draft, setDraft] = useState(value)

  useModalFocusTrap(true, dialogRef)

  useEffect(() => {
    window.setTimeout(() => textareaRef.current?.focus(), 0)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCancel()
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        onSave(draft)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [draft, onCancel, onSave])

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  const characterCount = draft.length
  const lineCount = draft ? draft.split(/\r\n|\r|\n/).length : 0
  const canReset = showReset && draft !== defaultValue

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-5 py-6"
      style={{ background: 'rgba(18, 18, 17, 0.52)', backdropFilter: 'blur(8px)' }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.24)'
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-start justify-between gap-5 px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-hairline)' }}
        >
          <div className="min-w-0">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              {title}
            </h3>
            {helperText && (
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                {helperText}
              </p>
            )}
          </div>
          <div
            className="shrink-0 text-[11px]"
            style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {lineCount} lines / {characterCount} chars
          </div>
        </div>

        <div className="min-h-0 flex-1 px-5 py-4">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholder}
            font="mono"
            className="h-[min(56vh,560px)] min-h-[320px]"
            style={{ resize: 'vertical' }}
          />
        </div>

        <div
          className="flex shrink-0 items-center justify-between gap-3 px-5 py-4"
          style={{ borderTop: '1px solid var(--color-hairline)' }}
        >
          <div>
            {showReset && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canReset}
                onClick={() => {
                  setDraft(defaultValue)
                  textareaRef.current?.focus()
                }}
              >
                <RotateCcw size={13} />
                {resetLabel}
              </Button>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button variant="primary" size="sm" onClick={() => onSave(draft)}>
              {saveLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
