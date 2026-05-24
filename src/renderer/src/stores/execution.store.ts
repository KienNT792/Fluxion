import { create } from 'zustand'
import { NodeId, NodeStatus } from '@shared'

// We split into slices conceptually, but keep them in one store for easy access
// since Zustand handles partial updates very well.

export type WorkflowRuntimeStatus =
  | 'idle'
  | 'running'
  | 'stopping'
  | 'paused'
  | 'aborted'
  | 'completed'
  | 'error'

export type ReviewActionKind = 'approve' | 'reject' | 'rerun'
export type RuntimeLogCategory = 'progress' | 'output' | 'diagnostics'
export type RuntimeLogSeverity = 'info' | 'warning' | 'error'

export interface RuntimeLogEntry {
  id: string
  nodeId: NodeId
  content: string
  sourceType: 'stdout' | 'stderr'
  category: RuntimeLogCategory
  severity: RuntimeLogSeverity
  rawType?: string
}

export interface NodeRunMetrics {
  queuedAt?: string
  startedAt?: string
  completedAt?: string
  durationMs?: number
}

export interface PendingReviewContext {
  nodeId: NodeId
  nodeLabel?: string
  reviewReason: 'manual' | 'node'
  reviewPrompt: string
  agentVerdict?: 'APPROVED' | 'NEEDS_REVISION'
  outputPreview?: string
  requestedAt?: string
}

interface LogSlice {
  terminalLogs: Record<NodeId, string[]>
  runtimeLogs: Record<NodeId, RuntimeLogEntry[]>
  terminalLogCursors: Record<NodeId, number>
  nodeAttemptCounts: Record<NodeId, number>
  appendLogs: (
    nodeId: NodeId,
    newBatch: string[],
    metadata?: {
      sourceType?: 'stdout' | 'stderr'
      category?: RuntimeLogCategory
      severity?: RuntimeLogSeverity
      rawType?: string
    }
  ) => void
  appendAttemptSeparator: (nodeId: NodeId, message: string) => number
  clearLogs: (nodeId: NodeId) => void
}

interface StatusSlice {
  workflowStatus: WorkflowRuntimeStatus
  workflowError: string | null
  activeRunId?: string
  reviewNodeIds: NodeId[]
  reviewActionInFlightByNodeId: Record<NodeId, ReviewActionKind | undefined>
  nodeStatuses: Record<NodeId, NodeStatus>
  nodeErrors: Record<NodeId, string | undefined>
  nodeExitCodes: Record<NodeId, number | null | undefined>
  nodeOutputPaths: Record<NodeId, string | undefined>
  nodeRunMetrics: Record<NodeId, NodeRunMetrics>
  pendingReviewByNodeId: Record<NodeId, PendingReviewContext | undefined>
  compiledContexts: Record<NodeId, string>

  setWorkflowStatus: (status: WorkflowRuntimeStatus) => void
  setWorkflowError: (error: string | null) => void
  setActiveRunId: (runId?: string) => void
  addReviewNode: (nodeId: NodeId) => void
  removeReviewNode: (nodeId: NodeId) => void
  clearReviewNodes: () => void
  setReviewActionInFlight: (nodeId: NodeId, action?: ReviewActionKind) => void
  setNodeStatus: (nodeId: NodeId, status: NodeStatus) => void
  setNodeError: (nodeId: NodeId, error?: string) => void
  setNodeExitCode: (nodeId: NodeId, exitCode?: number | null) => void
  setNodeOutputPath: (nodeId: NodeId, outputFilePath?: string) => void
  setNodeRunMetrics: (nodeId: NodeId, metrics: Partial<NodeRunMetrics>) => void
  setNodeAttemptCount: (nodeId: NodeId, attemptCount: number) => void
  setPendingReviewContext: (nodeId: NodeId, context?: PendingReviewContext) => void
  setCompiledContext: (nodeId: NodeId, context: string) => void
  resetNodeExecution: (nodeIds: NodeId[]) => void
  resetExecution: (nodeIds: NodeId[]) => void
  clearReviewActionInFlight: () => void
}

type ExecutionState = LogSlice & StatusSlice

const MAX_LOG_LINES = 1000

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  // --- Log Slice ---
  terminalLogs: {},
  runtimeLogs: {},
  terminalLogCursors: {},
  nodeAttemptCounts: {},

  appendLogs: (nodeId, newBatch, metadata) => {
    if (newBatch.length === 0) {
      return
    }

    set((state) => {
      const existingLogs = state.terminalLogs[nodeId] || []
      const existingCursor = state.terminalLogCursors[nodeId] ?? existingLogs.length
      // Combine and slice to MAX_LOG_LINES to prevent RAM overflow
      let updatedLogs = [...existingLogs, ...newBatch]

      if (updatedLogs.length > MAX_LOG_LINES) {
        updatedLogs = updatedLogs.slice(updatedLogs.length - MAX_LOG_LINES)
      }

      return {
        runtimeLogs: {
          ...state.runtimeLogs,
          [nodeId]: [
            ...(state.runtimeLogs[nodeId] || []),
            ...newBatch.map(
              (content, index): RuntimeLogEntry => ({
                id: `${nodeId}:${existingCursor + index + 1}`,
                nodeId,
                content,
                sourceType: metadata?.sourceType ?? 'stdout',
                category:
                  metadata?.category ??
                  (metadata?.sourceType === 'stderr' ? 'diagnostics' : 'output'),
                severity:
                  metadata?.severity ??
                  (metadata?.sourceType === 'stderr' ? 'warning' : 'info'),
                rawType: metadata?.rawType
              })
            )
          ].slice(-MAX_LOG_LINES)
        },
        terminalLogCursors: {
          ...state.terminalLogCursors,
          [nodeId]: existingCursor + newBatch.length
        },
        terminalLogs: {
          ...state.terminalLogs,
          [nodeId]: updatedLogs
        }
      }
    })
  },

  appendAttemptSeparator: (nodeId, message) => {
    const state = get()
    const nextAttempt = (state.nodeAttemptCounts[nodeId] ?? 1) + 1
    const separator = `\x1b[2m[attempt ${nextAttempt}] ${message}\x1b[0m`

    set((currentState) => {
      const existingLogs = currentState.terminalLogs[nodeId] || []
      const existingCursor = currentState.terminalLogCursors[nodeId] ?? existingLogs.length
      let updatedLogs = [...existingLogs, separator]

      if (updatedLogs.length > MAX_LOG_LINES) {
        updatedLogs = updatedLogs.slice(updatedLogs.length - MAX_LOG_LINES)
      }

      return {
        nodeAttemptCounts: {
          ...currentState.nodeAttemptCounts,
          [nodeId]: nextAttempt
        },
        runtimeLogs: {
          ...currentState.runtimeLogs,
          [nodeId]: [
            ...(currentState.runtimeLogs[nodeId] || []),
            {
              id: `${nodeId}:${existingCursor + 1}`,
              nodeId,
              content: `${separator}\n`,
              sourceType: 'stdout',
              category: 'progress',
              severity: 'info',
              rawType: 'attempt-separator'
            } as RuntimeLogEntry
          ].slice(-MAX_LOG_LINES)
        },
        terminalLogCursors: {
          ...currentState.terminalLogCursors,
          [nodeId]: existingCursor + 1
        },
        terminalLogs: {
          ...currentState.terminalLogs,
          [nodeId]: updatedLogs
        }
      }
    })

    return nextAttempt
  },

  clearLogs: (nodeId) => {
    set((state) => ({
      terminalLogCursors: {
        ...state.terminalLogCursors,
        [nodeId]: 0
      },
      runtimeLogs: {
        ...state.runtimeLogs,
        [nodeId]: []
      },
      terminalLogs: {
        ...state.terminalLogs,
        [nodeId]: []
      }
    }))
  },

  // --- Status Slice ---
  workflowStatus: 'idle',
  workflowError: null,
  activeRunId: undefined,
  reviewNodeIds: [],
  reviewActionInFlightByNodeId: {},
  nodeStatuses: {},
  nodeErrors: {},
  nodeExitCodes: {},
  nodeOutputPaths: {},
  nodeRunMetrics: {},
  pendingReviewByNodeId: {},
  compiledContexts: {},

  setWorkflowStatus: (status) => set({ workflowStatus: status }),
  setWorkflowError: (error) => set({ workflowError: error }),
  setActiveRunId: (runId) => set({ activeRunId: runId }),
  addReviewNode: (nodeId) =>
    set((state) => ({
      reviewNodeIds: state.reviewNodeIds.includes(nodeId)
        ? state.reviewNodeIds
        : [...state.reviewNodeIds, nodeId],
      reviewActionInFlightByNodeId: {
        ...state.reviewActionInFlightByNodeId,
        [nodeId]: undefined
      }
    })),
  removeReviewNode: (nodeId) =>
    set((state) => ({
      reviewNodeIds: state.reviewNodeIds.filter((id) => id !== nodeId),
      reviewActionInFlightByNodeId: {
        ...state.reviewActionInFlightByNodeId,
        [nodeId]: undefined
      }
    })),
  clearReviewNodes: () => set({ reviewNodeIds: [], reviewActionInFlightByNodeId: {} }),

  setReviewActionInFlight: (nodeId, action) => {
    set((state) => ({
      reviewActionInFlightByNodeId: {
        ...state.reviewActionInFlightByNodeId,
        [nodeId]: action
      }
    }))
  },

  setNodeStatus: (nodeId, status) => {
    set((state) => ({
      reviewActionInFlightByNodeId:
        status !== 'paused'
          ? {
              ...state.reviewActionInFlightByNodeId,
              [nodeId]: undefined
            }
          : state.reviewActionInFlightByNodeId,
      nodeStatuses: {
        ...state.nodeStatuses,
        [nodeId]: status
      }
    }))
  },

  setNodeError: (nodeId, error) => {
    set((state) => ({
      nodeErrors: {
        ...state.nodeErrors,
        [nodeId]: error
      }
    }))
  },

  setNodeExitCode: (nodeId, exitCode) => {
    set((state) => ({
      nodeExitCodes: {
        ...state.nodeExitCodes,
        [nodeId]: exitCode
      }
    }))
  },

  setNodeOutputPath: (nodeId, outputFilePath) => {
    set((state) => ({
      nodeOutputPaths: {
        ...state.nodeOutputPaths,
        [nodeId]: outputFilePath
      }
    }))
  },

  setNodeRunMetrics: (nodeId, metrics) => {
    set((state) => ({
      nodeRunMetrics: {
        ...state.nodeRunMetrics,
        [nodeId]: {
          ...state.nodeRunMetrics[nodeId],
          ...metrics
        }
      }
    }))
  },

  setNodeAttemptCount: (nodeId, attemptCount) => {
    set((state) => ({
      nodeAttemptCounts: {
        ...state.nodeAttemptCounts,
        [nodeId]: Math.max(1, Math.floor(attemptCount))
      }
    }))
  },

  setPendingReviewContext: (nodeId, context) => {
    set((state) => ({
      pendingReviewByNodeId: {
        ...state.pendingReviewByNodeId,
        [nodeId]: context
      }
    }))
  },

  setCompiledContext: (nodeId, context) => {
    set((state) => ({
      compiledContexts: {
        ...state.compiledContexts,
        [nodeId]: context
      }
    }))
  },

  resetNodeExecution: (nodeIds) => {
    set((state) => {
      const nextNodeStatuses = { ...state.nodeStatuses }
      const nextContexts = { ...state.compiledContexts }
      const nextNodeErrors = { ...state.nodeErrors }
      const nextNodeExitCodes = { ...state.nodeExitCodes }
      const nextNodeOutputPaths = { ...state.nodeOutputPaths }
      const nextNodeRunMetrics = { ...state.nodeRunMetrics }
      const nextPendingReviewByNodeId = { ...state.pendingReviewByNodeId }
      const nextReviewActions = { ...state.reviewActionInFlightByNodeId }

      nodeIds.forEach((id) => {
        nextNodeStatuses[id] = 'idle'
        nextContexts[id] = ''
        nextNodeErrors[id] = undefined
        nextNodeExitCodes[id] = undefined
        nextNodeOutputPaths[id] = undefined
        nextNodeRunMetrics[id] = {}
        nextPendingReviewByNodeId[id] = undefined
        nextReviewActions[id] = undefined
      })

      return {
        reviewNodeIds: state.reviewNodeIds.filter((id) => !nodeIds.includes(id)),
        reviewActionInFlightByNodeId: nextReviewActions,
        nodeStatuses: nextNodeStatuses,
        nodeErrors: nextNodeErrors,
        nodeExitCodes: nextNodeExitCodes,
        nodeOutputPaths: nextNodeOutputPaths,
        nodeRunMetrics: nextNodeRunMetrics,
        pendingReviewByNodeId: nextPendingReviewByNodeId,
        compiledContexts: nextContexts
      }
    })
  },

  resetExecution: (nodeIds) => {
    const newNodeStatuses: Record<NodeId, NodeStatus> = {}
    const newLogs: Record<NodeId, string[]> = {}
    const newLogCursors: Record<NodeId, number> = {}
    const newAttemptCounts: Record<NodeId, number> = {}
    const newContexts: Record<NodeId, string> = {}
    const newNodeErrors: Record<NodeId, string | undefined> = {}
    const newNodeExitCodes: Record<NodeId, number | null | undefined> = {}
    const newNodeOutputPaths: Record<NodeId, string | undefined> = {}
    const newNodeRunMetrics: Record<NodeId, NodeRunMetrics> = {}
    const newPendingReviewByNodeId: Record<NodeId, PendingReviewContext | undefined> = {}
    const newRuntimeLogs: Record<NodeId, RuntimeLogEntry[]> = {}

    nodeIds.forEach((id) => {
      newNodeStatuses[id] = 'idle'
      newLogs[id] = []
      newRuntimeLogs[id] = []
      newLogCursors[id] = 0
      newAttemptCounts[id] = 1
      newContexts[id] = ''
      newNodeErrors[id] = undefined
      newNodeExitCodes[id] = undefined
      newNodeOutputPaths[id] = undefined
      newNodeRunMetrics[id] = {}
      newPendingReviewByNodeId[id] = undefined
    })

    set({
      workflowStatus: 'idle',
      workflowError: null,
      activeRunId: undefined,
      reviewNodeIds: [],
      reviewActionInFlightByNodeId: {},
      nodeStatuses: newNodeStatuses,
      nodeErrors: newNodeErrors,
      nodeExitCodes: newNodeExitCodes,
      nodeOutputPaths: newNodeOutputPaths,
      nodeRunMetrics: newNodeRunMetrics,
      pendingReviewByNodeId: newPendingReviewByNodeId,
      terminalLogs: newLogs,
      runtimeLogs: newRuntimeLogs,
      terminalLogCursors: newLogCursors,
      nodeAttemptCounts: newAttemptCounts,
      compiledContexts: newContexts
    })
  },

  clearReviewActionInFlight: () =>
    set((state) => ({
      reviewActionInFlightByNodeId: Object.fromEntries(
        Object.keys(state.reviewActionInFlightByNodeId).map((nodeId) => [nodeId, undefined])
      )
    }))
}))
