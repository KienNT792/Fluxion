import { ElectronAPI } from '@electron-toolkit/preload'
import {
  AbortReason,
  AgentConfigApplyPreviewRequest,
  AgentConfigApplyPreviewResult,
  AgentConfigExporterSummary,
  AgentConfigPreviewRequest,
  AgentConfigExportPreview,
  ContextSaveMode,
  ContextEnrichmentRequest,
  ContextEnrichmentResult,
  ContextScanResult,
  ApplyRepoOnboardingSkillPreviewRequest,
  ApplyRepoOnboardingSkillPreviewResult,
  CreateOnboardingWorkflowRequest,
  CreateOnboardingWorkflowResult,
  GenerateOnboardingPacketRequest,
  ExecutionMode,
  MemoryContextReadyPayload,
  NodeId,
  OnboardingPacket,
  GetProviderCapabilitiesPayload,
  ProviderCapabilitiesPayload,
  ProviderSettingsSummaryPayload,
  ProjectContextDraft,
  RepoOnboardingSkillPreview,
  RepoOnboardingSkillPreviewRequest,
  SaveOnboardingPacketRequest,
  SaveOnboardingPacketResult,
  RecentWorkspaceEntry,
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
  WorkspaceReadTextFilePayload,
  WorkspaceReadTextFileResult,
  WorkflowSavedPayload,
  WorkspaceContextOnboardingUpdatePayload,
  WorkspaceContextSavedPayload,
  WorkspaceDirectoryValidationResult,
  WorkspaceFileChangedPayload,
  WorkspaceLoadingEvent,
  WorkspaceOpenedPayload,
  WorkflowCreateResult
} from '@shared'

export interface FluxionAPI {
  openWorkspaceDialog: () => Promise<string | null>
  loadWorkspace: (workspacePath: string) => Promise<WorkspaceOpenedPayload>
  isWorkspaceTrusted: (workspacePath: string) => Promise<boolean>
  trustWorkspace: (workspacePath: string) => Promise<void>
  migrateRendererTrustedWorkspaceCache: (workspacePaths: string[]) => Promise<void>
  listRecentWorkspaces: () => Promise<RecentWorkspaceEntry[]>
  removeRecentWorkspace: (workspacePath: string) => Promise<RecentWorkspaceEntry[]>
  getPathForFile: (file: File) => string
  validateWorkspaceDirectory: (pathValue: string) => Promise<WorkspaceDirectoryValidationResult>
  saveWorkflow: (
    workspacePath: string,
    workflow: Workflow,
    activeWorkflowFilePath: string
  ) => Promise<WorkflowSavedPayload>
  readWorkspaceTextFile: (
    payload: WorkspaceReadTextFilePayload
  ) => Promise<WorkspaceReadTextFileResult>
  scanWorkspaceContext: (workspacePath: string) => Promise<ContextScanResult>
  enrichProjectContext: (payload: ContextEnrichmentRequest) => Promise<ContextEnrichmentResult>
  generateOnboardingPacket: (payload: GenerateOnboardingPacketRequest) => Promise<OnboardingPacket>
  saveOnboardingPacket: (
    payload: SaveOnboardingPacketRequest
  ) => Promise<SaveOnboardingPacketResult>
  createOnboardingWorkflow: (
    payload: CreateOnboardingWorkflowRequest
  ) => Promise<CreateOnboardingWorkflowResult>
  createRepoOnboardingSkillPreview: (
    payload: RepoOnboardingSkillPreviewRequest
  ) => Promise<RepoOnboardingSkillPreview>
  applyRepoOnboardingSkillPreview: (
    payload: ApplyRepoOnboardingSkillPreviewRequest
  ) => Promise<ApplyRepoOnboardingSkillPreviewResult>
  getContext: (workspacePath: string) => Promise<ProjectContextDraft | null>
  saveProjectContext: (
    workspacePath: string,
    draft: ProjectContextDraft,
    mode?: ContextSaveMode
  ) => Promise<WorkspaceContextSavedPayload>
  updateContextOnboarding: (
    workspacePath: string,
    patch: WorkspaceContextOnboardingUpdatePayload['patch']
  ) => Promise<WorkspaceContextSavedPayload>
  migrateLegacyWorkflow: (workspacePath: string) => Promise<WorkspaceOpenedPayload>
  listAgentConfigExporters: () => Promise<AgentConfigExporterSummary[]>
  createAgentConfigPreview: (
    payload: AgentConfigPreviewRequest
  ) => Promise<AgentConfigExportPreview>
  applyAgentConfigPreview: (
    payload: AgentConfigApplyPreviewRequest
  ) => Promise<AgentConfigApplyPreviewResult>
  getProviderCapabilities: (
    payload?: GetProviderCapabilitiesPayload
  ) => Promise<ProviderCapabilitiesPayload>
  getProviderSettingsSummary: () => Promise<ProviderSettingsSummaryPayload>
  setOpenAIApiKey: (apiKey: string | null) => Promise<ProviderSettingsSummaryPayload>
  openPath: (path: string) => Promise<void>
  revealPath: (path: string) => Promise<void>

  // ─── Multi-Workflow ────────────────────────────────────────────────────────
  createWorkflow: (workspacePath: string, name: string) => Promise<WorkflowCreateResult>
  loadWorkflow: (workspacePath: string, workflowId: string) => Promise<Workflow>
  deleteWorkflow: (workspacePath: string, workflowId: string) => Promise<void>
  runWorkflow: (
    workflowId: string,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    workspacePath: string,
    executionMode: ExecutionMode,
    resumeFromNodeId?: NodeId
  ) => void
  abortWorkflow: (nodeId?: NodeId, reason?: AbortReason) => Promise<void>
  approveWorkflowNode: (payload: WorkflowReviewActionPayload) => Promise<void>
  rejectWorkflowNode: (payload: WorkflowReviewActionPayload) => Promise<void>
  rerunWorkflowNode: (payload: WorkflowReviewActionPayload) => Promise<void>

  onWorkspaceFileChanged: (callback: (payload: WorkspaceFileChangedPayload) => void) => () => void
  onWorkspaceLoading: (callback: (payload: WorkspaceLoadingEvent) => void) => () => void
  onTerminalDataBatch: (callback: (payload: TerminalDataBatchPayload) => void) => () => void
  onTerminalError: (callback: (payload: TerminalErrorPayload) => void) => () => void
  onTerminalExit: (callback: (payload: TerminalExitPayload) => void) => () => void
  onWorkflowNodeStatus: (callback: (payload: WorkflowNodeStatusPayload) => void) => () => void
  onWorkflowNodeOutput: (callback: (payload: WorkflowNodeOutputPayload) => void) => () => void
  onWorkflowReviewRequired: (
    callback: (payload: WorkflowReviewRequiredPayload) => void
  ) => () => void
  onMemoryContextReady: (callback: (payload: MemoryContextReadyPayload) => void) => () => void
  onWorkflowCompleted: (callback: (payload: WorkflowCompletedPayload) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: FluxionAPI
  }
}
