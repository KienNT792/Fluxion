import { ElectronAPI } from '@electron-toolkit/preload';
import {
  AbortReason,
  ContextSaveMode,
  ContextScanResult,
  ExecutionMode,
  MemoryContextReadyPayload,
  NodeId,
  GetProviderCapabilitiesPayload,
  ProviderCapabilitiesPayload,
  ProviderSettingsSummaryPayload,
  ProjectContextDraftV2,
  TerminalDataBatchPayload,
  TerminalErrorPayload,
  TerminalExitPayload,
  Workflow,
  WorkflowReviewActionPayload,
  WorkflowReviewRequiredPayload,
  WorkflowCompletedPayload,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeOutputPayload,
  WorkflowNodeStatusPayload,
  WorkflowSavedPayload,
  WorkspaceContextSavedPayload,
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
  scanWorkspaceContext: (workspacePath: string) => Promise<ContextScanResult>;
  getContext: (workspacePath: string) => Promise<ProjectContextDraftV2 | null>;
  saveContextV2: (
    workspacePath: string,
    draft: ProjectContextDraftV2,
    mode?: ContextSaveMode
  ) => Promise<WorkspaceContextSavedPayload>;
  getProviderCapabilities: (
    payload?: GetProviderCapabilitiesPayload
  ) => Promise<ProviderCapabilitiesPayload>;
  getProviderSettingsSummary: () => Promise<ProviderSettingsSummaryPayload>;
  setOpenAIApiKey: (apiKey: string | null) => Promise<ProviderSettingsSummaryPayload>;
  openPath: (path: string) => Promise<void>;
  revealPath: (path: string) => Promise<void>;
  
  // ─── Multi-Workflow ────────────────────────────────────────────────────────
  createWorkflow: (workspacePath: string, name: string) => Promise<WorkflowCreateResult>;
  loadWorkflow: (workspacePath: string, workflowId: string) => Promise<Workflow>;
  deleteWorkflow: (workspacePath: string, workflowId: string) => Promise<void>;
  runWorkflow: (
    workflowId: string,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    workspacePath: string,
    executionMode: ExecutionMode,
    resumeFromNodeId?: NodeId
  ) => void;
  abortWorkflow: (nodeId?: NodeId, reason?: AbortReason) => void;
  approveWorkflowNode: (payload: WorkflowReviewActionPayload) => void;
  rejectWorkflowNode: (payload: WorkflowReviewActionPayload) => void;
  rerunWorkflowNode: (payload: WorkflowReviewActionPayload) => void;

  onWorkspaceFileChanged: (callback: (payload: WorkspaceFileChangedPayload) => void) => () => void;
  onTerminalDataBatch: (callback: (payload: TerminalDataBatchPayload) => void) => () => void;
  onTerminalError: (callback: (payload: TerminalErrorPayload) => void) => () => void;
  onTerminalExit: (callback: (payload: TerminalExitPayload) => void) => () => void;
  onWorkflowNodeStatus: (callback: (payload: WorkflowNodeStatusPayload) => void) => () => void;
  onWorkflowNodeOutput: (callback: (payload: WorkflowNodeOutputPayload) => void) => () => void;
  onWorkflowReviewRequired: (
    callback: (payload: WorkflowReviewRequiredPayload) => void
  ) => () => void;
  onMemoryContextReady: (callback: (payload: MemoryContextReadyPayload) => void) => () => void;
  onWorkflowCompleted: (callback: (payload: WorkflowCompletedPayload) => void) => () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: FluxionAPI;
  }
}
