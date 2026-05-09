import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  ExternalLink,
  Files,
  FolderOpen,
  Moon,
  Play,
  Plus,
  Save,
  Settings,
  Sparkles,
  Square,
  Sun
} from 'lucide-react'
import { getProviderCodexApprovalProtocolStatus, getWorkflowCodexApprovalGuardrail } from '@shared'
import { useExecutionStore } from '@renderer/stores/execution.store'
import { useThemeStore } from '@renderer/stores/theme.store'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { useWorkspaceTrustPrompt } from '@renderer/hooks/useWorkspaceTrustPrompt'
import { getCodexReadinessBadgeState } from '@renderer/lib/provider-capabilities'

import { Button } from '@renderer/components/ui/Button'
import { InputDialog } from '@renderer/components/ui/InputDialog'
import { StatusChip, StatusChipTone } from '@renderer/components/ui/StatusChip'
import { Tooltip } from '@renderer/components/ui/Tooltip'
import { GlobalSettingsDialog } from '@renderer/features/settings/GlobalSettingsDialog'
import { ActionIconButton, ActionTextButton, ActivityFileAction } from './components/TopbarButtons'
import { useTopbarActions } from './hooks/useTopbarActions'
import { useWorkflowElapsed } from './hooks/useWorkflowElapsed'
import { POPOVER_SURFACE_STYLE } from './lib/topbar-styles'
import {
  formatElapsed,
  formatSavedLabel,
  getContextChipState,
  getSaveChipState,
  getWorkflowChipState
} from './lib/topbar-status'
import { buildActivityDetailItems } from './lib/workspace-activity'

export const Topbar: React.FC = () => {
  const [isCreateWorkflowDialogOpen, setIsCreateWorkflowDialogOpen] = useState(false)
  const [newWorkflowName, setNewWorkflowName] = useState('')
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false)
  const [isActivityPopoverOpen, setIsActivityPopoverOpen] = useState(false)
  const [isReadinessPopoverOpen, setIsReadinessPopoverOpen] = useState(false)
  const { requestWorkspaceTrust, trustDialog } = useWorkspaceTrustPrompt()

  const projectMenuRef = useRef<HTMLDivElement | null>(null)
  const activityPopoverRef = useRef<HTMLDivElement | null>(null)
  const readinessPopoverRef = useRef<HTMLDivElement | null>(null)

  const workflowStatus = useExecutionStore((state) => state.workflowStatus)
  const workflowError = useExecutionStore((state) => state.workflowError)
  const setWorkflowError = useExecutionStore((state) => state.setWorkflowError)
  const setWorkflowStatus = useExecutionStore((state) => state.setWorkflowStatus)

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
  const reviewNodeIds = useExecutionStore((state) => state.reviewNodeIds)

  const { theme, toggleTheme } = useThemeStore()
  const elapsedMs = useWorkflowElapsed(workflowStatus)

  const workspaceName = workspacePath
    ? (() => {
        const parts = workspacePath.split(/[/\\]/).filter(Boolean)
        const basename = parts.pop() ?? 'Workspace'
        return basename === '.fluxion' ? (parts.pop() ?? 'Fluxion') : basename
      })()
    : 'Workspace'

  const displayWorkflowName = workflowName
    ? workflowName.replace(/^\.fluxion\s*—\s*/, '')
    : 'Untitled Workflow'

  const isRunning = workflowStatus === 'running'
  const isStopping = workflowStatus === 'stopping'
  const isPaused = workflowStatus === 'paused'
  const isWorkspaceOpening =
    workspaceOpenState.phase === 'selecting' ||
    workspaceOpenState.phase === 'awaitingTrust' ||
    workspaceOpenState.phase === 'opening'
  const isBusy = isRunning || isStopping || isPaused || isWorkspaceOpening
  const approvalGuardrail = useMemo(
    () =>
      getWorkflowCodexApprovalGuardrail(
        nodes.map((node) => ({
          id: node.id,
          label: node.data.label ?? node.data.model,
          data: node.data
        })),
        {
          approvalProtocolStatus: getProviderCodexApprovalProtocolStatus(providerCapabilities)
        }
      ),
    [nodes, providerCapabilities]
  )
  const canRun =
    Boolean(workspacePath) &&
    nodes.length > 0 &&
    !isBusy &&
    approvalGuardrail.severity !== 'blocked'
  const canSave = Boolean(workspacePath) && isDirty && !isSaving
  const editingDimmed = isBusy
  const workflowChipState = getWorkflowChipState(workflowStatus)
  const changeCount = recentWorkspaceChanges.length
  const activitySummaryLabel =
    changeCount > 0
      ? `${changeCount} file${changeCount === 1 ? '' : 's'} changed`
      : hasExternalWorkflowChange
        ? 'Workflow changed on disk'
        : 'No recent file changes'

  const statusSubtext = workflowError ?? saveError
  const codexReadiness = getCodexReadinessBadgeState(
    providerCapabilities,
    nodes.map((node) => String(node.data.model ?? ''))
  )
  const readinessTone: StatusChipTone =
    codexReadiness.tone === 'ready'
      ? 'success'
      : codexReadiness.tone === 'blocked'
        ? 'error'
        : 'warning'
  const runTooltip = !workspacePath
    ? 'Open a workspace first'
    : nodes.length === 0
      ? 'Add at least one node'
      : isStopping
        ? 'Wait for the workflow to finish stopping'
        : isPaused
          ? 'Resolve review checkpoint first'
          : approvalGuardrail.severity === 'blocked'
            ? approvalGuardrail.summary
            : codexReadiness.blocking
              ? codexReadiness.summary
              : 'Run workflow'
  const saveStateLabel = saveError ?? formatSavedLabel(lastSavedAt)
  const saveChipState = getSaveChipState(isDirty, isSaving, saveError)
  const contextChipState = getContextChipState(contextStatus)
  const activityHasAttention = changeCount > 0 || hasExternalWorkflowChange
  const reviewNodeLabel =
    reviewNodeIds.length === 1
      ? (nodes.find((node) => node.id === reviewNodeIds[0])?.data?.label ?? reviewNodeIds[0])
      : undefined
  const reviewButtonLabel = reviewNodeLabel
    ? `Review: ${String(reviewNodeLabel).slice(0, 24)}${
        String(reviewNodeLabel).length > 24 ? '...' : ''
      }`
    : 'Review Required'

  useEffect(() => {
    if (!isProjectMenuOpen && !isActivityPopoverOpen && !isReadinessPopoverOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null
      if (
        isProjectMenuOpen &&
        projectMenuRef.current &&
        target &&
        !projectMenuRef.current.contains(target)
      ) {
        setIsProjectMenuOpen(false)
      }

      if (
        isActivityPopoverOpen &&
        activityPopoverRef.current &&
        target &&
        !activityPopoverRef.current.contains(target)
      ) {
        setIsActivityPopoverOpen(false)
      }

      if (
        isReadinessPopoverOpen &&
        readinessPopoverRef.current &&
        target &&
        !readinessPopoverRef.current.contains(target)
      ) {
        setIsReadinessPopoverOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsProjectMenuOpen(false)
        setIsActivityPopoverOpen(false)
        setIsReadinessPopoverOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isActivityPopoverOpen, isProjectMenuOpen, isReadinessPopoverOpen])

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

  const activityDetailItems = useMemo(
    () => buildActivityDetailItems(recentWorkspaceChanges),
    [recentWorkspaceChanges]
  )

  const workflowChipLabel =
    workflowStatus === 'running'
      ? `${workflowChipState.label} ${formatElapsed(elapsedMs)}`
      : workflowChipState.label

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
          <div className="min-w-0">
            <Tooltip content={workspacePath || 'No workspace open'}>
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="shrink-0 text-sm font-semibold"
                  style={{ color: 'var(--color-ink)', letterSpacing: '-0.15px' }}
                >
                  {workspaceName}
                </span>
                <span className="shrink-0 text-xs" style={{ color: 'var(--color-muted-soft)' }}>
                  /
                </span>
                <span
                  className="hidden shrink-0 text-xs sm:inline"
                  style={{ color: 'var(--color-muted)' }}
                >
                  Workflow:
                </span>
                <span
                  className="min-w-0 truncate text-sm font-semibold"
                  style={{ color: 'var(--color-ink)', letterSpacing: '-0.15px' }}
                >
                  {displayWorkflowName}
                </span>
              </div>
            </Tooltip>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {!(!isDirty && !isSaving && !saveError) && (
              <StatusChip
                tone={saveChipState.tone}
                label={saveChipState.label}
                animate={saveChipState.animate}
                title={saveStateLabel}
              />
            )}
            <StatusChip
              tone={workflowChipState.tone}
              label={workflowChipLabel}
              animate={workflowChipState.animate}
              title={statusSubtext ?? workflowChipLabel}
              className="max-w-[170px]"
            />

            {isPaused && reviewNodeIds.length > 0 && (
              <Button
                variant="secondary"
                size="toolbar"
                className="min-w-[132px]"
                title={reviewNodeLabel ? `Open review for ${reviewNodeLabel}` : 'Open review panel'}
                onClick={() => requestReviewFocus(reviewNodeIds[0]!)}
              >
                {reviewButtonLabel}
              </Button>
            )}

            {approvalGuardrail.severity === 'blocked' && approvalGuardrail.nodeId && (
              <Button
                variant="secondary"
                size="toolbar"
                className="min-w-[132px]"
                title={approvalGuardrail.message}
                onClick={handleFixPermissions}
              >
                Fix Permissions
              </Button>
            )}
          </div>

          <div className="flex min-w-0 items-center justify-end gap-1.5">
            <Tooltip content={contextChipState.detail}>
              <ActionTextButton
                aria-label={contextChipState.label}
                onClick={() => setContextSetupOpen(true)}
                disabled={isBusy}
                dimmed={editingDimmed}
              >
                <Sparkles size={14} />
                <span className="hidden lg:inline">Context</span>
                <StatusChip
                  tone={contextChipState.tone}
                  label={contextChipState.label.replace('Context ', '')}
                  className="hidden xl:inline-flex"
                />
              </ActionTextButton>
            </Tooltip>

            <div className="relative" ref={readinessPopoverRef}>
              <button
                type="button"
                aria-label={`Codex readiness: ${codexReadiness.label}`}
                aria-expanded={isReadinessPopoverOpen}
                onClick={() => setIsReadinessPopoverOpen((current) => !current)}
                className="inline-flex items-center"
              >
                <StatusChip
                  tone={readinessTone}
                  label={
                    isProviderCapabilitiesLoading
                      ? 'Codex Checking'
                      : `Codex ${codexReadiness.label}`
                  }
                  title={codexReadiness.detail}
                  animate={isProviderCapabilitiesLoading}
                  className="max-w-[170px]"
                />
              </button>

              {isReadinessPopoverOpen && (
                <div
                  className="absolute right-0 top-[calc(100%+10px)] z-50 w-[360px] p-3"
                  style={POPOVER_SURFACE_STYLE}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span
                        className="text-[11px] uppercase tracking-[0.08em]"
                        style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                      >
                        Codex Runtime
                      </span>
                      <p
                        className="mt-2 text-sm font-semibold"
                        style={{ color: 'var(--color-ink)' }}
                      >
                        {codexReadiness.summary}
                      </p>
                      <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
                        {codexReadiness.detail}
                      </p>
                    </div>
                    <StatusChip tone={readinessTone} label={codexReadiness.label} />
                  </div>

                  <div
                    className="mt-3 rounded-md px-3 py-2 text-[11px] leading-5"
                    style={{
                      color: 'var(--color-muted)',
                      background: 'var(--color-canvas)',
                      border: '1px solid var(--color-hairline)'
                    }}
                  >
                    Windows native Fluxion only sees Codex installed in the Windows PATH. A Codex
                    binary installed only inside WSL is not available to this runner yet.
                  </div>

                  <div
                    className="mt-3 grid gap-2 text-[11px]"
                    style={{ color: 'var(--color-body)' }}
                  >
                    <div style={{ fontFamily: 'var(--font-mono)' }}>
                      Install: npm i -g @openai/codex
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)' }}>Login: codex login</div>
                    <div style={{ fontFamily: 'var(--font-mono)' }}>Check: codex login status</div>
                    {codexReadiness.catalogSource && (
                      <div style={{ fontFamily: 'var(--font-mono)' }}>
                        Catalog: {codexReadiness.catalogSource}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRefreshReadiness}
                      disabled={isProviderCapabilitiesLoading || isBusy}
                    >
                      {isProviderCapabilitiesLoading ? 'Refreshing...' : 'Refresh'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={activityPopoverRef}>
              <Tooltip content={activitySummaryLabel}>
                <ActionIconButton
                  aria-label="Open workspace activity"
                  aria-expanded={isActivityPopoverOpen}
                  onClick={() => setIsActivityPopoverOpen((current) => !current)}
                  style={{
                    color: hasExternalWorkflowChange
                      ? 'var(--color-semantic-error)'
                      : 'var(--color-muted)'
                  }}
                >
                  <Files size={16} />
                  {activityHasAttention && (
                    <span
                      className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
                      style={{
                        background: hasExternalWorkflowChange
                          ? 'var(--color-semantic-error)'
                          : 'var(--color-status-completed)'
                      }}
                    />
                  )}
                </ActionIconButton>
              </Tooltip>

              {isActivityPopoverOpen && (
                <div
                  className="absolute right-0 top-[calc(100%+10px)] z-50 w-[380px] p-3"
                  style={POPOVER_SURFACE_STYLE}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="text-[11px] uppercase tracking-[0.08em]"
                      style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                    >
                      Activity
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: 'var(--color-muted-soft)', fontFamily: 'var(--font-mono)' }}
                    >
                      {activitySummaryLabel}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {activityDetailItems.length > 0 ? (
                      activityDetailItems.map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center gap-2 rounded-md px-2 py-2"
                          style={{
                            background: 'var(--color-canvas)',
                            border: '1px solid var(--color-hairline)'
                          }}
                          title={item.relativePath}
                        >
                          <span
                            className="shrink-0 text-xs font-semibold"
                            style={{ color: item.tokenColor, fontFamily: 'var(--font-mono)' }}
                          >
                            {item.token}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleOpenPath(item.filePath)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div
                              className="truncate text-xs font-semibold"
                              style={{ color: 'var(--color-ink)' }}
                            >
                              {item.basename}
                            </div>
                            <div
                              className="mt-0.5 flex min-w-0 items-center gap-2 text-[10px]"
                              style={{
                                color: 'var(--color-muted)',
                                fontFamily: 'var(--font-mono)'
                              }}
                            >
                              <span className="truncate">{item.parentPath}</span>
                              <span className="shrink-0">{item.receivedAt}</span>
                            </div>
                          </button>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <ActivityFileAction
                              label="Open"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleOpenPath(item.filePath)
                              }}
                            >
                              <ExternalLink size={13} />
                            </ActivityFileAction>
                            <ActivityFileAction
                              label="Reveal"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleRevealPath(item.filePath)
                              }}
                            >
                              <FolderOpen size={13} />
                            </ActivityFileAction>
                            <ActivityFileAction
                              label="Copy path"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleCopyPath(item.filePath)
                              }}
                            >
                              <Copy size={13} />
                            </ActivityFileAction>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p
                        className="rounded-md px-3 py-2 text-xs"
                        style={{
                          color: 'var(--color-muted)',
                          background: 'var(--color-canvas)',
                          border: '1px solid var(--color-hairline)',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        No recent file changes.
                      </p>
                    )}
                  </div>

                  {hasExternalWorkflowChange && (
                    <div
                      className="mt-3 flex items-center justify-between gap-3 rounded-md px-3 py-2"
                      style={{
                        background: 'var(--color-canvas)',
                        border: '1px solid var(--color-hairline)'
                      }}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium" style={{ color: 'var(--color-ink)' }}>
                          Workflow file changed on disk
                        </p>
                        <p
                          className="mt-1 text-[11px]"
                          style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                        >
                          Reload to sync the canvas with disk.
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleReload}
                        disabled={isBusy}
                      >
                        <AlertTriangle size={13} />
                        Reload
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="relative" ref={projectMenuRef}>
              <ActionTextButton
                aria-expanded={isProjectMenuOpen}
                onClick={() => setIsProjectMenuOpen((current) => !current)}
                disabled={isBusy}
                dimmed={editingDimmed}
                className="hidden sm:inline-flex"
              >
                <span>Project</span>
                <ChevronDown size={14} />
              </ActionTextButton>

              {isProjectMenuOpen && (
                <div
                  className="absolute right-0 top-[calc(100%+10px)] z-50 w-[220px] p-2"
                  style={POPOVER_SURFACE_STYLE}
                >
                  <button
                    type="button"
                    onClick={handleOpenWorkspace}
                    disabled={isWorkspaceOpening}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-canvas)] disabled:cursor-not-allowed"
                    style={{
                      color: isWorkspaceOpening ? 'var(--color-muted-soft)' : 'var(--color-ink)'
                    }}
                  >
                    <FolderOpen size={14} />
                    {isWorkspaceOpening ? 'Opening...' : 'Open Workspace'}
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenCreateWorkflowDialog}
                    disabled={!workspacePath || isBusy}
                    className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-canvas)] disabled:cursor-not-allowed"
                    style={{
                      color:
                        !workspacePath || isBusy ? 'var(--color-muted-soft)' : 'var(--color-ink)'
                    }}
                  >
                    <Plus size={14} />
                    New Workflow
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave}
                    className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-canvas)] disabled:cursor-not-allowed"
                    style={{
                      color: canSave ? 'var(--color-ink)' : 'var(--color-muted-soft)'
                    }}
                  >
                    <Save size={14} />
                    Save Workflow
                  </button>
                </div>
              )}
            </div>

            <Tooltip content="Global Settings">
              <ActionIconButton
                aria-label="Open Global Settings"
                onClick={() => setIsSettingsOpen(true)}
                disabled={isBusy}
                dimmed={editingDimmed}
              >
                <Settings size={16} />
              </ActionIconButton>
            </Tooltip>

            <Tooltip content={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              <ActionIconButton
                aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                onClick={toggleTheme}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </ActionIconButton>
            </Tooltip>

            {!isBusy ? (
              <Tooltip content={runTooltip}>
                <Button
                  variant="primary"
                  size="toolbar"
                  className="min-w-[120px] shrink-0"
                  onClick={handleRun}
                  disabled={!canRun}
                >
                  <Play size={13} fill="currentColor" />
                  Run Workflow
                </Button>
              </Tooltip>
            ) : (
              <Tooltip content={isStopping ? 'Workflow is stopping' : 'Abort current workflow'}>
                <Button
                  variant="danger"
                  size="toolbar"
                  className="min-w-[120px] shrink-0"
                  onClick={handleAbort}
                  disabled={isStopping}
                >
                  <Square size={13} fill="currentColor" />
                  {isStopping ? 'Stopping' : 'Abort'}
                </Button>
              </Tooltip>
            )}
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
