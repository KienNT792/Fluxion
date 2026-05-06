import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import {
  AbortReason,
  ExecutionMode,
  IpcChannels,
  MemoryContextReadyPayload,
  NodeId,
  GetProviderCapabilitiesPayload,
  ProviderCapabilitiesPayload,
  ProviderSettingsSummaryPayload,
  TerminalDataBatchPayload,
  TerminalErrorPayload,
  TerminalExitPayload,
  UpdateOpenAIApiKeyPayload,
  Workflow,
  WorkflowReviewActionPayload,
  WorkflowReviewRequiredPayload,
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

type Unsubscribe = () => void;

function bindListener<TPayload>(
  channel: string,
  callback: (payload: TPayload) => void
): Unsubscribe {
  const handler = (_event: Electron.IpcRendererEvent, payload: TPayload): void =>
    callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api = {
  openWorkspaceDialog: (): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.WORKSPACE_OPEN_DIALOG) as Promise<string | null>,
  loadWorkspace: (workspacePath: string): Promise<WorkspaceOpenedPayload> =>
    ipcRenderer.invoke(IpcChannels.WORKSPACE_LOAD, workspacePath) as Promise<WorkspaceOpenedPayload>,
  saveWorkflow: (
    workspacePath: string,
    workflow: Workflow,
    activeWorkflowFilePath: string
  ): Promise<WorkflowSavedPayload> =>
    ipcRenderer.invoke(IpcChannels.WORKSPACE_SAVE, { workspacePath, workflow, activeWorkflowFilePath }) as Promise<WorkflowSavedPayload>,
  
  createWorkflow: (workspacePath: string, name: string): Promise<WorkflowCreateResult> =>
    ipcRenderer.invoke(IpcChannels.WORKSPACE_WORKFLOW_CREATE, { workspacePath, name }) as Promise<WorkflowCreateResult>,
  loadWorkflow: (workspacePath: string, workflowId: string): Promise<Workflow> =>
    ipcRenderer.invoke(IpcChannels.WORKSPACE_WORKFLOW_LOAD, { workspacePath, workflowId }) as Promise<Workflow>,
  deleteWorkflow: (workspacePath: string, workflowId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.WORKSPACE_WORKFLOW_DELETE, { workspacePath, workflowId }) as Promise<void>,
  saveContext: (
    workspacePath: string,
    context: Record<string, string>
  ): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.WORKSPACE_SAVE_CONTEXT, { workspacePath, context }) as Promise<void>,
  getProviderCapabilities: (
    payload?: GetProviderCapabilitiesPayload
  ): Promise<ProviderCapabilitiesPayload> =>
    ipcRenderer.invoke(
      IpcChannels.PROVIDERS_GET_CAPABILITIES,
      payload
    ) as Promise<ProviderCapabilitiesPayload>,
  getProviderSettingsSummary: (): Promise<ProviderSettingsSummaryPayload> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_GET_PROVIDER_SUMMARY) as Promise<ProviderSettingsSummaryPayload>,
  setOpenAIApiKey: (apiKey: string | null): Promise<ProviderSettingsSummaryPayload> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SET_OPENAI_API_KEY, {
      apiKey,
    } satisfies UpdateOpenAIApiKeyPayload) as Promise<ProviderSettingsSummaryPayload>,
  openPath: (path: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SHELL_OPEN_PATH, path) as Promise<void>,
  revealPath: (path: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SHELL_REVEAL_PATH, path) as Promise<void>,
  runWorkflow: (
    workflowId: string,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    workspacePath: string,
    executionMode: ExecutionMode,
    resumeFromNodeId?: NodeId
  ): void => {
    ipcRenderer.send(IpcChannels.WORKFLOW_RUN, {
      workflowId,
      nodes,
      edges,
      workspacePath,
      executionMode,
      resumeFromNodeId,
    });
  },
  abortWorkflow: (nodeId?: NodeId, reason: AbortReason = AbortReason.USER_REQUESTED): void => {
    ipcRenderer.send(IpcChannels.WORKFLOW_ABORT, { nodeId, reason });
  },
  approveWorkflowNode: (payload: WorkflowReviewActionPayload): void => {
    ipcRenderer.send(IpcChannels.WORKFLOW_REVIEW_APPROVE, payload);
  },
  rejectWorkflowNode: (payload: WorkflowReviewActionPayload): void => {
    ipcRenderer.send(IpcChannels.WORKFLOW_REVIEW_REJECT, payload);
  },
  rerunWorkflowNode: (payload: WorkflowReviewActionPayload): void => {
    ipcRenderer.send(IpcChannels.WORKFLOW_REVIEW_RERUN, payload);
  },

  onWorkspaceFileChanged: (callback: (payload: WorkspaceFileChangedPayload) => void) =>
    bindListener(IpcChannels.WORKSPACE_FILE_CHANGED, callback),
  onTerminalDataBatch: (callback: (payload: TerminalDataBatchPayload) => void) =>
    bindListener(IpcChannels.TERMINAL_DATA_BATCH, callback),
  onTerminalError: (callback: (payload: TerminalErrorPayload) => void) =>
    bindListener(IpcChannels.TERMINAL_ERROR, callback),
  onTerminalExit: (callback: (payload: TerminalExitPayload) => void) =>
    bindListener(IpcChannels.TERMINAL_EXIT, callback),
  onWorkflowNodeStatus: (callback: (payload: WorkflowNodeStatusPayload) => void) =>
    bindListener(IpcChannels.WORKFLOW_NODE_STATUS, callback),
  onWorkflowNodeOutput: (callback: (payload: WorkflowNodeOutputPayload) => void) =>
    bindListener(IpcChannels.WORKFLOW_NODE_OUTPUT, callback),
  onWorkflowReviewRequired: (callback: (payload: WorkflowReviewRequiredPayload) => void) =>
    bindListener(IpcChannels.WORKFLOW_REVIEW_REQUIRED, callback),
  onMemoryContextReady: (callback: (payload: MemoryContextReadyPayload) => void) =>
    bindListener(IpcChannels.MEMORY_CONTEXT_READY, callback),
  onWorkflowCompleted: (callback: (payload: WorkflowCompletedPayload) => void) =>
    bindListener(IpcChannels.WORKFLOW_COMPLETED, callback),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
