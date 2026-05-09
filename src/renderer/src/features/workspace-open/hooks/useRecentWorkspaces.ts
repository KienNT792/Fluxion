import React from 'react'
import type { RecentWorkspaceEntry } from '@shared'
import { getErrorMessage } from '../lib/workspace-open-helpers'

export function useRecentWorkspaces(
  setWorkspaceActionError: React.Dispatch<React.SetStateAction<string | null>>
): {
  handleRemoveRecentWorkspace: (workspacePath: string) => Promise<void>
  handleRevealRecentWorkspace: (workspacePath: string) => Promise<void>
  recentWorkspaces: RecentWorkspaceEntry[]
} {
  const [recentWorkspaces, setRecentWorkspaces] = React.useState<RecentWorkspaceEntry[]>([])

  React.useEffect(() => {
    let isMounted = true

    async function loadRecentWorkspaces(): Promise<void> {
      if (!window.api?.listRecentWorkspaces) {
        return
      }

      try {
        const entries = await window.api.listRecentWorkspaces()
        if (isMounted) {
          setRecentWorkspaces(entries)
        }
      } catch {
        if (isMounted) {
          setRecentWorkspaces([])
        }
      }
    }

    void loadRecentWorkspaces()
    return () => {
      isMounted = false
    }
  }, [])

  const handleRevealRecentWorkspace = React.useCallback(
    async (workspacePath: string): Promise<void> => {
      if (!window.api?.revealPath) {
        return
      }

      try {
        await window.api.revealPath(workspacePath)
      } catch (error) {
        setWorkspaceActionError(getErrorMessage(error, 'Failed to reveal workspace.'))
      }
    },
    [setWorkspaceActionError]
  )

  const handleRemoveRecentWorkspace = React.useCallback(
    async (workspacePath: string): Promise<void> => {
      if (!window.api?.removeRecentWorkspace) {
        return
      }

      try {
        const entries = await window.api.removeRecentWorkspace(workspacePath)
        setRecentWorkspaces(entries)
        setWorkspaceActionError(null)
      } catch (error) {
        setWorkspaceActionError(
          getErrorMessage(error, 'Failed to remove workspace from recent list.')
        )
      }
    },
    [setWorkspaceActionError]
  )

  return {
    handleRemoveRecentWorkspace,
    handleRevealRecentWorkspace,
    recentWorkspaces
  }
}
