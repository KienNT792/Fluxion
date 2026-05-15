import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallbackTitle: string
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    error: null
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  public componentDidCatch(error: Error): void {
    console.error(this.props.fallbackTitle, error)
  }

  public render(): React.ReactNode {
    if (this.state.error) {
      return (
        <aside
          className="z-40 flex h-full flex-col overflow-hidden px-5 py-4"
          style={{
            width: '300px',
            flexShrink: 0,
            background: 'var(--color-canvas)',
            borderLeft: '1px solid var(--color-hairline)'
          }}
        >
          <div
            className="rounded-lg p-4"
            style={{
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)',
              color: 'var(--color-semantic-error)'
            }}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.08em]">
              {this.props.fallbackTitle}
            </div>
            <div className="mt-2 text-xs" style={{ color: 'var(--color-muted)' }}>
              {this.state.error.message}
            </div>
          </div>
        </aside>
      )
    }

    return this.props.children
  }
}
