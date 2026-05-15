import React, { useCallback, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { FileText, RefreshCcw } from 'lucide-react'
import { Button } from './Button'

interface OutputPreviewProps {
  workspacePath?: string | null
  path?: string | null
  attemptCount?: number
  onError?: (message: string) => void
}

interface PreviewState {
  content: string
  truncated: boolean
  isLoading: boolean
  error: string | null
}

const EMPTY_STATE: PreviewState = {
  content: '',
  truncated: false,
  isLoading: false,
  error: null
}

export const OutputPreview: React.FC<OutputPreviewProps> = ({
  workspacePath,
  path,
  attemptCount,
  onError
}) => {
  const [state, setState] = useState<PreviewState>(EMPTY_STATE)
  const canRead = Boolean(workspacePath && path)

  const loadPreview = useCallback(async (): Promise<void> => {
    if (!workspacePath || !path) {
      setState(EMPTY_STATE)
      return
    }

    setState((current) => ({ ...current, isLoading: true, error: null }))

    try {
      const result = await window.api.readWorkspaceTextFile({
        workspacePath,
        filePath: path
      })

      setState({
        content: result.content,
        truncated: result.truncated,
        isLoading: false,
        error: null
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read output preview.'
      setState({
        content: '',
        truncated: false,
        isLoading: false,
        error: message
      })
      onError?.(message)
    }
  }, [onError, path, workspacePath])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadPreview()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadPreview])

  const previewLabel =
    attemptCount && attemptCount > 1 ? `Latest output - attempt ${attemptCount}` : 'Latest output'

  return (
    <div
      className="rounded-md"
      style={{
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline)'
      }}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-2"
        style={{ borderBottom: '1px solid var(--color-hairline-soft)' }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <FileText size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          <span className="truncate text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
            {previewLabel}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Refresh output preview"
          title="Refresh output preview"
          disabled={!canRead || state.isLoading}
          onClick={() => void loadPreview()}
          className="!h-7 !w-7 !min-w-7"
        >
          <RefreshCcw size={12} />
        </Button>
      </div>

      <div className="max-h-[260px] overflow-auto px-3 py-3">
        {!canRead && (
          <p className="text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
            Run this node to create an output preview.
          </p>
        )}

        {canRead && state.isLoading && (
          <p className="text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
            Loading output preview...
          </p>
        )}

        {canRead && !state.isLoading && state.error && (
          <p className="text-xs leading-5" style={{ color: 'var(--color-semantic-error)' }}>
            {state.error}
          </p>
        )}

        {canRead && !state.isLoading && !state.error && state.content.trim().length === 0 && (
          <p className="text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
            Output file is empty.
          </p>
        )}

        {canRead && !state.isLoading && !state.error && state.content.trim().length > 0 && (
          <div
            className="prose max-w-none text-xs leading-5"
            style={{
              color: 'var(--color-body)'
            }}
          >
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1
                    className="mb-2 text-base font-semibold"
                    style={{ color: 'var(--color-ink)' }}
                  >
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2
                    className="mb-2 mt-3 text-sm font-semibold"
                    style={{ color: 'var(--color-ink)' }}
                  >
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3
                    className="mb-1 mt-3 text-xs font-semibold"
                    style={{ color: 'var(--color-ink)' }}
                  >
                    {children}
                  </h3>
                ),
                p: ({ children }) => <p className="mb-2">{children}</p>,
                ul: ({ children }) => <ul className="mb-2 list-disc pl-5">{children}</ul>,
                ol: ({ children }) => <ol className="mb-2 list-decimal pl-5">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                code: ({ children }) => (
                  <code
                    className="rounded px-1 py-0.5"
                    style={{
                      background: 'var(--color-canvas)',
                      color: 'var(--color-ink)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre
                    className="mb-2 overflow-auto rounded-md p-2 text-[11px]"
                    style={{
                      background: 'var(--color-canvas)',
                      border: '1px solid var(--color-hairline)'
                    }}
                  >
                    {children}
                  </pre>
                )
              }}
            >
              {state.content}
            </ReactMarkdown>
          </div>
        )}

        {state.truncated && (
          <p
            className="mt-3 rounded-md px-2 py-1 text-[11px]"
            style={{
              color: 'var(--color-muted)',
              background: 'var(--color-canvas)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            Preview truncated at 256 KB. Open the file for the full output.
          </p>
        )}
      </div>
    </div>
  )
}
