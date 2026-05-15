import * as path from 'path'
import {
  AgentConfigExportOptions,
  AgentConfigExportPreview,
  AgentConfigFileOperation,
  ProjectContextDraft
} from '@shared'
import { AgentConfigExporter } from './agent-config-exporter'
import {
  mergeMarkedSection,
  readExistingFile,
  wrapMarkdownFluxionSection,
  wrapTomlFluxionSection
} from './agent-config-merge.service'
import { renderCodexInstructions } from './codex-instruction-renderer'

function createOperation(
  workspacePath: string,
  relativePath: string,
  description: string,
  content: string,
  existingContent: string | null,
  markerType: 'markdown' | 'toml'
): AgentConfigFileOperation {
  const absolutePath = path.join(workspacePath, relativePath)

  if (existingContent === null) {
    return {
      action: 'create',
      relativePath,
      absolutePath,
      description,
      content
    }
  }

  const merged = mergeMarkedSection(existingContent, content, markerType)
  return {
    action: merged.action,
    relativePath,
    absolutePath,
    description,
    content: merged.content,
    existingContent
  }
}

function renderCodexConfig(options: AgentConfigExportOptions | undefined): string {
  const projectDocMaxBytes = options?.projectDocMaxBytes ?? 65536
  const sandboxMode = options?.sandboxMode ?? 'workspace-write'
  const approvalPolicy = options?.approvalPolicy ?? 'on-request'

  return [
    `project_doc_fallback_filenames = ["CLAUDE.md", "GEMINI.md", ".cursorrules"]`,
    `project_doc_max_bytes = ${projectDocMaxBytes}`,
    `sandbox_mode = "${sandboxMode}"`,
    `approval_policy = "${approvalPolicy}"`,
    ''
  ].join('\n')
}

export class CodexConfigExporter implements AgentConfigExporter {
  public readonly id = 'codex' as const
  public readonly label = 'Codex'
  public readonly status = 'ready' as const
  public readonly description =
    'Export Fluxion project context to AGENTS.md and optional .codex/config.toml.'

  public async createPreview(
    workspacePath: string,
    context: ProjectContextDraft,
    options?: AgentConfigExportOptions
  ): Promise<AgentConfigExportPreview> {
    const resolvedWorkspacePath = path.resolve(workspacePath)
    const operations: AgentConfigFileOperation[] = []
    const warnings: string[] = []
    const agentInstructions = wrapMarkdownFluxionSection(renderCodexInstructions(context))
    const agentsPath = path.join(resolvedWorkspacePath, 'AGENTS.md')
    const existingAgents = await readExistingFile(agentsPath)

    operations.push(
      createOperation(
        resolvedWorkspacePath,
        'AGENTS.md',
        'Codex project instructions generated from Fluxion context.',
        agentInstructions,
        existingAgents,
        'markdown'
      )
    )

    if (options?.includeAdvancedConfig) {
      const codexConfig = wrapTomlFluxionSection(renderCodexConfig(options))
      const configPath = path.join(resolvedWorkspacePath, '.codex', 'config.toml')
      const existingConfig = await readExistingFile(configPath)

      operations.push(
        createOperation(
          resolvedWorkspacePath,
          path.join('.codex', 'config.toml'),
          'Project-scoped Codex runtime configuration.',
          codexConfig,
          existingConfig,
          'toml'
        )
      )

      if (context.workspaceTrust !== 'trusted') {
        warnings.push(
          'Codex loads project-scoped .codex/config.toml only for trusted projects; mark the workspace trusted in Codex before relying on this config.'
        )
      }
    }

    if (context.contextStatus !== 'ready') {
      warnings.push(
        'The Fluxion project context is not ready yet; exported instructions may be incomplete.'
      )
    }

    return {
      exporterId: this.id,
      label: this.label,
      workspacePath: resolvedWorkspacePath,
      createdAt: new Date().toISOString(),
      operations,
      warnings
    }
  }
}
