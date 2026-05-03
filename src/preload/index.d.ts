import { ElectronAPI } from '@electron-toolkit/preload';
import {
  AbortReason,
  MemoryContextReadyPayload,
  NodeId,
  ProviderCapabilitiesPayload,
  ProviderSettingsSummaryPayload,
  TerminalDataBatchPayload,
  TerminalErrorPayload,
  TerminalExitPayload,
  Workflow,
  WorkflowCompletedPayload,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeOutputPayload,
  WorkflowNodeStatusPayload,
  WorkflowSavedPayload,
  WorkspaceFileChangedPayload,
  WorkspaceOpenedPayload,
  WorkflowCreateResult,
} from '@shared';

export interface FluxionAPI {
  openWorkspaceDialog: () => Promise<string | null>;
  loadWorkspace: (workspacePath: string) => Promise<WorkspaceOpenedPayload>;
  saveWorkflow: (
    workspacePath: string, 
    workflow: Workflow, 
    activeWorkflowFilePath: string
  ) => Promise<WorkflowSavedPayload>;
  saveContext: (workspacePath: string, context: Record<string, string>) => Promise<void>;
  getProviderCapabilities: () => Promise<ProviderCapabilitiesPayload>;
  getProviderSettingsSummary: () => Promise<ProviderSettingsSummaryPayload>;
  setOpenAIApiKey: (apiKey: string | null) => Promise<ProviderSettingsSummaryPayload>;
  
  // ─── Multi-Workflow ────────────────────────────────────────────────────────
  createWorkflow: (workspacePath: string, name: string) => Promise<WorkflowCreateResult>;
  loadWorkflow: (workspacePath: string, workflowId: string) => Promise<Workflow>;
  deleteWorkflow: (workspacePath: string, workflowId: string) => Promise<void>;
  runWorkflow: (
    workflowId: string,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    workspacePath: string,
    resumeFromNodeId?: NodeId
  ) => void;
  abortWorkflow: (nodeId?: NodeId, reason?: AbortReason) => void;

  onWorkspaceFileChanged: (callback: (payload: WorkspaceFileChangedPayload) => void) => () => void;
  onTerminalDataBatch: (callback: (payload: TerminalDataBatchPayload) => void) => () => void;
  onTerminalError: (callback: (payload: TerminalErrorPayload) => void) => () => void;
  onTerminalExit: (callback: (payload: TerminalExitPayload) => void) => () => void;
  onWorkflowNodeStatus: (callback: (payload: WorkflowNodeStatusPayload) => void) => () => void;
  onWorkflowNodeOutput: (callback: (payload: WorkflowNodeOutputPayload) => void) => () => void;
  onMemoryContextReady: (callback: (payload: MemoryContextReadyPayload) => void) => () => void;
  onWorkflowCompleted: (callback: (payload: WorkflowCompletedPayload) => void) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: FluxionAPI;
  }
}
