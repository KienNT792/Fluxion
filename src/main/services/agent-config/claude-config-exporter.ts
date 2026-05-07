import * as path from 'path';
import {
  AgentConfigExportOptions,
  AgentConfigExportPreview,
  ProjectContextDraft,
} from '@shared';
import { AgentConfigExporter } from './agent-config-exporter';

export class ClaudeConfigExporter implements AgentConfigExporter {
  public readonly id = 'claude' as const;
  public readonly label = 'Claude Code';
  public readonly status = 'notImplemented' as const;
  public readonly description = 'Scaffolded exporter for CLAUDE.md and .claude settings.';

  public async createPreview(
    workspacePath: string,
    context: ProjectContextDraft,
    options?: AgentConfigExportOptions
  ): Promise<AgentConfigExportPreview> {
    void context;
    void options;

    return {
      exporterId: this.id,
      label: this.label,
      workspacePath: path.resolve(workspacePath),
      createdAt: new Date().toISOString(),
      operations: [],
      warnings: ['Claude Code export is scaffolded but not implemented in this phase.'],
    };
  }
}
