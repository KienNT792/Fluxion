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
  OPENAI_DEFAULT_MODEL,
  OPENAI_DEFAULT_REASONING_LEVEL,
  ProviderCapabilitiesMap,
  WorkflowNode,
  WorkspaceFileChangedPayload,
  WorkspaceOpenedPayload,
  WorkflowMetadata,
  isOpenAIReasoningModel,
} from '@shared';

interface WorkspaceChangeRecord extends WorkspaceFileChangedPayload {
  receivedAt: number;
}

interface WorkflowState {
  workflowId: string;
  workflowName: string;
  workflowRevision: number;
  lastSavedRevision: number;
  nodes: Node<WorkflowNode['data']>[];
  edges: Edge[];
  workspacePath: string | null;
  selectedNodeId: string | null;
  terminalNodeId: string | null;
  lastSavedAt: string | null;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  hasExternalWorkflowChange: boolean;
  recentWorkspaceChanges: WorkspaceChangeRecord[];
  hasContext: boolean;
  activeWorkflowFilePath: string | null;
  workflows: WorkflowMetadata[];
  legacyWorkflowDetected: boolean;
  providerCapabilities: ProviderCapabilitiesMap;
  isProviderCapabilitiesLoading: boolean;
  hasFetchedProviderCapabilities: boolean;

  setWorkspacePath: (path: string | null) => void;
  setWorkflowName: (name: string) => void;
  fetchProviderCapabilities: () => Promise<ProviderCapabilitiesMap>;
  hydrateWorkspace: (payload: WorkspaceOpenedPayload) => void;
  setNodes: (nodes: Node<WorkflowNode['data']>[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange<Node<WorkflowNode['data']>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (preset: Partial<AgentNodeData>, position: { x: number; y: number }) => void;
  setSelectedNode: (id: string | null) => void;
  setTerminalNodeId: (id: string | null) => void;
  updateNodeData: (id: string, newData: Partial<WorkflowNode['data']>) => void;
  deleteNode: (id: string) => void;
  markSaveStarted: () => void;
  markSaveCompleted: (savedAt: string, savedRevision: number) => void;
  markSaveFailed: (error: string) => void;
  recordWorkspaceChange: (change: WorkspaceFileChangedPayload) => void;
  clearExternalWorkflowChange: () => void;
  setHasContext: (hasContext: boolean) => void;
}

const MAX_WORKSPACE_CHANGES = 5;
const EMPTY_PROVIDER_CAPABILITIES: ProviderCapabilitiesMap = {};

function normalizeNodeData(data: WorkflowNode['data']): WorkflowNode['data'] {
  const model =
    typeof data.model === 'string' && data.model.trim().length > 0
      ? data.model.trim()
      : OPENAI_DEFAULT_MODEL;

  return {
    ...data,
    provider: 'openai',
    model,
    prompt: typeof data.prompt === 'string' ? data.prompt : '',
  };
}

function getDefaultOpenAIModel(providerCapabilities: ProviderCapabilitiesMap): string {
  return (
    providerCapabilities.openai?.defaultModel
    ?? providerCapabilities.openai?.models.find((model) => model.visibility === 'list')?.id
    ?? providerCapabilities.openai?.models[0]?.id
    ?? OPENAI_DEFAULT_MODEL
  );
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
  nodes: [],
  edges: [],
  workspacePath: null,
  selectedNodeId: null,
  terminalNodeId: null,
  lastSavedAt: null,
  isDirty: false,
  isSaving: false,
  saveError: null,
  hasExternalWorkflowChange: false,
  recentWorkspaceChanges: [],
  hasContext: false,
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

  fetchProviderCapabilities: async () => {
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
      const capabilities = await window.api.getProviderCapabilities();
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
      lastSavedAt: payload.workflow.updatedAt ?? new Date().toISOString(),
      isDirty: false,
      isSaving: false,
      saveError: null,
      hasExternalWorkflowChange: false,
      recentWorkspaceChanges: [],
      activeWorkflowFilePath: payload.activeWorkflowFilePath,
      workflows: payload.workflows,
      legacyWorkflowDetected: payload.legacyWorkflowDetected,
      hasContext: payload.hasContext,
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
    const model = getDefaultOpenAIModel(get().providerCapabilities);
    const newNodeId = `node-${Date.now()}`;
    const newNode: Node<WorkflowNode['data']> = {
      id: newNodeId,
      position,
      data: {
        provider: 'openai',
        model,
        prompt: '',
        systemInstruction: '',
        maxTokens: 2048,
        temperature: 0.7,
        reasoningLevel: isOpenAIReasoningModel(model)
          ? OPENAI_DEFAULT_REASONING_LEVEL
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
              provider: 'openai',
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
  setHasContext: (hasContext) => set({ hasContext }),
}));
