import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, GitBranch, Sparkles } from 'lucide-react'
import { shouldShowIncompleteContextBanner, WorkspaceContextSavedPayload } from '@shared'
import { Sidebar } from '@renderer/features/workflow-editor/library/Sidebar'
import { Topbar } from '@renderer/features/topbar/Topbar'
import { FlowCanvas } from '@renderer/features/workflow-editor/canvas/FlowCanvas'
import { RightInspector } from './RightInspector'
import { RuntimeDock } from '@renderer/features/runtime/RuntimeDock'
import { WelcomeScreen } from '@renderer/features/workspace-open/WelcomeScreen'
import { ContextInitModal } from '@renderer/features/project-context/setup/ContextInitModal'
import { WorkspaceOpeningOverlay } from '@renderer/features/workspace-open/WorkspaceOpeningOverlay'
import { hydrateWorkspaceState } from '../../lib/workflow-session'
import { useThemeStore, applyTheme } from '../../stores/theme.store'
import { useWorkflowStore } from '../../stores/workflow.store'
import { useExecutionStore } from '../../stores/execution.store'
import { Button } from '../ui/Button'
import { TooltipProvider } from '../ui/Tooltip'

export const AppShell: React.FC = () => {
  const theme = useThemeStore((state) => state.theme)
  const workspacePath = useWorkflowStore((state) => state.workspacePath)
  const contextStatus = useWorkflowStore((state) => state.contextStatus)
  const contextSummary = useWorkflowStore((state) => state.contextSummary)
  const isContextSetupOpen = useWorkflowStore((state) => state.isContextSetupOpen)
  const contextSetupInitialStep = useWorkflowStore((state) => state.contextSetupInitialStep)
  const legacyWorkflowDetected = useWorkflowStore((state) => state.legacyWorkflowDetected)
  const legacyWorkflowBackupFilePath = useWorkflowStore(
    (state) => state.legacyWorkflowBackupFilePath
  )
  const isNewWorkspace = useWorkflowStore((state) => state.isNewWorkspace)
  const isDirty = useWorkflowStore((state) => state.isDirty)
  const setContextSetupOpen = useWorkflowStore((state) => state.setContextSetupOpen)
  const setContextState = useWorkflowStore((state) => state.setContextState)
  const fetchProviderCapabilities = useWorkflowStore((state) => state.fetchProviderCapabilities)
  const clearLegacyWorkflowBackup = useWorkflowStore((state) => state.clearLegacyWorkflowBackup)
  const [contextBannerError, setContextBannerError] = useState<string | null>(null)
  const [isDismissingIncomplete, setIsDismissingIncomplete] = useState(false)
  const [isKeepingLegacy, setIsKeepingLegacy] = useState(false)
  const [isMigratingLegacy, setIsMigratingLegacy] = useState(false)

  // ─── DEBUG INSTRUMENTATION START ───
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId)
  const terminalNodeId = useWorkflowStore((state) => state.terminalNodeId)
  const terminalFollowMode = useWorkflowStore((state) => state.terminalFollowMode)
  const nodes = useWorkflowStore((state) => state.nodes)

  const workflowStatus = useExecutionStore((state) => state.workflowStatus)
  const nodeStatuses = useExecutionStore((state) => state.nodeStatuses)
  const terminalLogs = useExecutionStore((state) => state.terminalLogs)
  const terminalLogCursors = useExecutionStore((state) => state.terminalLogCursors)
  const nodeExitCodes = useExecutionStore((state) => state.nodeExitCodes)

  useEffect(() => {
    const DEBUG_RUNTIME_DOCK = import.meta.env.DEV && true
    if (!DEBUG_RUNTIME_DOCK) return

    console.log(
      '[FluxionRuntimeDebug/AppShell] Mounted. (useIpcListeners is active at App level)',
      {
        selectedNodeId,
        workspacePath
      }
    )
    return () => {
      console.log('[FluxionRuntimeDebug/AppShell] Unmounted.')
    }
  }, [selectedNodeId, workspacePath])

  useEffect(() => {
    const DEBUG_RUNTIME_DOCK = import.meta.env.DEV && true
    if (!DEBUG_RUNTIME_DOCK) return

    const node = terminalNodeId ? nodes.find((n) => n.id === terminalNodeId) : null
    console.log('[FluxionRuntimeDebug/AppShell] terminalNodeId changed:', {
      terminalNodeId,
      terminalFollowMode,
      nodeLabel: node?.data?.label ?? node?.id,
      nodeModel: node?.data?.model,
      activeLogCount: terminalNodeId ? (terminalLogs[terminalNodeId]?.length ?? 0) : 0,
      activeCursor: terminalNodeId ? (terminalLogCursors[terminalNodeId] ?? 0) : 0,
      activeExitCode: terminalNodeId ? nodeExitCodes[terminalNodeId] : undefined
    })
  }, [terminalFollowMode, terminalNodeId, nodes, terminalLogs, terminalLogCursors, nodeExitCodes])

  useEffect(() => {
    const DEBUG_RUNTIME_DOCK = import.meta.env.DEV && true
    if (!DEBUG_RUNTIME_DOCK) return

    const logsForActive = terminalNodeId ? (terminalLogs[terminalNodeId] ?? []) : []
    const lastLog = logsForActive.length > 0 ? logsForActive[logsForActive.length - 1] : ''

    console.log('[FluxionRuntimeDebug/AppShell] Terminal log state changed:', {
      terminalNodeId,
      trackedLogKeys: Object.keys(terminalLogs),
      activeLogCount: logsForActive.length,
      activeCursor: terminalNodeId ? (terminalLogCursors[terminalNodeId] ?? 0) : 0,
      lastLogPreview: lastLog.slice(0, 200).replace(/\n/g, '\\n'),
      exitCode: terminalNodeId ? nodeExitCodes[terminalNodeId] : undefined
    })
  }, [terminalLogs, terminalLogCursors, terminalNodeId, nodeExitCodes])

  useEffect(() => {
    const DEBUG_RUNTIME_DOCK = import.meta.env.DEV && true
    if (!DEBUG_RUNTIME_DOCK) return

    const runningIds = Object.keys(nodeStatuses).filter((k) => nodeStatuses[k] === 'running')
    const completedIds = Object.keys(nodeStatuses).filter((k) => nodeStatuses[k] === 'completed')
    const errorIds = Object.keys(nodeStatuses).filter((k) => nodeStatuses[k] === 'error')

    console.log('[FluxionRuntimeDebug/AppShell] Workflow status changed:', {
      workflowStatus,
      runningIds,
      completedIds,
      errorIds,
      compactNodeStatuses: nodeStatuses
    })
  }, [workflowStatus, nodeStatuses])
  // ─── DEBUG INSTRUMENTATION END ───

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (!workspacePath) {
      setContextSetupOpen(false)
      return
    }

    if (
      contextStatus === 'missing' &&
      !contextSummary?.contextOnboarding.initialPromptDismissedAt
    ) {
      setContextSetupOpen(true)
    }
  }, [contextStatus, contextSummary, setContextSetupOpen, workspacePath])

  const handleContextSaved = useCallback(
    (payload: WorkspaceContextSavedPayload) => {
      setContextState(payload.contextStatus, payload.context)
      setContextSetupOpen(false)
    },
    [setContextSetupOpen, setContextState]
  )

  const handleContextClose = useCallback(() => {
    setContextSetupOpen(false)
  }, [setContextSetupOpen])

  const hasInteracted = !isNewWorkspace || isDirty
  const incompleteBannerVisible =
    hasInteracted &&
    shouldShowIncompleteContextBanner(contextStatus, contextSummary, isContextSetupOpen)
  const legacyBannerVisible = Boolean(
    legacyWorkflowDetected &&
    !contextSummary?.contextOnboarding.legacyWorkflowDecision &&
    !isContextSetupOpen
  )
  const missingContextItems = useMemo(
    () => contextSummary?.readiness.missingItems.slice(0, 3) ?? [],
    [contextSummary]
  )

  const handleDismissIncompleteBanner = useCallback(async () => {
    if (!workspacePath || isDismissingIncomplete) {
      return
    }

    setIsDismissingIncomplete(true)
    setContextBannerError(null)
    try {
      const result = await window.api.updateContextOnboarding(workspacePath, {
        incompleteBannerDismissedAt: new Date().toISOString()
      })
      setContextState(result.contextStatus, result.context)
    } catch (error) {
      setContextBannerError(
        error instanceof Error ? error.message : 'Failed to dismiss context banner.'
      )
    } finally {
      setIsDismissingIncomplete(false)
    }
  }, [isDismissingIncomplete, setContextState, workspacePath])

  const handleKeepLegacyWorkflow = useCallback(async () => {
    if (!workspacePath || isKeepingLegacy) {
      return
    }

    setIsKeepingLegacy(true)
    setContextBannerError(null)
    try {
      const now = new Date().toISOString()
      const result = await window.api.updateContextOnboarding(workspacePath, {
        legacyWorkflowDecision: 'keep',
        legacyWorkflowDecisionAt: now
      })
      setContextState(result.contextStatus, result.context)
    } catch (error) {
      setContextBannerError(
        error instanceof Error ? error.message : 'Failed to keep legacy workflow.'
      )
    } finally {
      setIsKeepingLegacy(false)
    }
  }, [isKeepingLegacy, setContextState, workspacePath])

  const handleMigrateLegacyWorkflow = useCallback(async () => {
    if (!workspacePath || isMigratingLegacy) {
      return
    }

    setIsMigratingLegacy(true)
    setContextBannerError(null)
    try {
      const payload = await window.api.migrateLegacyWorkflow(workspacePath)
      hydrateWorkspaceState(payload)
      await fetchProviderCapabilities()
    } catch (error) {
      setContextBannerError(
        error instanceof Error ? error.message : 'Failed to migrate legacy workflow.'
      )
    } finally {
      setIsMigratingLegacy(false)
    }
  }, [fetchProviderCapabilities, isMigratingLegacy, workspacePath])

  const handleRevealLegacyBackup = useCallback(async () => {
    if (!legacyWorkflowBackupFilePath) {
      return
    }

    try {
      await window.api.revealPath(legacyWorkflowBackupFilePath)
    } catch (error) {
      setContextBannerError(
        error instanceof Error ? error.message : 'Failed to reveal legacy backup.'
      )
    }
  }, [legacyWorkflowBackupFilePath])

  if (!workspacePath) {
    return (
      <TooltipProvider>
        <WelcomeScreen />
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <div
        className="flex h-screen w-screen flex-col overflow-hidden font-sans"
        style={{ background: 'var(--color-canvas)', color: 'var(--color-ink)' }}
      >
        {/* ── Region 1: Topbar (full width) ── */}
        <Topbar />

        {/* ── Region 2: Context banners (full width, under Topbar) ── */}
        {contextBannerError ? (
          <div
            className="flex shrink-0 items-center gap-2 px-4 py-2 text-xs"
            style={{
              color: 'var(--color-semantic-error)',
              background: 'var(--color-canvas-soft)',
              borderBottom: '1px solid var(--color-hairline)'
            }}
          >
            <AlertTriangle size={14} />
            <span>{contextBannerError}</span>
          </div>
        ) : null}
        {incompleteBannerVisible ? (
          <div
            className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3"
            style={{
              background: 'var(--color-canvas-soft)',
              borderBottom: '1px solid var(--color-hairline)'
            }}
          >
            <div className="flex min-w-0 items-start gap-3">
              <Sparkles
                size={16}
                className="mt-0.5 shrink-0"
                style={{ color: 'var(--color-primary)' }}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                  Project context needs review
                </p>
                <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                  {missingContextItems.length > 0
                    ? `Missing: ${missingContextItems.join(', ')}.`
                    : 'Project goal or verification details are still missing.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="lg"
                onClick={handleDismissIncompleteBanner}
                disabled={isDismissingIncomplete}
              >
                Dismiss
              </Button>
              <Button variant="secondary" size="lg" onClick={() => setContextSetupOpen(true)}>
                Review Context
              </Button>
            </div>
          </div>
        ) : null}
        {legacyBannerVisible ? (
          <div
            className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3"
            style={{
              background: 'var(--color-canvas-soft)',
              borderBottom: '1px solid var(--color-hairline)'
            }}
          >
            <div className="flex min-w-0 items-start gap-3">
              <GitBranch
                size={16}
                className="mt-0.5 shrink-0"
                style={{ color: 'var(--color-timeline-done)' }}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                  Legacy workflow format detected
                </p>
                <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                  Migrate `.fluxion/workflow.json` into the workflows folder, or keep it for this
                  workspace.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="lg"
                onClick={handleKeepLegacyWorkflow}
                disabled={isKeepingLegacy || isMigratingLegacy}
              >
                {isKeepingLegacy ? 'Saving...' : 'Keep legacy'}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleMigrateLegacyWorkflow}
                disabled={isKeepingLegacy || isMigratingLegacy}
              >
                {isMigratingLegacy ? 'Migrating...' : 'Migrate'}
              </Button>
            </div>
          </div>
        ) : null}
        {legacyWorkflowBackupFilePath ? (
          <div
            className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3"
            style={{
              background: 'var(--color-canvas-soft)',
              borderBottom: '1px solid var(--color-hairline)'
            }}
          >
            <div className="flex min-w-0 items-start gap-3">
              <GitBranch
                size={16}
                className="mt-0.5 shrink-0"
                style={{ color: 'var(--color-semantic-success)' }}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                  Legacy workflow migrated
                </p>
                <p
                  className="mt-1 truncate text-xs leading-5"
                  style={{ color: 'var(--color-muted)' }}
                >
                  Backup saved at {legacyWorkflowBackupFilePath}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="lg" onClick={clearLegacyWorkflowBackup}>
                Dismiss
              </Button>
              <Button variant="secondary" size="lg" onClick={handleRevealLegacyBackup}>
                Reveal backup
              </Button>
            </div>
          </div>
        ) : null}

        {/* ── Region 3-7: Body (Sidebar | Center | Right Inspector) ── */}
        <div className="flex flex-1 min-w-0 min-h-0 overflow-hidden">
          {/* ── Region 3: Left Sidebar ── */}
          <Sidebar />

          {/* ── Region 4+6+7: Center column (Canvas + Runtime Dock + StatusBar) ── */}
          <main className="relative flex flex-1 min-w-0 flex-col overflow-hidden">
            {/* ── Region 4: Workflow Canvas ── */}
            <div className="relative flex-1 min-h-0 overflow-hidden">
              <FlowCanvas />
            </div>

            {/* ── Region 6: Integrated Runtime Dock ── */}
            <RuntimeDock />
          </main>

          {/* ── Region 5: Right Inspector (persistent) ── */}
          <RightInspector />
        </div>
      </div>

      {isContextSetupOpen && (
        <ContextInitModal
          workspacePath={workspacePath}
          initialContext={contextSummary}
          initialStatus={contextStatus}
          initialStep={contextSetupInitialStep}
          onSaved={handleContextSaved}
          onClose={handleContextClose}
        />
      )}
      <WorkspaceOpeningOverlay />
    </TooltipProvider>
  )
}
