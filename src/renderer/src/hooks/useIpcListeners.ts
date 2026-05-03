import { useEffect } from 'react';
import { useExecutionStore } from '../stores/execution.store';
import {
  MemoryContextReadyPayload,
  TerminalDataBatchPayload,
  TerminalErrorPayload,
  TerminalExitPayload,
  WorkflowCompletedPayload,
  WorkflowNodeOutputPayload,
  WorkflowNodeStatusPayload,
  WorkspaceFileChangedPayload
} from '@shared';
import { useWorkflowStore } from '../stores/workflow.store';

export function useIpcListeners(): void {
  const {
    appendLogs,
    setCompiledContext,
    setNodeError,
    setNodeExitCode,
    setNodeOutputPath,
    setNodeStatus,
    setWorkflowError,
    setWorkflowStatus
  } = useExecutionStore()
  const recordWorkspaceChange = useWorkflowStore((state) => state.recordWorkspaceChange)

  useEffect(() => {
    if (!window.api) {
      console.warn('Fluxion API is not exposed on window. IPC listeners not bound.')
      return
    }

    const unsubWorkspaceChanges = window.api.onWorkspaceFileChanged(
      (payload: WorkspaceFileChangedPayload) => {
        recordWorkspaceChange(payload)
      }
    )

    const unsubTerminal = window.api.onTerminalDataBatch((payload: TerminalDataBatchPayload) => {
      const formattedBatch =
        payload.sourceType === 'stderr'
          ? payload.batch.map((chunk) => `\x1b[31m${chunk}\x1b[0m`)
          : payload.batch

      appendLogs(payload.nodeId, formattedBatch)
    })

    const unsubTerminalError = window.api.onTerminalError((payload: TerminalErrorPayload) => {
      appendLogs(payload.nodeId, [`\x1b[31m[error] ${payload.error}\x1b[0m`])
      if (payload.nodeId !== 'system') {
        setNodeError(payload.nodeId, payload.error)
      } else {
        setWorkflowError(payload.error)
      }
    })

    const unsubTerminalExit = window.api.onTerminalExit((payload: TerminalExitPayload) => {
      setNodeExitCode(payload.nodeId, payload.code)
      appendLogs(payload.nodeId, [`\x1b[2m[exit] code=${payload.code ?? 'null'}\x1b[0m`])
    })

    const unsubStatus = window.api.onWorkflowNodeStatus((payload: WorkflowNodeStatusPayload) => {
      setNodeStatus(payload.nodeId, payload.status)
      if (payload.error) {
        setNodeError(payload.nodeId, payload.error)
      }
      if (payload.exitCode !== undefined) {
        setNodeExitCode(payload.nodeId, payload.exitCode)
      }
    })

    const unsubOutput = window.api.onWorkflowNodeOutput((payload: WorkflowNodeOutputPayload) => {
      setNodeOutputPath(payload.nodeId, payload.outputFilePath)
    })

    const unsubMemory = window.api.onMemoryContextReady((payload: MemoryContextReadyPayload) => {
      setCompiledContext(payload.nodeId, payload.compiledContext)
    })

    const unsubCompleted = window.api.onWorkflowCompleted((payload: WorkflowCompletedPayload) => {
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
      unsubTerminal()
      unsubTerminalError()
      unsubTerminalExit()
      unsubStatus()
      unsubOutput()
      unsubMemory()
      unsubCompleted()
    }
  }, [
    appendLogs,
    recordWorkspaceChange,
    setCompiledContext,
    setNodeError,
    setNodeExitCode,
    setNodeOutputPath,
    setNodeStatus,
    setWorkflowError,
    setWorkflowStatus
  ])
}
