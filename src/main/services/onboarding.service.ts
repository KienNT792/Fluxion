import { randomUUID } from 'crypto'
import { RunnerContext, RunnerEvent, RunnerResult, WorkflowNodeSchema } from '@core'
import {
  AgentConfigFileOperation,
  CODEX_DEFAULT_MODEL,
  ContextScanResult,
  CreateOnboardingWorkflowRequest,
  CreateOnboardingWorkflowResult,
  GenerateOnboardingPacketRequest,
  OnboardingPacket,
  RepoOnboardingSkillPreview,
  RepoOnboardingSkillPreviewRequest,
  SaveOnboardingPacketRequest,
  SaveOnboardingPacketResult
} from '@shared'
import { CodexCliRunner } from '../runners/codex-cli-runner'
import { scanWorkspaceContext as scanWorkspaceContextService } from './context-scout.service'
import { createWorkspaceSnapshot, WorkspaceSnapshot } from './context/workspace-snapshot'
import {
  applyRepoOnboardingSkillPreview,
  createOnboardingWorkflow,
  createRepoOnboardingSkillPreview,
  formatOnboardingPacketMarkdown,
  saveOnboardingPacket
} from './onboarding/onboarding-artifact-writer'
import { ONBOARDING_CONFIG } from './onboarding/onboarding-config'
import { parseCodexOnboardingOutput } from './onboarding/onboarding-codex-parser'
import { buildEvidencePack } from './onboarding/onboarding-evidence-collector'
import {
  buildCodexOnboardingPrompt,
  buildDeterministicPacket,
  draftFromRequest
} from './onboarding/onboarding-packet-builder'
import {
  consoleOnboardingLogger,
  OnboardingLogger,
  serializeOnboardingError
} from './onboarding/onboarding-logger'
import { normalizeWorkspacePath } from './onboarding/onboarding-paths'
import { cleanString } from './onboarding/onboarding-utils'

interface OnboardingRunner {
  run(ctx: RunnerContext): AsyncGenerator<RunnerEvent, RunnerResult, void>
}

interface OnboardingServiceDependencies {
  runner?: OnboardingRunner
  now?: () => Date
  scanWorkspaceContext?: (workspacePath: string) => Promise<ContextScanResult>
  createSnapshot?: (workspacePath: string) => Promise<WorkspaceSnapshot>
  logger?: OnboardingLogger
}

async function runRunnerToCompletion(
  runner: OnboardingRunner,
  ctx: RunnerContext
): Promise<RunnerResult> {
  const iterator = runner.run(ctx)
  let stderrOutput = ''

  while (true) {
    const next = await iterator.next()
    if (next.done) {
      const result = next.value
      if (!result.success && !result.error && stderrOutput.trim()) {
        return { ...result, error: stderrOutput.trim() }
      }
      return result
    }

    if (next.value.type === 'stderr') {
      stderrOutput += next.value.content
    }
  }
}

export class OnboardingService {
  private readonly runner: OnboardingRunner
  private readonly now: () => Date
  private readonly scanWorkspaceContext: (workspacePath: string) => Promise<ContextScanResult>
  private readonly createSnapshot: (workspacePath: string) => Promise<WorkspaceSnapshot>
  private readonly logger: OnboardingLogger

  public constructor(dependencies: OnboardingServiceDependencies = {}) {
    this.runner = dependencies.runner ?? new CodexCliRunner()
    this.now = dependencies.now ?? (() => new Date())
    this.scanWorkspaceContext = dependencies.scanWorkspaceContext ?? scanWorkspaceContextService
    this.createSnapshot = dependencies.createSnapshot ?? createWorkspaceSnapshot
    this.logger = dependencies.logger ?? consoleOnboardingLogger
  }

  public async generatePacket(request: GenerateOnboardingPacketRequest): Promise<OnboardingPacket> {
    const workspacePath = normalizeWorkspacePath(request.workspacePath)
    const mode = request.mode ?? 'deterministic'

    this.logger.info('generate.start', {
      workspace: workspacePath.split(/[\\/]/).filter(Boolean).pop() ?? 'Workspace',
      mode
    })

    try {
      const scanResult = request.scanResult ?? (await this.scanWorkspaceContext(workspacePath))
      const draft = draftFromRequest(workspacePath, scanResult, request.draft)
      const evidencePack = await buildEvidencePack(
        workspacePath,
        draft,
        scanResult,
        this.createSnapshot,
        this.logger
      )
      const model = cleanString(request.model) || CODEX_DEFAULT_MODEL
      const deterministicPacket = buildDeterministicPacket({
        draft,
        scanResult,
        evidencePack,
        now: this.now(),
        mode: mode === 'codex-assisted' ? 'deterministic' : mode
      })

      if (mode !== 'codex-assisted') {
        this.logger.info('generate.completed', {
          mode,
          filesRead: evidencePack.files.length,
          truncatedFiles: evidencePack.truncatedFiles.length
        })
        return deterministicPacket
      }
      if (evidencePack.files.length === 0) {
        throw new Error('No readable project evidence was found for Codex onboarding.')
      }

      const generatedAt = this.now().toISOString()
      const prompt = buildCodexOnboardingPrompt({
        draft,
        scanResult,
        evidencePack,
        deterministicPacket
      })
      const node = WorkflowNodeSchema.parse({
        id: 'onboarding-packet',
        type: 'agentNode',
        label: 'Fluxion Onboarding Packet',
        position: { x: 0, y: 0 },
        data: {
          provider: 'codex',
          runner: 'codex',
          model,
          prompt,
          reasoningLevel: ONBOARDING_CONFIG.codex.reasoningLevel,
          codex: {
            json: true,
            sandboxMode: ONBOARDING_CONFIG.codex.sandboxMode,
            approvalPolicy: ONBOARDING_CONFIG.codex.approvalPolicy
          }
        }
      })

      this.logger.info('codex.run.start', {
        model,
        filesRead: evidencePack.files.length,
        truncatedFiles: evidencePack.truncatedFiles.length,
        promptLength: prompt.length
      })

      const result = await runRunnerToCompletion(this.runner, {
        runId: `onboarding-packet-${randomUUID()}`,
        workflowId: 'onboarding-packet',
        node,
        prompt,
        workspacePath
      })

      if (!result.success) {
        throw new Error(result.error ?? 'Codex onboarding failed.')
      }
      if (!result.output?.trim()) {
        throw new Error('Codex onboarding completed without a final response.')
      }

      const packet = parseCodexOnboardingOutput(
        result.output,
        deterministicPacket,
        {
          generatedAt,
          mode: 'codex-assisted',
          model,
          filesRead: evidencePack.files.length,
          truncatedFiles: evidencePack.truncatedFiles,
          warnings: []
        },
        this.logger
      )
      this.logger.info('generate.completed', {
        mode,
        filesRead: evidencePack.files.length,
        truncatedFiles: evidencePack.truncatedFiles.length
      })

      return packet
    } catch (error) {
      this.logger.error('generate.failed', {
        mode,
        error: serializeOnboardingError(error)
      })
      throw error
    }
  }

  public async savePacket(
    request: SaveOnboardingPacketRequest
  ): Promise<SaveOnboardingPacketResult> {
    return saveOnboardingPacket(request, this.logger)
  }

  public async createWorkflow(
    request: CreateOnboardingWorkflowRequest
  ): Promise<CreateOnboardingWorkflowResult> {
    return createOnboardingWorkflow(request, this.now(), this.logger)
  }

  public async createRepoSkillPreview(
    request: RepoOnboardingSkillPreviewRequest
  ): Promise<RepoOnboardingSkillPreview> {
    return createRepoOnboardingSkillPreview(request, this.logger)
  }

  public async applyRepoSkillPreview(preview: RepoOnboardingSkillPreview): Promise<{
    applied: AgentConfigFileOperation[]
    skipped: AgentConfigFileOperation[]
  }> {
    return applyRepoOnboardingSkillPreview(preview, this.logger)
  }
}

export const onboardingService = new OnboardingService()

export const onboardingServiceInternals = {
  buildDeterministicPacket,
  buildEvidencePack,
  buildCodexOnboardingPrompt,
  parseCodexOnboardingOutput,
  formatOnboardingPacketMarkdown
}
