import {
  AgentConfigApplyPreviewResult,
  AgentConfigExportOptions,
  AgentConfigExportPreview,
  AgentConfigExporterId,
  AgentConfigExporterSummary,
  ProjectContextDraft,
} from '@shared';
import { agentConfigExportRegistry } from './agent-config-export-registry';
import { agentConfigMergeService } from './agent-config-merge.service';

export class AgentConfigPreviewService {
  public listExporters(): AgentConfigExporterSummary[] {
    return agentConfigExportRegistry.listExporters();
  }

  public createPreview(
    workspacePath: string,
    exporterId: AgentConfigExporterId,
    context: ProjectContextDraft,
    options?: AgentConfigExportOptions
  ): Promise<AgentConfigExportPreview> {
    return agentConfigExportRegistry.createPreview(workspacePath, exporterId, context, options);
  }

  public applyPreview(
    preview: AgentConfigExportPreview
  ): Promise<AgentConfigApplyPreviewResult> {
    return agentConfigMergeService.applyPreview(preview);
  }
}

export const agentConfigPreviewService = new AgentConfigPreviewService();
