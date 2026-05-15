import React, { useCallback, useRef, useState } from 'react'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

export function useWorkspaceTrustPrompt(): {
  requestWorkspaceTrust: (workspacePath: string) => Promise<boolean>
  trustDialog: React.ReactNode
} {
  const [pendingWorkspacePath, setPendingWorkspacePath] = useState<string | null>(null)
  const resolverRef = useRef<((isTrusted: boolean) => void) | null>(null)

  const resolvePendingTrust = useCallback((isTrusted: boolean): void => {
    resolverRef.current?.(isTrusted)
    resolverRef.current = null
    setPendingWorkspacePath(null)
  }, [])

  const requestWorkspaceTrust = useCallback((workspacePath: string): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setPendingWorkspacePath(workspacePath)
    })
  }, [])

  return {
    requestWorkspaceTrust,
    trustDialog: (
      <ConfirmDialog
        isOpen={Boolean(pendingWorkspacePath)}
        title="Trust this workspace?"
        description={
          pendingWorkspacePath ? (
            <div className="space-y-3">
              <p>Fluxion will create and manage workflow data inside this folder.</p>
              <ul className="space-y-1">
                <li>Creates or updates `.fluxion/`.</li>
                <li>Stores workflows, runs, and local context.</li>
                <li>May read files after you trust it to build local context.</li>
              </ul>
              <p>You should only trust workspaces you control.</p>
              <p
                className="break-all rounded-md px-3 py-2"
                style={{
                  background: 'var(--color-canvas-soft)',
                  border: '1px solid var(--color-hairline)',
                  color: 'var(--color-body)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {pendingWorkspacePath}
              </p>
            </div>
          ) : (
            ''
          )
        }
        confirmLabel="Trust and Open"
        cancelLabel="Cancel"
        confirmVariant="primary"
        iconTone="accent"
        onConfirm={() => resolvePendingTrust(true)}
        onCancel={() => resolvePendingTrust(false)}
      />
    )
  }
}
