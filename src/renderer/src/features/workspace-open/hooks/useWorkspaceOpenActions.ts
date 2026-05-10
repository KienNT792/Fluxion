import React from 'react'
import { openWorkspaceFromDialog, openWorkspacePath } from '@renderer/lib/workflow-session'
import { getErrorMessage, hasFileDrop } from '../lib/workspace-open-helpers'

interface UseWorkspaceOpenActionsOptions {
  isWorkspaceOpening: boolean
  requestWorkspaceTrust: (workspacePath: string) => Promise<boolean>
  setWorkspaceActionError: React.Dispatch<React.SetStateAction<string | null>>
}

interface WorkspaceDropHandlers {
  onDragEnter: (event: React.DragEvent<HTMLDivElement>) => void
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void
}

export function useWorkspaceOpenActions({
  isWorkspaceOpening,
  requestWorkspaceTrust,
  setWorkspaceActionError
}: UseWorkspaceOpenActionsOptions): {
  dropHandlers: WorkspaceDropHandlers
  handleOpenRecentWorkspace: (workspacePath: string) => Promise<void>
  handleOpenWorkspace: () => Promise<void>
  isDragActive: boolean
} {
  const [isDragActive, setIsDragActive] = React.useState(false)
  const dragDepthRef = React.useRef(0)

  const handleOpenWorkspace = React.useCallback(async (): Promise<void> => {
    setWorkspaceActionError(null)

    try {
      await openWorkspaceFromDialog({ requestWorkspaceTrust })
    } catch {
      // The opening overlay owns the visible error state.
    }
  }, [requestWorkspaceTrust, setWorkspaceActionError])

  const handleOpenRecentWorkspace = React.useCallback(
    async (workspacePath: string): Promise<void> => {
      setWorkspaceActionError(null)

      try {
        await openWorkspacePath(workspacePath, { requestWorkspaceTrust })
      } catch {
        // The opening overlay owns the visible error state.
      }
    },
    [requestWorkspaceTrust, setWorkspaceActionError]
  )

  const resetDragState = React.useCallback((): void => {
    dragDepthRef.current = 0
    setIsDragActive(false)
  }, [])

  const handleDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      if (!hasFileDrop(event.dataTransfer)) {
        return
      }

      event.preventDefault()

      if (isWorkspaceOpening) {
        return
      }

      dragDepthRef.current += 1
      setIsDragActive(true)
    },
    [isWorkspaceOpening]
  )

  const handleDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      if (!hasFileDrop(event.dataTransfer)) {
        return
      }

      event.preventDefault()
      event.dataTransfer.dropEffect = isWorkspaceOpening ? 'none' : 'copy'
    },
    [isWorkspaceOpening]
  )

  const handleDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>): void => {
    if (!hasFileDrop(event.dataTransfer)) {
      return
    }

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDragActive(false)
    }
  }, [])

  const handleDrop = React.useCallback(
    async (event: React.DragEvent<HTMLDivElement>): Promise<void> => {
      if (!hasFileDrop(event.dataTransfer)) {
        return
      }

      event.preventDefault()
      resetDragState()

      if (isWorkspaceOpening) {
        return
      }

      const droppedFile = Array.from(event.dataTransfer.files)[0]
      if (!droppedFile) {
        setWorkspaceActionError('Drop a project folder to open it as a workspace.')
        return
      }

      let droppedPath = ''
      try {
        droppedPath = window.api?.getPathForFile?.(droppedFile) ?? ''
      } catch {
        droppedPath = ''
      }

      if (!droppedPath) {
        setWorkspaceActionError('Fluxion could not read the dropped folder path.')
        return
      }

      if (!window.api?.validateWorkspaceDirectory) {
        setWorkspaceActionError('Workspace validation is not available.')
        return
      }

      try {
        const validation = await window.api.validateWorkspaceDirectory(droppedPath)
        if (!validation.ok) {
          setWorkspaceActionError(validation.message)
          return
        }

        setWorkspaceActionError(null)
        await openWorkspacePath(validation.path, { requestWorkspaceTrust })
      } catch (error) {
        setWorkspaceActionError(getErrorMessage(error, 'Failed to open dropped workspace.'))
      }
    },
    [isWorkspaceOpening, requestWorkspaceTrust, resetDragState, setWorkspaceActionError]
  )

  return {
    dropHandlers: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: (event) => {
        void handleDrop(event)
      }
    },
    handleOpenRecentWorkspace,
    handleOpenWorkspace,
    isDragActive
  }
}
