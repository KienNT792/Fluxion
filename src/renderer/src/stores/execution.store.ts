import { create } from 'zustand';
import { NodeId, NodeStatus } from '@shared';

// We split into slices conceptually, but keep them in one store for easy access 
// since Zustand handles partial updates very well.

export type WorkflowRuntimeStatus =
  | 'idle'
  | 'running'
  | 'stopping'
  | 'paused'
  | 'aborted'
  | 'completed'
  | 'error';

export type ReviewActionKind = 'approve' | 'reject' | 'rerun';

interface LogSlice {
  terminalLogs: Record<NodeId, string[]>;
  terminalLogCursors: Record<NodeId, number>;
  nodeAttemptCounts: Record<NodeId, number>;
  appendLogs: (nodeId: NodeId, newBatch: string[]) => void;
  appendAttemptSeparator: (nodeId: NodeId, message: string) => number;
  clearLogs: (nodeId: NodeId) => void;
}

interface StatusSlice {
  workflowStatus: WorkflowRuntimeStatus;
  workflowError: string | null;
  activeRunId?: string;
  reviewNodeIds: NodeId[];
  reviewActionInFlightByNodeId: Record<NodeId, ReviewActionKind | undefined>;
  nodeStatuses: Record<NodeId, NodeStatus>;
  nodeErrors: Record<NodeId, string | undefined>;
  nodeExitCodes: Record<NodeId, number | null | undefined>;
  nodeOutputPaths: Record<NodeId, string | undefined>;
  compiledContexts: Record<NodeId, string>;
  
  setWorkflowStatus: (status: WorkflowRuntimeStatus) => void;
  setWorkflowError: (error: string | null) => void;
  setActiveRunId: (runId?: string) => void;
  addReviewNode: (nodeId: NodeId) => void;
  removeReviewNode: (nodeId: NodeId) => void;
  clearReviewNodes: () => void;
  setReviewActionInFlight: (nodeId: NodeId, action?: ReviewActionKind) => void;
  setNodeStatus: (nodeId: NodeId, status: NodeStatus) => void;
  setNodeError: (nodeId: NodeId, error?: string) => void;
  setNodeExitCode: (nodeId: NodeId, exitCode?: number | null) => void;
  setNodeOutputPath: (nodeId: NodeId, outputFilePath?: string) => void;
  setCompiledContext: (nodeId: NodeId, context: string) => void;
  resetNodeExecution: (nodeIds: NodeId[]) => void;
  resetExecution: (nodeIds: NodeId[]) => void;
}

type ExecutionState = LogSlice & StatusSlice;

const MAX_LOG_LINES = 1000;

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  // --- Log Slice ---
  terminalLogs: {},
  terminalLogCursors: {},
  nodeAttemptCounts: {},
  
  appendLogs: (nodeId, newBatch) => {
    if (newBatch.length === 0) {
      return;
    }

    set((state) => {
      const existingLogs = state.terminalLogs[nodeId] || [];
      const existingCursor = state.terminalLogCursors[nodeId] ?? existingLogs.length;
      // Combine and slice to MAX_LOG_LINES to prevent RAM overflow
      let updatedLogs = [...existingLogs, ...newBatch];
      
      if (updatedLogs.length > MAX_LOG_LINES) {
        updatedLogs = updatedLogs.slice(updatedLogs.length - MAX_LOG_LINES);
      }
      
      return {
        terminalLogCursors: {
          ...state.terminalLogCursors,
          [nodeId]: existingCursor + newBatch.length
        },
        terminalLogs: {
          ...state.terminalLogs,
          [nodeId]: updatedLogs
        }
      };
    });
  },

  appendAttemptSeparator: (nodeId, message) => {
    const state = get();
    const nextAttempt = (state.nodeAttemptCounts[nodeId] ?? 1) + 1;
    const separator = `\x1b[2m[attempt ${nextAttempt}] ${message}\x1b[0m`;

    set((currentState) => {
      const existingLogs = currentState.terminalLogs[nodeId] || [];
      const existingCursor =
        currentState.terminalLogCursors[nodeId] ?? existingLogs.length;
      let updatedLogs = [...existingLogs, separator];

      if (updatedLogs.length > MAX_LOG_LINES) {
        updatedLogs = updatedLogs.slice(updatedLogs.length - MAX_LOG_LINES);
      }

      return {
        nodeAttemptCounts: {
          ...currentState.nodeAttemptCounts,
          [nodeId]: nextAttempt
        },
        terminalLogCursors: {
          ...currentState.terminalLogCursors,
          [nodeId]: existingCursor + 1
        },
        terminalLogs: {
          ...currentState.terminalLogs,
          [nodeId]: updatedLogs
        }
      };
    });

    return nextAttempt;
  },

  clearLogs: (nodeId) => {
    set((state) => ({
      terminalLogCursors: {
        ...state.terminalLogCursors,
        [nodeId]: 0
      },
      terminalLogs: {
        ...state.terminalLogs,
        [nodeId]: []
      }
    }));
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
    }));
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
    }));
  },

  setNodeError: (nodeId, error) => {
    set((state) => ({
      nodeErrors: {
        ...state.nodeErrors,
        [nodeId]: error
      }
    }));
  },

  setNodeExitCode: (nodeId, exitCode) => {
    set((state) => ({
      nodeExitCodes: {
        ...state.nodeExitCodes,
        [nodeId]: exitCode
      }
    }));
  },

  setNodeOutputPath: (nodeId, outputFilePath) => {
    set((state) => ({
      nodeOutputPaths: {
        ...state.nodeOutputPaths,
        [nodeId]: outputFilePath
      }
    }));
  },

  setCompiledContext: (nodeId, context) => {
    set((state) => ({
      compiledContexts: {
        ...state.compiledContexts,
        [nodeId]: context
      }
    }));
  },

  resetNodeExecution: (nodeIds) => {
    set((state) => {
      const nextNodeStatuses = { ...state.nodeStatuses };
      const nextContexts = { ...state.compiledContexts };
      const nextNodeErrors = { ...state.nodeErrors };
      const nextNodeExitCodes = { ...state.nodeExitCodes };
      const nextNodeOutputPaths = { ...state.nodeOutputPaths };

      nodeIds.forEach((id) => {
        nextNodeStatuses[id] = 'idle';
        nextContexts[id] = '';
        nextNodeErrors[id] = undefined;
        nextNodeExitCodes[id] = undefined;
        nextNodeOutputPaths[id] = undefined;
      });

      return {
        reviewNodeIds: state.reviewNodeIds.filter((id) => !nodeIds.includes(id)),
        nodeStatuses: nextNodeStatuses,
        nodeErrors: nextNodeErrors,
        nodeExitCodes: nextNodeExitCodes,
        nodeOutputPaths: nextNodeOutputPaths,
        compiledContexts: nextContexts
      };
    });
  },

  resetExecution: (nodeIds) => {
    const newNodeStatuses: Record<NodeId, NodeStatus> = {};
    const newLogs: Record<NodeId, string[]> = {};
    const newLogCursors: Record<NodeId, number> = {};
    const newAttemptCounts: Record<NodeId, number> = {};
    const newContexts: Record<NodeId, string> = {};
    const newNodeErrors: Record<NodeId, string | undefined> = {};
    const newNodeExitCodes: Record<NodeId, number | null | undefined> = {};
    const newNodeOutputPaths: Record<NodeId, string | undefined> = {};

    nodeIds.forEach(id => {
      newNodeStatuses[id] = 'idle';
      newLogs[id] = [];
      newLogCursors[id] = 0;
      newAttemptCounts[id] = 1;
      newContexts[id] = '';
      newNodeErrors[id] = undefined;
      newNodeExitCodes[id] = undefined;
      newNodeOutputPaths[id] = undefined;
    });

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
      terminalLogs: newLogs,
      terminalLogCursors: newLogCursors,
      nodeAttemptCounts: newAttemptCounts,
      compiledContexts: newContexts
    });
  }
}));
