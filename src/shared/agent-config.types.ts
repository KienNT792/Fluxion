import { ProjectContextDraft } from './context.types'
import { CodexApprovalPolicy, CodexApprovalReviewer, CodexSandboxMode } from './workflow.types'

export type AgentConfigExporterId = 'codex' | 'claude' | 'gemini'

export type AgentConfigExporterStatus = 'ready' | 'previewOnly' | 'notImplemented'

export type AgentConfigFileAction = 'create' | 'update' | 'appendSection' | 'skip' | 'conflict'

export interface AgentConfigExporterSummary {
  id: AgentConfigExporterId
  label: string
  status: AgentConfigExporterStatus
  description: string
}

export interface AgentConfigExportOptions {
  includeAdvancedConfig?: boolean
  sandboxMode?: CodexSandboxMode
  approvalPolicy?: CodexApprovalPolicy
  approvalsReviewer?: CodexApprovalReviewer
  reviewModel?: string
  projectDocMaxBytes?: number
}

export interface AgentConfigFileOperation {
  action: AgentConfigFileAction
  relativePath: string
  absolutePath: string
  description: string
  content: string
  existingContent?: string
}

export interface AgentConfigExportPreview {
  exporterId: AgentConfigExporterId
  label: string
  workspacePath: string
  createdAt: string
  operations: AgentConfigFileOperation[]
  warnings: string[]
}

export interface AgentConfigPreviewRequest {
  workspacePath: string
  exporterId: AgentConfigExporterId
  context: ProjectContextDraft
  options?: AgentConfigExportOptions
}

export interface AgentConfigApplyPreviewRequest {
  preview: AgentConfigExportPreview
}

export interface AgentConfigApplyPreviewResult {
  applied: AgentConfigFileOperation[]
  skipped: AgentConfigFileOperation[]
}
