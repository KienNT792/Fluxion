import { create } from 'zustand';
import { NodeId, NodeStatus } from '@shared';

// We split into slices conceptually, but keep them in one store for easy access 
// since Zustand handles partial updates very well.

interface LogSlice {
  terminalLogs: Record<NodeId, string[]>;
  appendLogs: (nodeId: NodeId, newBatch: string[]) => void;
  clearLogs: (nodeId: NodeId) => void;
}

interface StatusSlice {
  workflowStatus: 'idle' | 'running' | 'paused' | 'aborted' | 'completed' | 'error';
  workflowError: string | null;
  activeRunId?: string;
  reviewNodeIds: NodeId[];
  nodeStatuses: Record<NodeId, NodeStatus>;
  nodeErrors: Record<NodeId, string | undefined>;
  nodeExitCodes: Record<NodeId, number | null | undefined>;
  nodeOutputPaths: Record<NodeId, string | undefined>;
  compiledContexts: Record<NodeId, string>;
  
  setWorkflowStatus: (status: 'idle' | 'running' | 'paused' | 'aborted' | 'completed' | 'error') => void;
  setWorkflowError: (error: string | null) => void;
  setActiveRunId: (runId?: string) => void;
  addReviewNode: (nodeId: NodeId) => void;
  removeReviewNode: (nodeId: NodeId) => void;
  clearReviewNodes: () => void;
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

export const useExecutionStore = create<ExecutionState>((set) => ({
  // --- Log Slice ---
  terminalLogs: {},
  
  appendLogs: (nodeId, newBatch) => {
    set((state) => {
      const existingLogs = state.terminalLogs[nodeId] || [];
      // Combine and slice to MAX_LOG_LINES to prevent RAM overflow
      let updatedLogs = [...existingLogs, ...newBatch];
      
      if (updatedLogs.length > MAX_LOG_LINES) {
        updatedLogs = updatedLogs.slice(updatedLogs.length - MAX_LOG_LINES);
      }
      
      return {
        terminalLogs: {
          ...state.terminalLogs,
          [nodeId]: updatedLogs
        }
      };
    });
  },

  clearLogs: (nodeId) => {
    set((state) => ({
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
        : [...state.reviewNodeIds, nodeId]
    })),
  removeReviewNode: (nodeId) =>
    set((state) => ({
      reviewNodeIds: state.reviewNodeIds.filter((id) => id !== nodeId)
    })),
  clearReviewNodes: () => set({ reviewNodeIds: [] }),

  setNodeStatus: (nodeId, status) => {
    set((state) => ({
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
      const nextLogs = { ...state.terminalLogs };
      const nextContexts = { ...state.compiledContexts };
      const nextNodeErrors = { ...state.nodeErrors };
      const nextNodeExitCodes = { ...state.nodeExitCodes };
      const nextNodeOutputPaths = { ...state.nodeOutputPaths };

      nodeIds.forEach((id) => {
        nextNodeStatuses[id] = 'idle';
        nextLogs[id] = [];
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
        terminalLogs: nextLogs,
        compiledContexts: nextContexts
      };
    });
  },

  resetExecution: (nodeIds) => {
    const newNodeStatuses: Record<NodeId, NodeStatus> = {};
    const newLogs: Record<NodeId, string[]> = {};
    const newContexts: Record<NodeId, string> = {};
    const newNodeErrors: Record<NodeId, string | undefined> = {};
    const newNodeExitCodes: Record<NodeId, number | null | undefined> = {};
    const newNodeOutputPaths: Record<NodeId, string | undefined> = {};

    nodeIds.forEach(id => {
      newNodeStatuses[id] = 'idle';
      newLogs[id] = [];
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
      nodeStatuses: newNodeStatuses,
      nodeErrors: newNodeErrors,
      nodeExitCodes: newNodeExitCodes,
      nodeOutputPaths: newNodeOutputPaths,
      terminalLogs: newLogs,
      compiledContexts: newContexts
    });
  }
}));
