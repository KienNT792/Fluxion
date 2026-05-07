import { create } from 'zustand';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
} from '@xyflow/react';
import {
  AgentNodeData,
  CODEX_DEFAULT_MODEL,
  CODEX_DEFAULT_REASONING_LEVEL,
  ProjectContextDraft,
  ExecutionMode,
  ProviderCapabilitiesMap,
  ReasoningLevel,
  WorkspaceContextStatus,
  WorkflowNode,
  WorkspaceFileChangedPayload,
  WorkspaceOpenedPayload,
  WorkflowMetadata,
} from '@shared';
import {
  getCodexModelById,
  getDefaultCodexModel,
} from '../lib/provider-capabilities';

interface WorkspaceChangeRecord extends WorkspaceFileChangedPayload {
  receivedAt: number;
}

interface ReviewFocusRequest {
  nodeId: string;
  requestId: number;
}

interface WorkflowState {
  workflowId: string;
  workflowName: string;
  workflowRevision: number;
  lastSavedRevision: number;
  executionMode: ExecutionMode;
  nodes: Node<WorkflowNode['data']>[];
  edges: Edge[];
  workspacePath: string | null;
  selectedNodeId: string | null;
  terminalNodeId: string | null;
  reviewFocusRequest: ReviewFocusRequest | null;
  lastSavedAt: string | null;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  hasExternalWorkflowChange: boolean;
  recentWorkspaceChanges: WorkspaceChangeRecord[];
  contextStatus: WorkspaceContextStatus;
  contextSummary: ProjectContextDraft | null;
  isContextSetupOpen: boolean;
  activeWorkflowFilePath: string | null;
  workflows: WorkflowMetadata[];
  legacyWorkflowDetected: boolean;
  providerCapabilities: ProviderCapabilitiesMap;
  isProviderCapabilitiesLoading: boolean;
  hasFetchedProviderCapabilities: boolean;

  setWorkspacePath: (path: string | null) => void;
  setWorkflowName: (name: string) => void;
  setExecutionMode: (mode: ExecutionMode) => void;
  fetchProviderCapabilities: (forceRefresh?: boolean) => Promise<ProviderCapabilitiesMap>;
  hydrateWorkspace: (payload: WorkspaceOpenedPayload) => void;
  setNodes: (nodes: Node<WorkflowNode['data']>[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange<Node<WorkflowNode['data']>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (preset: Partial<AgentNodeData>, position: { x: number; y: number }) => void;
  setSelectedNode: (id: string | null) => void;
  setTerminalNodeId: (id: string | null) => void;
  requestReviewFocus: (id: string) => void;
  updateNodeData: (id: string, newData: Partial<WorkflowNode['data']>) => void;
  deleteNode: (id: string) => void;
  markSaveStarted: () => void;
  markSaveCompleted: (savedAt: string, savedRevision: number) => void;
  markSaveFailed: (error: string) => void;
  recordWorkspaceChange: (change: WorkspaceFileChangedPayload) => void;
  clearExternalWorkflowChange: () => void;
  setContextSetupOpen: (isOpen: boolean) => void;
  setContextState: (
    status: WorkspaceContextStatus,
    contextSummary: ProjectContextDraft | null
  ) => void;
}

const MAX_WORKSPACE_CHANGES = 5;
const EMPTY_PROVIDER_CAPABILITIES: ProviderCapabilitiesMap = {};

function normalizeNodeData(data: WorkflowNode['data']): WorkflowNode['data'] {
  const model =
    typeof data.model === 'string' && data.model.trim().length > 0
      ? data.model.trim()
      : CODEX_DEFAULT_MODEL;

  return {
    ...data,
    provider: 'codex',
    model,
    prompt: typeof data.prompt === 'string' ? data.prompt : '',
  };
}

function applySelectionState(
  nodes: Node<WorkflowNode['data']>[],
  selectedNodeId: string | null
): Node<WorkflowNode['data']>[] {
  return nodes.map((node) => ({
    ...node,
    selected: node.id === selectedNodeId,
  }));
}

function hasSelectionState(
  nodes: Node<WorkflowNode['data']>[],
  selectedNodeId: string | null
): boolean {
  return nodes.every((node) => Boolean(node.selected) === (node.id === selectedNodeId));
}

function shouldMarkNodeChangesDirty(
  changes: NodeChange<Node<WorkflowNode['data']>>[]
): boolean {
  return changes.some((change) => change.type !== 'select' && change.type !== 'dimensions');
}

function shouldMarkEdgeChangesDirty(changes: EdgeChange[]): boolean {
  return changes.some((change) => change.type !== 'select');
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflowId: 'fluxion-workflow-1',
  workflowName: 'Fluxion Workflow',
  workflowRevision: 0,
  lastSavedRevision: 0,
  executionMode: 'auto',
  nodes: [],
  edges: [],
  workspacePath: null,
  selectedNodeId: null,
  terminalNodeId: null,
  reviewFocusRequest: null,
  lastSavedAt: null,
  isDirty: false,
  isSaving: false,
  saveError: null,
  hasExternalWorkflowChange: false,
  recentWorkspaceChanges: [],
  contextStatus: 'missing',
  contextSummary: null,
  isContextSetupOpen: false,
  activeWorkflowFilePath: null,
  workflows: [],
  legacyWorkflowDetected: false,
  providerCapabilities: EMPTY_PROVIDER_CAPABILITIES,
  isProviderCapabilitiesLoading: false,
  hasFetchedProviderCapabilities: false,

  setWorkspacePath: (path) => set({ workspacePath: path }),

  setWorkflowName: (name) =>
    set((state) => ({
      workflowName: name,
      workflowRevision: state.workflowRevision + 1,
      isDirty: true,
      saveError: null,
    })),

  setExecutionMode: (mode) =>
    set((state) => {
      if (state.executionMode === mode) {
        return state;
      }

      return {
        executionMode: mode,
        workflowRevision: state.workflowRevision + 1,
        isDirty: true,
        saveError: null,
      };
    }),

  fetchProviderCapabilities: async (forceRefresh = false) => {
    if (!window.api?.getProviderCapabilities) {
      set({
        providerCapabilities: EMPTY_PROVIDER_CAPABILITIES,
        isProviderCapabilitiesLoading: false,
        hasFetchedProviderCapabilities: true,
      });

      return EMPTY_PROVIDER_CAPABILITIES;
    }

    set({ isProviderCapabilitiesLoading: true });

    try {
      const capabilities = await window.api.getProviderCapabilities({ forceRefresh });
      set({
        providerCapabilities: capabilities,
        isProviderCapabilitiesLoading: false,
        hasFetchedProviderCapabilities: true,
      });
      return capabilities;
    } catch {
      const previousCapabilities = get().providerCapabilities;

      set({
        providerCapabilities: previousCapabilities,
        isProviderCapabilitiesLoading: false,
        hasFetchedProviderCapabilities: true,
      });

      return previousCapabilities;
    }
  },

  hydrateWorkspace: (payload) =>
    set({
      workflowId: payload.workflow.id,
      workflowName: payload.workflow.name,
      workflowRevision: 0,
      lastSavedRevision: 0,
      executionMode: payload.workflow.executionMode ?? 'auto',
      nodes: applySelectionState(
        payload.workflow.nodes.map((node) => ({
          id: node.id,
          position: node.position,
          data: normalizeNodeData(node.data),
          type: node.type ?? 'agentNode',
        })),
        null
      ),
      edges: payload.workflow.edges.map((edge) => ({
        ...edge,
        type: 'animatedEdge',
      })),
      workspacePath: payload.workspacePath,
      selectedNodeId: null,
      terminalNodeId: null,
      reviewFocusRequest: null,
      lastSavedAt: payload.workflow.updatedAt ?? new Date().toISOString(),
      isDirty: false,
      isSaving: false,
      saveError: null,
      hasExternalWorkflowChange: false,
      recentWorkspaceChanges: [],
      activeWorkflowFilePath: payload.activeWorkflowFilePath,
      workflows: payload.workflows,
      legacyWorkflowDetected: payload.legacyWorkflowDetected,
      contextStatus: payload.contextStatus,
      contextSummary: payload.contextSummary ?? null,
      isContextSetupOpen: false,
    }),

  setNodes: (nodes) =>
    set((state) => ({
      nodes: applySelectionState(
        nodes.map((node) => ({
          ...node,
          data: normalizeNodeData(node.data),
        })),
        state.selectedNodeId
      ),
      workflowRevision: state.workflowRevision + 1,
      isDirty: true,
      saveError: null,
    })),

  setEdges: (edges) =>
    set((state) => ({
      edges,
      workflowRevision: state.workflowRevision + 1,
      isDirty: true,
      saveError: null,
    })),

  onNodesChange: (changes) => {
    set((state) => {
      const updatedNodes = applyNodeChanges(changes, state.nodes) as Node<WorkflowNode['data']>[];

      return {
        nodes: applySelectionState(updatedNodes, state.selectedNodeId),
        workflowRevision: shouldMarkNodeChangesDirty(changes)
          ? state.workflowRevision + 1
          : state.workflowRevision,
        isDirty: shouldMarkNodeChangesDirty(changes) ? true : state.isDirty,
        saveError: shouldMarkNodeChangesDirty(changes) ? null : state.saveError,
      };
    });
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      workflowRevision: shouldMarkEdgeChangesDirty(changes)
        ? state.workflowRevision + 1
        : state.workflowRevision,
      isDirty: shouldMarkEdgeChangesDirty(changes) ? true : state.isDirty,
      saveError: shouldMarkEdgeChangesDirty(changes) ? null : state.saveError,
    }));
  },

  onConnect: (connection) => {
    set((state) => ({
      edges: addEdge({ ...connection, type: 'animatedEdge' }, state.edges),
      workflowRevision: state.workflowRevision + 1,
      isDirty: true,
      saveError: null,
    }));
  },

  addNode: (_preset, position) => {
    const preset = _preset;
    const providerCapabilities = get().providerCapabilities;
    const requestedModel =
      typeof preset.model === 'string' && preset.model.trim().length > 0
        ? preset.model.trim()
        : getDefaultCodexModel(providerCapabilities);
    const model = requestedModel || CODEX_DEFAULT_MODEL;
    const reasoningLevels = getCodexModelById(
      providerCapabilities,
      model
    )?.supportedReasoningLevels.filter(
      (level): level is ReasoningLevel =>
        level === 'low' || level === 'medium' || level === 'high' || level === 'xhigh'
    );
    const newNodeId = `node-${Date.now()}`;
    const newNode: Node<WorkflowNode['data']> = {
      id: newNodeId,
      position,
      data: {
        provider: 'codex',
        model,
        prompt: '',
        systemInstruction: '',
        reasoningLevel: reasoningLevels && reasoningLevels.length > 0
          ? reasoningLevels.includes(CODEX_DEFAULT_REASONING_LEVEL)
            ? CODEX_DEFAULT_REASONING_LEVEL
            : reasoningLevels[0]
          : undefined,
      },
      type: 'agentNode',
    };

    set((state) => ({
      nodes: applySelectionState([...state.nodes, newNode], state.selectedNodeId),
      workflowRevision: state.workflowRevision + 1,
      isDirty: true,
      saveError: null,
    }));
  },

  setSelectedNode: (id) =>
    set((state) => {
      if (state.selectedNodeId === id && hasSelectionState(state.nodes, id)) {
        return state;
      }

      return {
        selectedNodeId: id,
        nodes: applySelectionState(state.nodes, id),
      };
    }),

  setTerminalNodeId: (id) => set({ terminalNodeId: id }),

  requestReviewFocus: (id) =>
    set((state) => ({
      selectedNodeId: id,
      nodes: applySelectionState(state.nodes, id),
      reviewFocusRequest: {
        nodeId: id,
        requestId: Date.now(),
      },
    })),

  updateNodeData: (id, newData) => {
    set((state) => ({
      nodes: applySelectionState(
        state.nodes.map((node) => {
          if (node.id !== id) {
            return node;
          }

          return {
            ...node,
            data: normalizeNodeData({
              ...node.data,
              ...newData,
            }),
          };
        }),
        state.selectedNodeId
      ),
      workflowRevision: state.workflowRevision + 1,
      isDirty: true,
      saveError: null,
    }));
  },

  deleteNode: (id) => {
    set((state) => ({
      nodes: applySelectionState(
        state.nodes.filter((node) => node.id !== id),
        state.selectedNodeId === id ? null : state.selectedNodeId
      ),
      edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      terminalNodeId: state.terminalNodeId === id ? null : state.terminalNodeId,
      reviewFocusRequest:
        state.reviewFocusRequest?.nodeId === id ? null : state.reviewFocusRequest,
      workflowRevision: state.workflowRevision + 1,
      isDirty: true,
      saveError: null,
    }));
  },

  markSaveStarted: () =>
    set({
      isSaving: true,
      saveError: null,
    }),

  markSaveCompleted: (savedAt, savedRevision) =>
    set((state) => ({
      isSaving: false,
      saveError: null,
      lastSavedAt: savedAt,
      lastSavedRevision: Math.max(state.lastSavedRevision, savedRevision),
      hasExternalWorkflowChange: false,
      isDirty: state.workflowRevision > savedRevision,
    })),

  markSaveFailed: (error) =>
    set({
      isSaving: false,
      saveError: error,
      isDirty: true,
    }),

  recordWorkspaceChange: (change) =>
    set((state) => {
      const nextChange: WorkspaceChangeRecord = {
        ...change,
        receivedAt: Date.now(),
      };

      return {
        recentWorkspaceChanges: [nextChange, ...state.recentWorkspaceChanges].slice(
          0,
          MAX_WORKSPACE_CHANGES
        ),
        hasExternalWorkflowChange:
          state.hasExternalWorkflowChange ||
          (state.activeWorkflowFilePath != null &&
            change.filePath.toLowerCase().replace(/\\/g, '/')
            === state.activeWorkflowFilePath.toLowerCase().replace(/\\/g, '/')),
      };
    }),

  clearExternalWorkflowChange: () => set({ hasExternalWorkflowChange: false }),
  setContextSetupOpen: (isContextSetupOpen) => set({ isContextSetupOpen }),
  setContextState: (contextStatus, contextSummary) =>
    set({ contextStatus, contextSummary }),
}));
