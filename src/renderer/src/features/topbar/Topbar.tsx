import React, { useState } from 'react'
import { InputDialog } from '@renderer/components/ui/InputDialog'
import { GlobalSettingsDialog } from '@renderer/features/settings/GlobalSettingsDialog'
import { useWorkspaceTrustPrompt } from '@renderer/hooks/useWorkspaceTrustPrompt'
import { useExecutionStore } from '@renderer/stores/execution.store'
import { useThemeStore } from '@renderer/stores/theme.store'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { CodexReadinessPopover } from './components/CodexReadinessPopover'
import { ContextControl } from './components/ContextControl'
import { ProjectMenu } from './components/ProjectMenu'
import { RunAbortControl } from './components/RunAbortControl'
import { ThemeSettingsButtons } from './components/ThemeSettingsButtons'
import { WorkflowIdentityStatus } from './components/WorkflowIdentityStatus'
import { WorkspaceActivityPopover } from './components/WorkspaceActivityPopover'
import { useTopbarActions } from './hooks/useTopbarActions'
import { useTopbarDerivedState } from './hooks/useTopbarDerivedState'
import { useTopbarPopovers } from './hooks/useTopbarPopovers'

export const Topbar: React.FC = () => {
  const [isCreateWorkflowDialogOpen, setIsCreateWorkflowDialogOpen] = useState(false)
  const [newWorkflowName, setNewWorkflowName] = useState('')
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false)
  const [isActivityPopoverOpen, setIsActivityPopoverOpen] = useState(false)
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
    activityHasAttention,
    activitySummaryLabel,
    approvalGuardrail,
    canRun,
    canSave,
    codexReadiness,
    contextChipState,
    displayWorkflowName,
    isBusy,
    isPaused,
    isStopping,
    isWorkspaceOpening,
    readinessTone,
    reviewButtonLabel,
    reviewNodeLabel,
    runTooltip,
    saveChipState,
    saveStateLabel,
    statusSubtext,
    workflowChipLabel,
    workflowChipState,
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
  const { activityPopoverRef, projectMenuRef, readinessPopoverRef } = useTopbarPopovers({
    isActivityPopoverOpen,
    isProjectMenuOpen,
    isReadinessPopoverOpen,
    setIsActivityPopoverOpen,
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
    setIsActivityPopoverOpen,
    setIsCreateWorkflowDialogOpen,
    setIsCreatingWorkflow,
    setIsProjectMenuOpen,
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
        className="relative z-40 flex h-14 shrink-0 items-center px-3 sm:px-4 lg:px-5"
        style={{
          background: 'var(--color-canvas)',
          borderBottom: '1px solid var(--color-hairline)'
        }}
      >
        <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
          <WorkflowIdentityStatus
            approvalGuardrail={approvalGuardrail}
            displayWorkflowName={displayWorkflowName}
            isDirty={isDirty}
            isPaused={isPaused}
            isSaving={isSaving}
            onFixPermissions={handleFixPermissions}
            onReviewFocus={() => requestReviewFocus(reviewNodeIds[0]!)}
            reviewButtonLabel={reviewButtonLabel}
            reviewNodeCount={reviewNodeIds.length}
            reviewNodeLabel={reviewNodeLabel ? String(reviewNodeLabel) : undefined}
            saveChipState={saveChipState}
            saveError={saveError}
            saveStateLabel={saveStateLabel}
            statusSubtext={statusSubtext}
            workflowChipLabel={workflowChipLabel}
            workflowChipState={workflowChipState}
            workspaceName={workspaceName}
            workspacePath={workspacePath}
          />

          <div className="flex min-w-0 items-center justify-end gap-1.5">
            <ContextControl
              contextChipState={contextChipState}
              disabled={isBusy}
              dimmed={isBusy}
              onOpenContext={() => setContextSetupOpen(true)}
            />
            <CodexReadinessPopover
              codexReadiness={codexReadiness}
              disabled={isBusy}
              isLoading={isProviderCapabilitiesLoading}
              isOpen={isReadinessPopoverOpen}
              onRefresh={handleRefreshReadiness}
              onToggle={() => setIsReadinessPopoverOpen((current) => !current)}
              readinessPopoverRef={readinessPopoverRef}
              readinessTone={readinessTone}
            />
            <WorkspaceActivityPopover
              activityDetailItems={activityDetailItems}
              activityHasAttention={activityHasAttention}
              activityPopoverRef={activityPopoverRef}
              activitySummaryLabel={activitySummaryLabel}
              hasExternalWorkflowChange={hasExternalWorkflowChange}
              isBusy={isBusy}
              isOpen={isActivityPopoverOpen}
              onCopyPath={(filePath) => void handleCopyPath(filePath)}
              onOpenPath={(filePath) => void handleOpenPath(filePath)}
              onReload={handleReload}
              onRevealPath={(filePath) => void handleRevealPath(filePath)}
              onToggle={() => setIsActivityPopoverOpen((current) => !current)}
            />
            <ProjectMenu
              canSave={canSave}
              disabled={isBusy}
              dimmed={isBusy}
              isOpen={isProjectMenuOpen}
              isWorkspaceOpening={isWorkspaceOpening}
              onCreateWorkflow={handleOpenCreateWorkflowDialog}
              onOpenWorkspace={handleOpenWorkspace}
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
