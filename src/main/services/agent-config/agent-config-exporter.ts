import {
  AgentConfigExportOptions,
  AgentConfigExportPreview,
  AgentConfigExporterId,
  AgentConfigExporterStatus,
  AgentConfigExporterSummary,
  ProjectContextDraft
} from '@shared'

export interface AgentConfigExporter {
  id: AgentConfigExporterId
  label: string
  status: AgentConfigExporterStatus
  description: string
  createPreview(
    workspacePath: string,
    context: ProjectContextDraft,
    options?: AgentConfigExportOptions
  ): Promise<AgentConfigExportPreview>
}

export function summarizeAgentConfigExporter(
  exporter: AgentConfigExporter
): AgentConfigExporterSummary {
  return {
    id: exporter.id,
    label: exporter.label,
    status: exporter.status,
    description: exporter.description
  }
}
