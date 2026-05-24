import { Dispatch, SetStateAction, useCallback } from 'react'
import { getWorkflowCodexApprovalGuardrail } from '@shared'
import {
  createNewWorkflow,
  openWorkspaceFromDialog,
  reloadCurrentWorkspaceFromDisk,
  runCurrentWorkflow,
  saveCurrentWorkflow
} from '@renderer/lib/workflow-session'
import { useExecutionStore, WorkflowRuntimeStatus } from '@renderer/stores/execution.store'

interface UseTopbarActionsOptions {
  approvalGuardrail: ReturnType<typeof getWorkflowCodexApprovalGuardrail>
  fetchProviderCapabilities: (force?: boolean) => Promise<unknown>
  isBusy: boolean
  isCreatingWorkflow: boolean
  newWorkflowName: string
  requestWorkspaceTrust: (workspacePath: string) => Promise<boolean>
  setIsCreateWorkflowDialogOpen: Dispatch<SetStateAction<boolean>>
  setIsCreatingWorkflow: Dispatch<SetStateAction<boolean>>
  setIsProjectMenuOpen: Dispatch<SetStateAction<boolean>>
  setIsReadinessPopoverOpen: Dispatch<SetStateAction<boolean>>
  setNewWorkflowName: Dispatch<SetStateAction<string>>
  setSelectedNode: (nodeId: string | null) => void
  setWorkflowError: (error: string | null) => void
  setWorkflowStatus: (status: WorkflowRuntimeStatus) => void
  workflowStatus: WorkflowRuntimeStatus
  workspacePath: string | null
}

export function useTopbarActions({
  approvalGuardrail,
  fetchProviderCapabilities,
  isBusy,
  isCreatingWorkflow,
  newWorkflowName,
  requestWorkspaceTrust,
  setIsCreateWorkflowDialogOpen,
  setIsCreatingWorkflow,
  setIsProjectMenuOpen,
  setIsReadinessPopoverOpen,
  setNewWorkflowName,
  setSelectedNode,
  setWorkflowError,
  setWorkflowStatus,
  workflowStatus,
  workspacePath
}: UseTopbarActionsOptions): {
  handleAbort: () => void
  handleConfirmCreateWorkflow: () => Promise<void>
  handleCopyPath: (filePath: string) => Promise<void>
  handleFixPermissions: () => void
  handleOpenCreateWorkflowDialog: () => void
  handleOpenPath: (filePath: string) => Promise<void>
  handleOpenWorkspace: () => Promise<void>
  handleRefreshReadiness: () => Promise<void>
  handleReload: () => Promise<void>
  handleRevealPath: (filePath: string) => Promise<void>
  handleRun: () => void
  handleSave: () => Promise<void>
} {
  const handleRun = useCallback((): void => {
    void runCurrentWorkflow()
  }, [])

  const handleFixPermissions = useCallback((): void => {
    if (!approvalGuardrail.nodeId) {
      return
    }

    setSelectedNode(approvalGuardrail.nodeId)
  }, [approvalGuardrail.nodeId, setSelectedNode])

  const handleRefreshReadiness = useCallback(async (): Promise<void> => {
    await fetchProviderCapabilities(true)
  }, [fetchProviderCapabilities])

  const handleOpenWorkspace = useCallback(async (): Promise<void> => {
    try {
      setIsProjectMenuOpen(false)
      await openWorkspaceFromDialog({ requestWorkspaceTrust })
      setWorkflowError(null)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to open workspace.'
      setWorkflowError(errorMessage)
    }
  }, [requestWorkspaceTrust, setIsProjectMenuOpen, setWorkflowError])

  const handleSave = useCallback(async (): Promise<void> => {
    try {
      setIsProjectMenuOpen(false)
      await saveCurrentWorkflow()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save workflow.'
      setWorkflowError(errorMessage)
    }
  }, [setIsProjectMenuOpen, setWorkflowError])

  const handleOpenCreateWorkflowDialog = useCallback((): void => {
    if (!workspacePath || isBusy) {
      return
    }

    setIsProjectMenuOpen(false)
    setNewWorkflowName('')
    setIsCreateWorkflowDialogOpen(true)
  }, [
    isBusy,
    setIsCreateWorkflowDialogOpen,
    setIsProjectMenuOpen,
    setNewWorkflowName,
    workspacePath
  ])

  const handleConfirmCreateWorkflow = useCallback(async (): Promise<void> => {
    const trimmedName = newWorkflowName.trim()
    if (!trimmedName || isCreatingWorkflow) {
      return
    }

    setIsCreatingWorkflow(true)
    try {
      await createNewWorkflow(trimmedName)
      setWorkflowError(null)
      setIsCreateWorkflowDialogOpen(false)
      setNewWorkflowName('')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create workflow.'
      setWorkflowError(errorMessage)
    } finally {
      setIsCreatingWorkflow(false)
    }
  }, [
    isCreatingWorkflow,
    newWorkflowName,
    setIsCreateWorkflowDialogOpen,
    setIsCreatingWorkflow,
    setNewWorkflowName,
    setWorkflowError
  ])

  const handleReload = useCallback(async (): Promise<void> => {
    try {
      await reloadCurrentWorkspaceFromDisk()
      setWorkflowError(null)
      setIsReadinessPopoverOpen(false)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to reload workflow from disk.'
      setWorkflowError(errorMessage)
    }
  }, [setIsReadinessPopoverOpen, setWorkflowError])

  const handleAbort = useCallback((): void => {
    const previousStatus = workflowStatus
    setWorkflowStatus('stopping')
    setWorkflowError(null)
    void window.api.abortWorkflow().catch((error) => {
      const message = error instanceof Error ? error.message : 'Failed to abort workflow.'
      if (useExecutionStore.getState().workflowStatus === 'stopping') {
        setWorkflowStatus(previousStatus)
      }
      setWorkflowError(message)
    })
  }, [setWorkflowError, setWorkflowStatus, workflowStatus])

  const handleOpenPath = useCallback(
    async (filePath: string): Promise<void> => {
      try {
        await window.api.openPath(filePath)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to open file.'
        setWorkflowError(message)
      }
    },
    [setWorkflowError]
  )

  const handleRevealPath = useCallback(
    async (filePath: string): Promise<void> => {
      try {
        await window.api.revealPath(filePath)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to reveal file.'
        setWorkflowError(message)
      }
    },
    [setWorkflowError]
  )

  const handleCopyPath = useCallback(
    async (filePath: string): Promise<void> => {
      try {
        await navigator.clipboard.writeText(filePath)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to copy path.'
        setWorkflowError(message)
      }
    },
    [setWorkflowError]
  )

  return {
    handleAbort,
    handleConfirmCreateWorkflow,
    handleCopyPath,
    handleFixPermissions,
    handleOpenCreateWorkflowDialog,
    handleOpenPath,
    handleOpenWorkspace,
    handleRefreshReadiness,
    handleReload,
    handleRevealPath,
    handleRun,
    handleSave
  }
}
