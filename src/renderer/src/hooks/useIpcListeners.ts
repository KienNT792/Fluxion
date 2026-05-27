import { useEffect } from 'react'
import { useExecutionStore } from '../stores/execution.store'
import {
  MemoryContextReadyPayload,
  TerminalDataBatchPayload,
  TerminalErrorPayload,
  TerminalExitPayload,
  WorkflowCompletedPayload,
  WorkflowNodeOutputPayload,
  WorkflowReviewRequiredPayload,
  WorkflowNodeStatusPayload,
  WorkspaceFileChangedPayload,
  WorkspaceLoadingEvent
} from '@shared'
import { useWorkflowStore } from '../stores/workflow.store'
import {
  formatTerminalErrorEntry,
  formatTerminalExitEntry,
  formatTerminalStderrEntry
} from '../lib/terminal'
import { logRuntimeDebug } from '../lib/runtime-debug'

export function useIpcListeners(): void {
  const {
    appendLogs,
    setCompiledContext,
    setActiveRunId,
    addReviewNode,
    clearReviewActionInFlight,
    clearReviewNodes,
    setNodeError,
    setNodeExitCode,
    setNodeOutputPath,
    setNodeRunMetrics,
    setNodeStatus,
    setPendingReviewContext,
    removeReviewNode,
    setWorkflowError,
    setWorkflowStatus
  } = useExecutionStore()
  const recordWorkspaceChange = useWorkflowStore((state) => state.recordWorkspaceChange)
  const recordWorkspaceLoadingEvent = useWorkflowStore((state) => state.recordWorkspaceLoadingEvent)

  useEffect(() => {
    if (!window.api) {
      console.warn('Fluxion API is not exposed on window. IPC listeners not bound.')
      return
    }

    const followRunningNodeIfNeeded = (nodeId: string): void => {
      const workflowState = useWorkflowStore.getState()
      if (workflowState.terminalFollowMode !== 'auto') {
        return
      }

      const currentTerminalNodeId = workflowState.terminalNodeId
      const currentTerminalStatus = currentTerminalNodeId
        ? (useExecutionStore.getState().nodeStatuses[currentTerminalNodeId] ?? 'idle')
        : 'idle'

      if (!currentTerminalNodeId) {
        workflowState.followTerminalNode(nodeId)
        logRuntimeDebug('AutoFollow', 'auto-follow switched to first running node', {
          nextNodeId: nodeId,
          reason: 'no-followed-node'
        })
        return
      }

      if (currentTerminalNodeId === nodeId) {
        return
      }

      if (currentTerminalStatus === 'running') {
        return
      }

      workflowState.followTerminalNode(nodeId)
      logRuntimeDebug('AutoFollow', 'auto-follow switched to newly running node', {
        previousNodeId: currentTerminalNodeId,
        previousStatus: currentTerminalStatus,
        nextNodeId: nodeId
      })
    }

    const followErrorNodeIfNeeded = (nodeId: string, error?: string): void => {
      const workflowState = useWorkflowStore.getState()
      if (workflowState.terminalFollowMode !== 'auto') {
        return
      }

      if (workflowState.terminalNodeId === nodeId) {
        return
      }

      workflowState.followTerminalNode(nodeId)
      logRuntimeDebug('AutoFollow', 'auto-follow switched to error node', {
        previousNodeId: workflowState.terminalNodeId,
        nextNodeId: nodeId,
        error
      })
    }

    const unsubWorkspaceChanges = window.api.onWorkspaceFileChanged(
      (payload: WorkspaceFileChangedPayload) => {
        recordWorkspaceChange(payload)
      }
    )

    const unsubWorkspaceLoading = window.api.onWorkspaceLoading(
      (payload: WorkspaceLoadingEvent) => {
        recordWorkspaceLoadingEvent(payload)
      }
    )

    const unsubTerminal = window.api.onTerminalDataBatch((payload: TerminalDataBatchPayload) => {
      const isNonFatalTransportNoise =
        payload.sourceType === 'stderr' &&
        payload.batch.some((chunk) => chunk.includes('Transport channel closed'))

      const formattedBatch =
        payload.sourceType === 'stderr'
          ? payload.batch.map((chunk) =>
              isNonFatalTransportNoise
                ? `\x1b[33m[diagnostic]\x1b[0m ${chunk}`
                : formatTerminalStderrEntry(chunk)
            )
          : payload.batch

      appendLogs(payload.nodeId, formattedBatch, {
        sourceType: payload.sourceType,
        category:
          isNonFatalTransportNoise && payload.category === 'diagnostics'
            ? 'diagnostics'
            : payload.category,
        severity:
          isNonFatalTransportNoise && payload.severity
            ? 'warning'
            : payload.severity,
        rawType: isNonFatalTransportNoise ? 'non-fatal-stderr' : payload.rawType
      })
    })

    const unsubTerminalError = window.api.onTerminalError((payload: TerminalErrorPayload) => {
      appendLogs(payload.nodeId, [formatTerminalErrorEntry(payload.error)], {
        sourceType: 'stderr',
        category: 'diagnostics',
        severity: 'error',
        rawType: 'terminal-error'
      })
      if (payload.nodeId !== 'system') {
        setNodeError(payload.nodeId, payload.error)
      } else {
        setWorkflowError(payload.error)
      }
    })

    const unsubTerminalExit = window.api.onTerminalExit((payload: TerminalExitPayload) => {
      setNodeExitCode(payload.nodeId, payload.code)
      const state = useExecutionStore.getState()
      const hasNonFatalDiagnostic =
        payload.code === 0 &&
        (state.runtimeLogs[payload.nodeId] ?? []).some(
          (entry) =>
            entry.category === 'diagnostics' &&
            entry.severity !== 'error' &&
            entry.rawType === 'non-fatal-stderr'
        )

      if (hasNonFatalDiagnostic) {
        appendLogs(
          payload.nodeId,
          ['\x1b[33m[diagnostic]\x1b[0m Process completed successfully with non-fatal diagnostics.\n'],
          {
            sourceType: 'stdout',
            category: 'progress',
            severity: 'warning',
            rawType: 'diagnostic-summary'
          }
        )
      }

      appendLogs(payload.nodeId, [formatTerminalExitEntry(payload.code)], {
        sourceType: 'stdout',
        category: 'progress',
        severity: payload.code === 0 || payload.code === null ? 'info' : 'warning',
        rawType: 'process.exit'
      })
    })

    const unsubStatus = window.api.onWorkflowNodeStatus((payload: WorkflowNodeStatusPayload) => {
      setNodeStatus(payload.nodeId, payload.status)
      setNodeRunMetrics(payload.nodeId, {
        startedAt: payload.startedAt,
        completedAt: payload.completedAt,
        durationMs: payload.durationMs
      })
      if (payload.status === 'running') {
        setWorkflowStatus('running')
        followRunningNodeIfNeeded(payload.nodeId)
      }
      if (payload.status === 'completed') {
        setNodeError(payload.nodeId, undefined)
      }
      if (payload.status !== 'paused') {
        removeReviewNode(payload.nodeId)
        setPendingReviewContext(payload.nodeId, undefined)
      }
      if (payload.error) {
        setNodeError(payload.nodeId, payload.error)
      }
      if (payload.exitCode !== undefined) {
        setNodeExitCode(payload.nodeId, payload.exitCode)
      }
      if (payload.status === 'error') {
        followErrorNodeIfNeeded(payload.nodeId, payload.error)
      }
    })

    const unsubOutput = window.api.onWorkflowNodeOutput((payload: WorkflowNodeOutputPayload) => {
      setNodeOutputPath(payload.nodeId, payload.outputFilePath)
    })

    const unsubReviewRequired = window.api.onWorkflowReviewRequired(
      (payload: WorkflowReviewRequiredPayload) => {
        setActiveRunId(payload.runId)
        addReviewNode(payload.nodeId)
        setNodeStatus(payload.nodeId, 'paused')
        setNodeOutputPath(payload.nodeId, payload.outputFilePath)
        setPendingReviewContext(payload.nodeId, {
          nodeId: payload.nodeId,
          reviewReason: payload.reviewReason ?? 'node',
          reviewPrompt:
            payload.reviewPrompt?.trim() || `Review output from ${payload.nodeId} before continuing.`,
          agentVerdict: payload.agentVerdict,
          requestedAt: payload.requestedAt
        })
        setWorkflowError(null)
        setWorkflowStatus('paused')
      }
    )

    const unsubMemory = window.api.onMemoryContextReady((payload: MemoryContextReadyPayload) => {
      setCompiledContext(payload.nodeId, payload.compiledContext, payload.diagnostics)
    })

    const unsubCompleted = window.api.onWorkflowCompleted((payload: WorkflowCompletedPayload) => {
      clearReviewActionInFlight()
      clearReviewNodes()
      setActiveRunId(undefined)
      if (payload.aborted) {
        setWorkflowStatus('aborted')
      } else {
        setWorkflowStatus(payload.success ? 'completed' : 'error')
      }

      setWorkflowError(payload.error ?? null)
    })

    // Cleanup listeners on unmount
    return () => {
      unsubWorkspaceChanges()
      unsubWorkspaceLoading()
      unsubTerminal()
      unsubTerminalError()
      unsubTerminalExit()
      unsubStatus()
      unsubOutput()
      unsubReviewRequired()
      unsubMemory()
      unsubCompleted()
    }
  }, [
    appendLogs,
    addReviewNode,
    clearReviewActionInFlight,
    clearReviewNodes,
    recordWorkspaceChange,
    recordWorkspaceLoadingEvent,
    removeReviewNode,
    setCompiledContext,
    setActiveRunId,
    setNodeError,
    setNodeExitCode,
    setNodeOutputPath,
    setNodeRunMetrics,
    setNodeStatus,
    setPendingReviewContext,
    setWorkflowError,
    setWorkflowStatus
  ])
}
