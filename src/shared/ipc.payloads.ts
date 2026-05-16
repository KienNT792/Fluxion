import { AbortReason } from './agent.types'
import {
  AgentConfigApplyPreviewRequest,
  AgentConfigApplyPreviewResult,
  AgentConfigExporterSummary,
  AgentConfigPreviewRequest,
  AgentConfigExportPreview
} from './agent-config.types'
import {
  ContextEnrichmentRequest,
  ContextEnrichmentResult,
  ContextScanResult,
  ProjectContextOnboarding,
  ProjectContextDraft,
  WorkspaceContextSavedPayload,
  WorkspaceContextStatus
} from './context.types'
import {
  ApplyRepoOnboardingSkillPreviewRequest,
  ApplyRepoOnboardingSkillPreviewResult,
  CreateOnboardingWorkflowRequest,
  CreateOnboardingWorkflowResult,
  GenerateOnboardingPacketRequest,
  OnboardingPacket,
  RepoOnboardingSkillPreview,
  RepoOnboardingSkillPreviewRequest,
  SaveOnboardingPacketRequest,
  SaveOnboardingPacketResult
} from './onboarding.types'
import {
  ExecutionMode,
  NodeId,
  NodeStatus,
  ProviderCapabilitiesMap,
  Workflow,
  WorkflowEdge,
  WorkflowMetadata,
  WorkflowNode
} from './workflow.types'

// ─── Workspace Payloads ──────────────────────────────────────────────────────

export interface WorkspaceOpenedPayload {
  workspacePath: string
  /** Full document of the initially active workflow. */
  workflow: Workflow
  /** Absolute path to the active workflow file on disk. */
  activeWorkflowFilePath: string
  /** ULID of the active workflow. */
  activeWorkflowId: string
  /** List of all detected workflows (metadata only, no nodes/edges). */
  workflows: WorkflowMetadata[]
  isNewWorkspace: boolean
  /** Current project-context state for this workspace. */
  contextStatus: WorkspaceContextStatus
  /** Parsed project-context draft when available. */
  contextSummary?: ProjectContextDraft | null
  /** True if a legacy `.fluxion/workflow.json` was detected. */
  legacyWorkflowDetected: boolean
  /** Backup path produced by the latest legacy workflow migration, when applicable. */
  legacyWorkflowBackupFilePath?: string
  /** Pending paused review recovered from persisted run state, when present. */
  recoveredReview?: RecoveredReviewPayload
}

export interface RecoveredReviewPayload {
  workflowId: string
  runId: string
  nodeIds: NodeId[]
  nodeOutputPaths: Partial<Record<NodeId, string>>
  nodeAttemptCounts: Partial<Record<NodeId, number>>
  executionMode: ExecutionMode
  updatedAt: string
}

export type WorkspaceLoadingStep = 'init' | 'loadWorkflows' | 'loadContext' | 'watcher' | 'ready'

export interface WorkspaceLoadingEvent {
  workspacePath: string
  step: WorkspaceLoadingStep
  status: 'active' | 'done' | 'error'
  message?: string
}

export interface WorkspaceTrustMigrationPayload {
  workspacePaths: string[]
}

export interface RecentWorkspaceEntry {
  path: string
  name: string
  lastOpenedAt: string
}

export type WorkspaceDirectoryValidationResult =
  | {
      ok: true
      path: string
    }
  | {
      ok: false
      path: string
      message: string
    }

export interface WorkspaceFileChangedPayload {
  filePath: string
  relativePath: string
  changeType: 'add' | 'change' | 'unlink'
}

export interface WorkspaceReadTextFilePayload {
  workspacePath: string
  filePath: string
  maxBytes?: number
}

export interface WorkspaceReadTextFileResult {
  content: string
  truncated: boolean
}

export interface WorkflowSavePayload {
  workspacePath: string
  workflow: Workflow
  activeWorkflowFilePath: string
}

export interface WorkflowSavedPayload {
  workspacePath: string
  workflowFilePath: string
  savedAt: string
}

export type WorkspaceContextScanPayload = ContextScanResult
export type WorkspaceContextEnrichPayload = ContextEnrichmentRequest
export type WorkspaceContextEnrichResult = ContextEnrichmentResult
export type WorkspaceGenerateOnboardingPacketPayload = GenerateOnboardingPacketRequest
export type WorkspaceGenerateOnboardingPacketResult = OnboardingPacket
export type WorkspaceSaveOnboardingPacketPayload = SaveOnboardingPacketRequest
export type WorkspaceSaveOnboardingPacketResult = SaveOnboardingPacketResult
export type WorkspaceCreateOnboardingWorkflowPayload = CreateOnboardingWorkflowRequest
export type WorkspaceCreateOnboardingWorkflowResult = CreateOnboardingWorkflowResult
export type WorkspaceCreateRepoOnboardingSkillPreviewPayload = RepoOnboardingSkillPreviewRequest
export type WorkspaceCreateRepoOnboardingSkillPreviewResult = RepoOnboardingSkillPreview
export type WorkspaceApplyRepoOnboardingSkillPreviewPayload = ApplyRepoOnboardingSkillPreviewRequest
export type WorkspaceApplyRepoOnboardingSkillPreviewResult = ApplyRepoOnboardingSkillPreviewResult
export type WorkspaceContextPayload = ProjectContextDraft | null
export type WorkspaceContextSaveResult = WorkspaceContextSavedPayload

export interface WorkspaceContextOnboardingUpdatePayload {
  workspacePath: string
  patch: ProjectContextOnboarding
}

export type WorkspaceContextOnboardingUpdateResult = WorkspaceContextSavedPayload

export interface LegacyWorkflowMigrationPayload {
  workspacePath: string
}

export type LegacyWorkflowMigrationResult = WorkspaceOpenedPayload

export type AgentConfigListExportersResult = AgentConfigExporterSummary[]
export type AgentConfigCreatePreviewPayload = AgentConfigPreviewRequest
export type AgentConfigCreatePreviewResult = AgentConfigExportPreview
export type AgentConfigApplyPreviewPayload = AgentConfigApplyPreviewRequest
export type AgentConfigApplyPreviewResultPayload = AgentConfigApplyPreviewResult

// ─── Multi-Workflow Payloads ──────────────────────────────────────────────────

export interface WorkflowCreatePayload {
  workspacePath: string
  name: string
  /** Optional specific template to use. If omitted, creates a blank workflow. */
  templateId?: string
}

export interface WorkflowCreateResult {
  /** The newly created workflow document. */
  workflow: Workflow
  /** Absolute path to the newly created file. */
  workflowFilePath: string
}

export interface WorkflowLoadPayload {
  workspacePath: string
  /** ID of the workflow to load. */
  workflowId: string
}

export interface WorkflowDeletePayload {
  workspacePath: string
  /** ID of the workflow to delete. */
  workflowId: string
}

// ─── Workflow Execution Payloads ─────────────────────────────────────────────
export interface WorkflowRunPayload {
  workflowId: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  workspacePath: string
  executionMode?: ExecutionMode
  resumeFromNodeId?: NodeId
}

export interface GetProviderCapabilitiesPayload {
  forceRefresh?: boolean
}

export interface WorkflowAbortPayload {
  /** If provided, abort only this node. If omitted, abort the entire workflow. */
  nodeId?: NodeId
  reason: AbortReason
}

export interface WorkflowReviewActionPayload {
  workflowId: string
  runId: string
  nodeId: NodeId
  comment?: string
}

export interface WorkflowNodeStatusPayload {
  nodeId: NodeId
  status: NodeStatus
  error?: string
  exitCode?: number
}

export interface WorkflowNodeOutputPayload {
  nodeId: NodeId
  status: NodeStatus
  /** Absolute path to the generated .md file in .fluxion/memory/short-term/ */
  outputFilePath?: string
}

export interface WorkflowReviewRequiredPayload {
  workflowId: string
  runId: string
  nodeId: NodeId
  outputFilePath: string
  status: 'awaiting_review'
}

export interface WorkflowCompletedPayload {
  workflowId: string
  success: boolean
  totalTimeMs: number
  aborted?: boolean
  error?: string
}

// Terminal payloads
export interface TerminalDataBatchPayload {
  nodeId: NodeId
  /** Array of lines or raw text chunks. */
  batch: string[]
  /** Distinguishes standard output from error logs. */
  sourceType: 'stdout' | 'stderr'
}

export interface TerminalErrorPayload {
  nodeId: NodeId
  error: string
}

export interface TerminalExitPayload {
  nodeId: NodeId
  code: number | null
}

// Memory payloads
export interface MemoryContextReadyPayload {
  nodeId: NodeId
  /** The compiled memory context used as one input when building the execution prompt. */
  compiledContext: string
}

export type ProviderCapabilitiesPayload = ProviderCapabilitiesMap

export interface ProviderSettingsSummaryPayload {
  openaiApiKeyConfigured: boolean
  openaiApiKeySource: 'stored' | 'env' | 'none'
  openaiApiKeyMasked?: string
  storageMode: 'secure' | 'plain' | 'env' | 'none'
}

export interface UpdateOpenAIApiKeyPayload {
  apiKey: string | null
}
