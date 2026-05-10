import React, { useMemo, useState } from 'react'
import { Copy, ExternalLink, FileText, FolderOpen } from 'lucide-react'
import { Tooltip } from './Tooltip'
import { splitDisplayPath } from './file-path-card.helpers'

interface FilePathCardProps {
  path?: string | null
  emptyLabel?: string
  disabled?: boolean
  onOpen?: (path: string) => void | Promise<void>
  onReveal?: (path: string) => void | Promise<void>
  onCopy?: (path: string) => void | Promise<void>
  onError?: (message: string) => void
  className?: string
}

const FileActionButton: React.FC<{
  label: string
  disabled: boolean
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
}> = ({ label, disabled, onClick, children }) => (
  <Tooltip content={label}>
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-canvas)] disabled:cursor-not-allowed"
      style={{
        color: disabled ? 'var(--color-muted-soft)' : 'var(--color-muted)'
      }}
    >
      {children}
    </button>
  </Tooltip>
)

export const FilePathCard: React.FC<FilePathCardProps> = ({
  path,
  emptyLabel = 'No output written yet',
  disabled = false,
  onOpen,
  onReveal,
  onCopy,
  onError,
  className = ''
}) => {
  const [copyLabel, setCopyLabel] = useState('Copy path')
  const parts = useMemo(() => splitDisplayPath(path), [path])
  const hasPath = Boolean(parts.fullPath)
  const isDisabled = disabled || !hasPath

  const runAction = async (
    action: ((path: string) => void | Promise<void>) | undefined,
    fallback: ((path: string) => void | Promise<void>) | undefined
  ): Promise<void> => {
    if (isDisabled || !parts.fullPath) {
      return
    }

    try {
      await (action ?? fallback)?.(parts.fullPath)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'File action failed.'
      onError?.(message)
    }
  }

  const handleCopy = async (): Promise<void> => {
    if (isDisabled || !parts.fullPath) {
      return
    }

    try {
      if (onCopy) {
        await onCopy(parts.fullPath)
      } else {
        await navigator.clipboard.writeText(parts.fullPath)
      }
      setCopyLabel('Copied')
      window.setTimeout(() => setCopyLabel('Copy path'), 1200)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to copy path.'
      onError?.(message)
    }
  }

  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded-md px-3 py-2 ${className}`}
      style={{
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline)',
        opacity: disabled ? 0.75 : 1
      }}
      title={parts.fullPath || emptyLabel}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{
          background: 'var(--color-canvas)',
          border: '1px solid var(--color-hairline)',
          color: hasPath ? 'var(--color-primary)' : 'var(--color-muted-soft)'
        }}
      >
        <FileText size={15} />
      </div>

      <button
        type="button"
        disabled={isDisabled}
        onClick={() => void runAction(onOpen, window.api?.openPath)}
        className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
        style={{ color: hasPath ? 'var(--color-ink)' : 'var(--color-muted)' }}
      >
        <div className="truncate text-xs font-semibold">
          {hasPath ? parts.basename : emptyLabel}
        </div>
        <div
          className="mt-0.5 truncate text-[10px]"
          style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {hasPath ? parts.parentPath : 'Run this node to create an output file.'}
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        <FileActionButton
          label="Open"
          disabled={isDisabled}
          onClick={(event) => {
            event.stopPropagation()
            void runAction(onOpen, window.api?.openPath)
          }}
        >
          <ExternalLink size={13} />
        </FileActionButton>
        <FileActionButton
          label="Reveal"
          disabled={isDisabled}
          onClick={(event) => {
            event.stopPropagation()
            void runAction(onReveal, window.api?.revealPath)
          }}
        >
          <FolderOpen size={13} />
        </FileActionButton>
        <FileActionButton
          label={copyLabel}
          disabled={isDisabled}
          onClick={(event) => {
            event.stopPropagation()
            void handleCopy()
          }}
        >
          <Copy size={13} />
        </FileActionButton>
      </div>
    </div>
  )
}
