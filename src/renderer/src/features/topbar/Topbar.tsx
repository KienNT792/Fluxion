import React, { useState } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { InputDialog } from '@renderer/components/ui/InputDialog'
import { GlobalSettingsDialog } from '@renderer/features/settings/GlobalSettingsDialog'
import { useWorkspaceTrustPrompt } from '@renderer/hooks/useWorkspaceTrustPrompt'
import { useExecutionStore } from '@renderer/stores/execution.store'
import { useThemeStore } from '@renderer/stores/theme.store'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { ProjectMenu } from './components/ProjectMenu'
import { ReadinessCluster } from './components/ReadinessCluster'
import { RunAbortControl } from './components/RunAbortControl'
import { ThemeSettingsButtons } from './components/ThemeSettingsButtons'
import { WorkflowIdentityStatus } from './components/WorkflowIdentityStatus'
import { useTopbarActions } from './hooks/useTopbarActions'
import { useTopbarDerivedState } from './hooks/useTopbarDerivedState'
import { useTopbarPopovers } from './hooks/useTopbarPopovers'

export const Topbar: React.FC = () => {
  const [isCreateWorkflowDialogOpen, setIsCreateWorkflowDialogOpen] = useState(false)
  const [newWorkflowName, setNewWorkflowName] = useState('')
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false)
  const [isReadinessPopoverOpen, setIsReadinessPopoverOpen] = useState(false)
  const { requestWorkspaceTrust, trustDialog } = useWorkspaceTrustPrompt()

  const workflowStatus = useExecutionStore((state) => state.workflowStatus)
  const workflowError = useExecutionStore((state) => state.workflowError)
  const setWorkflowError = useExecutionStore((state) => state.setWorkflowError)
  const setWorkflowStatus = useExecutionStore((state) => state.setWorkflowStatus)
  const reviewNodeIds = useExecutionStore((state) => state.reviewNodeIds)

  const nodes = useWorkflowStore((state) => state.nodes)
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities)
  const isProviderCapabilitiesLoading = useWorkflowStore(
    (state) => state.isProviderCapabilitiesLoading
  )
  const fetchProviderCapabilities = useWorkflowStore((state) => state.fetchProviderCapabilities)
  const workspacePath = useWorkflowStore((state) => state.workspacePath)
  const workflowName = useWorkflowStore((state) => state.workflowName)
  const isDirty = useWorkflowStore((state) => state.isDirty)
  const isSaving = useWorkflowStore((state) => state.isSaving)
  const saveError = useWorkflowStore((state) => state.saveError)
  const lastSavedAt = useWorkflowStore((state) => state.lastSavedAt)
  const hasExternalWorkflowChange = useWorkflowStore((state) => state.hasExternalWorkflowChange)
  const recentWorkspaceChanges = useWorkflowStore((state) => state.recentWorkspaceChanges)
  const setSelectedNode = useWorkflowStore((state) => state.setSelectedNode)
  const contextStatus = useWorkflowStore((state) => state.contextStatus)
  const setContextSetupOpen = useWorkflowStore((state) => state.setContextSetupOpen)
  const requestReviewFocus = useWorkflowStore((state) => state.requestReviewFocus)
  const workspaceOpenState = useWorkflowStore((state) => state.workspaceOpenState)
  const { theme, toggleTheme } = useThemeStore()

  const {
    activityDetailItems,
    aggregateReadiness,
    approvalGuardrail,
    canRun,
    canSave,
    codexReadiness,
    displayWorkflowName,
    isBusy,
    isPaused,
    isStopping,
    isWorkspaceOpening,
    reviewButtonLabel,
    reviewNodeLabel,
    runTooltip,
    workspaceName
  } = useTopbarDerivedState({
    contextStatus,
    hasExternalWorkflowChange,
    isDirty,
    isSaving,
    lastSavedAt,
    nodes,
    providerCapabilities,
    recentWorkspaceChanges,
    reviewNodeIds,
    saveError,
    workflowError,
    workflowName,
    workflowStatus,
    workspaceOpenPhase: workspaceOpenState.phase,
    workspacePath
  })
  const { projectMenuRef, readinessPopoverRef } = useTopbarPopovers({
    isProjectMenuOpen,
    isReadinessPopoverOpen,
    setIsProjectMenuOpen,
    setIsReadinessPopoverOpen
  })
  const {
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
  } = useTopbarActions({
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
  })

  return (
    <>
      <header
        className="relative z-[80] flex h-14 shrink-0 items-center px-3 sm:px-4 lg:px-5"
        style={{
          background: 'var(--color-canvas)',
          borderBottom: '1px solid var(--color-hairline)'
        }}
      >
        <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
          <WorkflowIdentityStatus
            displayWorkflowName={displayWorkflowName}
            workspaceName={workspaceName}
            workspacePath={workspacePath}
          />

          <div className="flex min-w-0 items-center justify-end gap-1.5">
            <ReadinessCluster
              activityDetailItems={activityDetailItems}
              aggregateReadiness={aggregateReadiness}
              approvalGuardrail={approvalGuardrail}
              codexReadiness={codexReadiness}
              disabled={isBusy}
              hasExternalWorkflowChange={hasExternalWorkflowChange}
              isLoading={isProviderCapabilitiesLoading}
              isOpen={isReadinessPopoverOpen}
              onCopyPath={(filePath) => void handleCopyPath(filePath)}
              onFixPermissions={handleFixPermissions}
              onOpenContext={() => setContextSetupOpen(true)}
              onOpenPath={(filePath) => void handleOpenPath(filePath)}
              onRefresh={() => void handleRefreshReadiness()}
              onReload={() => void handleReload()}
              onRevealPath={(filePath) => void handleRevealPath(filePath)}
              onToggle={() => setIsReadinessPopoverOpen((current) => !current)}
              readinessClusterRef={readinessPopoverRef}
            />
            <ProjectMenu
              canSave={canSave}
              disabled={isBusy}
              dimmed={isBusy}
              isOpen={isProjectMenuOpen}
              isWorkspaceOpening={isWorkspaceOpening}
              onCreateWorkflow={handleOpenCreateWorkflowDialog}
              onOpenWorkspace={handleOpenWorkspace}
              onRunOnboarding={() => {
                setIsProjectMenuOpen(false)
                setContextSetupOpen(true, 'onboarding')
              }}
              onSave={handleSave}
              onToggle={() => setIsProjectMenuOpen((current) => !current)}
              projectMenuRef={projectMenuRef}
              workspacePath={workspacePath}
            />
            <ThemeSettingsButtons
              disabled={isBusy}
              dimmed={isBusy}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onToggleTheme={toggleTheme}
              theme={theme}
            />
            {isPaused && reviewNodeIds.length > 0 && (
              <Button
                variant="secondary"
                size="toolbar"
                className="hidden min-w-[132px] shrink-0 md:inline-flex"
                title={reviewNodeLabel ? `Open review for ${String(reviewNodeLabel)}` : 'Open review panel'}
                onClick={() => requestReviewFocus(reviewNodeIds[0]!)}
              >
                {reviewButtonLabel}
              </Button>
            )}
            {approvalGuardrail.severity === 'blocked' && approvalGuardrail.nodeId && (
              <Button
                variant="secondary"
                size="toolbar"
                className="hidden min-w-[132px] shrink-0 md:inline-flex"
                title={approvalGuardrail.message}
                onClick={handleFixPermissions}
                disabled={isBusy}
              >
                Fix Permissions
              </Button>
            )}
            <RunAbortControl
              canRun={canRun}
              isBusy={isBusy}
              isStopping={isStopping}
              onAbort={handleAbort}
              onRun={handleRun}
              runTooltip={runTooltip}
            />
          </div>
        </div>

        <InputDialog
          isOpen={isCreateWorkflowDialogOpen}
          title="Create New Workflow"
          description="Enter a workflow name. Fluxion will create the file and switch to it."
          value={newWorkflowName}
          placeholder="e.g. Refactor auth adapter"
          confirmLabel={isCreatingWorkflow ? 'Creating...' : 'Create'}
          cancelLabel="Cancel"
          confirmDisabled={isCreatingWorkflow || !newWorkflowName.trim()}
          onValueChange={setNewWorkflowName}
          onCancel={() => {
            if (isCreatingWorkflow) {
              return
            }

            setIsCreateWorkflowDialogOpen(false)
            setNewWorkflowName('')
          }}
          onConfirm={handleConfirmCreateWorkflow}
        />

        <GlobalSettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </header>
      {trustDialog}
    </>
  )
}
