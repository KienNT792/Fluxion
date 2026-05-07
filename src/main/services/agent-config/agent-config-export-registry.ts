import {
  AgentConfigExportOptions,
  AgentConfigExportPreview,
  AgentConfigExporterId,
  AgentConfigExporterSummary,
  ProjectContextDraft,
} from '@shared';
import {
  AgentConfigExporter,
  summarizeAgentConfigExporter,
} from './agent-config-exporter';
import { ClaudeConfigExporter } from './claude-config-exporter';
import { CodexConfigExporter } from './codex-config-exporter';
import { GeminiConfigExporter } from './gemini-config-exporter';

export class AgentConfigExportRegistry {
  private readonly exporters = new Map<AgentConfigExporterId, AgentConfigExporter>();

  public constructor(exporters: AgentConfigExporter[] = [
    new CodexConfigExporter(),
    new ClaudeConfigExporter(),
    new GeminiConfigExporter(),
  ]) {
    for (const exporter of exporters) {
      this.exporters.set(exporter.id, exporter);
    }
  }

  public listExporters(): AgentConfigExporterSummary[] {
    return [...this.exporters.values()].map(summarizeAgentConfigExporter);
  }

  public async createPreview(
    workspacePath: string,
    exporterId: AgentConfigExporterId,
    context: ProjectContextDraft,
    options?: AgentConfigExportOptions
  ): Promise<AgentConfigExportPreview> {
    const exporter = this.exporters.get(exporterId);
    if (!exporter) {
      throw new Error(`Unsupported agent config exporter: ${exporterId}`);
    }

    return exporter.createPreview(workspacePath, context, options);
  }
}

export const agentConfigExportRegistry = new AgentConfigExportRegistry();
