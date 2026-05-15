import { ProjectContextDraft } from './context.types'

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
  sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access'
  approvalPolicy?: 'untrusted' | 'on-request' | 'never'
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
