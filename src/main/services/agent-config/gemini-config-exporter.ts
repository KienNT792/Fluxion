import * as path from 'path'
import { AgentConfigExportOptions, AgentConfigExportPreview, ProjectContextDraft } from '@shared'
import { AgentConfigExporter } from './agent-config-exporter'

export class GeminiConfigExporter implements AgentConfigExporter {
  public readonly id = 'gemini' as const
  public readonly label = 'Gemini CLI'
  public readonly status = 'notImplemented' as const
  public readonly description = 'Scaffolded exporter for GEMINI.md and .gemini settings.'

  public async createPreview(
    workspacePath: string,
    context: ProjectContextDraft,
    options?: AgentConfigExportOptions
  ): Promise<AgentConfigExportPreview> {
    void context
    void options

    return {
      exporterId: this.id,
      label: this.label,
      workspacePath: path.resolve(workspacePath),
      createdAt: new Date().toISOString(),
      operations: [],
      warnings: ['Gemini CLI export is scaffolded but not implemented in this phase.']
    }
  }
}
