import { ChildProcess, execFile, spawn, SpawnOptions } from 'child_process'
import {
  CODEX_DEFAULT_MODEL,
  CODEX_DEFAULT_REASONING_LEVEL,
  CODEX_REASONING_LEVELS,
  CodexApprovalPolicy,
  CodexApprovalProtocolProbeResult,
  CodexReasoningSummary,
  CodexResolvedMcpServer,
  CodexResolvedMcpToolPolicy,
  CodexVerbosity,
  OPENAI_DEFAULT_MODEL,
  OPENAI_DEFAULT_REASONING_LEVEL,
  OPENAI_MVP_MODELS,
  ProviderCapabilities,
  ProviderCapabilitiesMap,
  ProviderModel,
  ProviderParameterSpec,
  ProviderReadinessState,
  ResolvedCodexConfig,
  ReasoningLevel
} from '@shared'
import { settingsService } from './settings.service'
import {
  CODEX_CLI_NOT_FOUND_MESSAGE,
  ResolvedCodexCli,
  resolveCodexCliCandidates
} from '../runners/codex-cli-resolver'
import { workspaceTrustService } from './workspace-trust.service'
import { access, readFile } from 'fs/promises'
import { isAbsolute, join, resolve } from 'path'

const OPENAI_MODELS_TIMEOUT_MS = 10_000
const CODEX_MODELS_TIMEOUT_MS = 10_000
const EXEC_FILE_MAX_BUFFER = 1024 * 1024
const MCP_HTTP_PROBE_TIMEOUT_MS = 2_500
const MCP_STDIO_PROBE_TIMEOUT_MS = 2_500

function createUnknownCodexApprovalProtocol(): CodexApprovalProtocolProbeResult {
  return {
    status: 'unknown',
    message:
      'Codex approval protocol probe has not been run. Fluxion keeps on-request and untrusted approval policies blocked until support is verified.'
  }
}

function withCodexApprovalProtocol(capabilities: ProviderCapabilities): ProviderCapabilities {
  return {
    ...capabilities,
    approvalProtocol: capabilities.approvalProtocol ?? createUnknownCodexApprovalProtocol()
  }
}

const OPENAI_PARAMETERS: ProviderParameterSpec[] = [
  {
    id: 'reasoningLevel',
    label: 'Reasoning Effort',
    type: 'select',
    defaultValue: OPENAI_DEFAULT_REASONING_LEVEL,
    appliesTo: 'reasoning-models',
    options: CODEX_REASONING_LEVELS.map((level) => ({
      value: level,
      label: level
    }))
  },
  {
    id: 'temperature',
    label: 'Temperature',
    type: 'number',
    defaultValue: 0.7,
    min: 0,
    max: 2,
    step: 0.1,
    appliesTo: 'standard-models'
  },
  {
    id: 'maxTokens',
    label: 'Max Tokens',
    type: 'number',
    defaultValue: 2048,
    min: 1,
    step: 1,
    appliesTo: 'all'
  }
]

const CODEX_PARAMETERS: ProviderParameterSpec[] = [
  {
    id: 'reasoningLevel',
    label: 'Reasoning Effort',
    type: 'select',
    defaultValue: CODEX_DEFAULT_REASONING_LEVEL,
    appliesTo: 'reasoning-models',
    options: CODEX_REASONING_LEVELS.map((level) => ({
      value: level,
      label: level
    }))
  }
]

interface OpenAIModelListResponse {
  data?: Array<{
    id?: unknown
  }>
}

interface CodexDebugReasoningLevel {
  effort?: unknown
}

export interface CodexDebugModel {
  slug?: unknown
  display_name?: unknown
  description?: unknown
  visibility?: unknown
  supported_in_api?: unknown
  default_reasoning_level?: unknown
  supported_reasoning_levels?: unknown
}

interface CodexDebugModelsResponse {
  models?: CodexDebugModel[]
}

interface ExecFileResult {
  stdout: string
  stderr: string
}

interface ExecFileErrorWithOutput extends Error {
  code?: string
  stdout?: string
  stderr?: string
}

interface CodexCapabilitiesDependencies {
  resolveCli?: () => Promise<ResolvedCodexCli[]>
  runCommand?: (command: string, args: string[]) => Promise<ExecFileResult>
  workspacePath?: string
}

interface CodexCommandAttemptResult {
  result?: ExecFileResult
  error?: unknown
  attempts: CodexCommandAttempt[]
}

interface CodexCommandAttempt {
  candidate: ResolvedCodexCli
  error?: unknown
  result?: ExecFileResult
}

interface CodexDiscoveryContext {
  cliCandidates: ResolvedCodexCli[]
  preferredCandidate?: ResolvedCodexCli
  runCommand: (command: string, args: string[]) => Promise<ExecFileResult>
}

function normalizeResolvedCliCandidates(
  candidateOrCandidates: ResolvedCodexCli | ResolvedCodexCli[]
): ResolvedCodexCli[] {
  return Array.isArray(candidateOrCandidates) ? candidateOrCandidates : [candidateOrCandidates]
}

function createExecFileRunner(
  timeoutMs = CODEX_MODELS_TIMEOUT_MS
): (command: string, args: string[]) => Promise<ExecFileResult> {
  return (command, args) =>
    new Promise((resolve, reject) => {
      execFile(
        command,
        args,
        {
          encoding: 'utf8',
          windowsHide: true,
          timeout: timeoutMs,
          maxBuffer: EXEC_FILE_MAX_BUFFER
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(Object.assign(error, { stdout, stderr }))
            return
          }

          resolve({ stdout, stderr })
        }
      )
    })
}

function getErrorOutput(error: unknown): { stdout: string; stderr: string } {
  if (typeof error !== 'object' || error === null) {
    return { stdout: '', stderr: '' }
  }

  const maybeError = error as ExecFileErrorWithOutput
  return {
    stdout: typeof maybeError.stdout === 'string' ? maybeError.stdout : '',
    stderr: typeof maybeError.stderr === 'string' ? maybeError.stderr : ''
  }
}

function getErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as ExecFileErrorWithOutput).code)
    : undefined
}

function shouldTryNextCandidate(error: unknown): boolean {
  const code = getErrorCode(error)
  return code === 'EPERM' || code === 'EACCES' || code === 'EINVAL' || code === 'ENOENT'
}

function isWindowsAppsAliasCandidate(candidate: ResolvedCodexCli): boolean {
  const commandLine = [candidate.command, ...candidate.argsPrefix]
    .join(' ')
    .replace(/\//g, '\\')
    .toLowerCase()

  return commandLine.includes('\\windowsapps\\')
}

function isWindowsAppsAliasPermissionError(error: unknown): boolean {
  const code = getErrorCode(error)
  if (code === 'EPERM' || code === 'EACCES' || code === 'EINVAL') {
    return true
  }

  const message = error instanceof Error ? error.message : ''
  return /(operation not permitted|permission denied|access is denied|invalid argument)/i.test(
    message
  )
}

function hasWindowsAppsAliasBlock(attemptResult: CodexCommandAttemptResult): boolean {
  const failedAttempts = attemptResult.attempts.filter((attempt) => attempt.error)
  if (failedAttempts.length === 0) {
    return false
  }

  return (
    failedAttempts.every((attempt) => shouldTryNextCandidate(attempt.error)) &&
    failedAttempts.some(
      (attempt) =>
        attempt.error &&
        isWindowsAppsAliasCandidate(attempt.candidate) &&
        isWindowsAppsAliasPermissionError(attempt.error)
    )
  )
}

function getCliCandidateKey(candidate: ResolvedCodexCli): string {
  return [candidate.command, ...candidate.argsPrefix].join('\u0000')
}

function getPrioritizedCliCandidates(context: CodexDiscoveryContext): ResolvedCodexCli[] {
  if (!context.preferredCandidate) {
    return context.cliCandidates
  }

  const preferredKey = getCliCandidateKey(context.preferredCandidate)
  return [
    context.preferredCandidate,
    ...context.cliCandidates.filter((candidate) => getCliCandidateKey(candidate) !== preferredKey)
  ]
}

function buildCodexReadiness(
  code: ProviderReadinessState['code'],
  overrides: Partial<Omit<ProviderReadinessState, 'code'>> = {}
): ProviderReadinessState {
  const defaults: Record<ProviderReadinessState['code'], ProviderReadinessState> = {
    ready: {
      code: 'ready',
      blocking: false,
      title: 'Codex CLI ready.',
      message: 'Fluxion can run workflows through the local Codex CLI.',
      catalogSource: 'live'
    },
    cli_missing: {
      code: 'cli_missing',
      blocking: true,
      title: 'Codex CLI not found.',
      message:
        'Install @openai/codex in Windows and make sure the codex command is visible to this app.',
      actionCommand: 'npm i -g @openai/codex',
      catalogSource: 'none'
    },
    windowsapps_alias_blocked: {
      code: 'windowsapps_alias_blocked',
      blocking: true,
      title: 'Codex WindowsApps alias is blocking execution.',
      message:
        'Windows resolved codex to an App Execution Alias that Fluxion cannot spawn. Install or update @openai/codex globally, then put that npm command ahead of WindowsApps in PATH or disable the alias.',
      actionCommand: 'npm i -g @openai/codex',
      catalogSource: 'none'
    },
    auth_missing: {
      code: 'auth_missing',
      blocking: true,
      title: 'Codex CLI is not logged in.',
      message: 'Run codex login, then refresh Codex readiness in Fluxion.',
      actionCommand: 'codex login',
      catalogSource: 'none'
    },
    auth_unknown: {
      code: 'auth_unknown',
      blocking: false,
      title: 'Codex auth status could not be confirmed.',
      message:
        'Fluxion will still try to use Codex, but run codex login status if execution fails.',
      actionCommand: 'codex login status',
      catalogSource: 'none'
    },
    catalog_failed: {
      code: 'catalog_failed',
      blocking: false,
      title: 'Codex model catalog could not be loaded.',
      message:
        'Fluxion will preserve custom model slugs, but the model picker cannot show live Codex models.',
      actionCommand: 'codex debug models',
      catalogSource: 'none'
    }
  }

  return {
    ...defaults[code],
    ...overrides,
    code
  }
}

function parseSimpleTomlValue(raw: string): string | number | boolean | string[] | undefined {
  const trimmed = raw.trim()
  if (!trimmed) {
    return undefined
  }

  if (trimmed === 'true') {
    return true
  }
  if (trimmed === 'false') {
    return false
  }
  if (/^-?\d+$/.test(trimmed)) {
    return Number(trimmed)
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1)
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim().replace(/^"|"$/g, ''))
      .filter(Boolean)
  }

  return trimmed
}

async function readProjectCodexConfig(workspacePath?: string): Promise<string | null> {
  if (!workspacePath) {
    return null
  }

  try {
    return await readFile(join(workspacePath, '.codex', 'config.toml'), 'utf8')
  } catch {
    return null
  }
}

function readQuotedConfigValue(rawConfig: string | null, key: string): string | undefined {
  if (!rawConfig) {
    return undefined
  }

  const match = rawConfig.match(new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\\\]/g, '\\$&')}\\s*=\\s*"([^"]+)"`, 'm'))
  return match?.[1]
}

function readBooleanConfigValue(rawConfig: string | null, key: string): boolean | undefined {
  if (!rawConfig) {
    return undefined
  }

  const match = rawConfig.match(new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\\\]/g, '\\$&')}\\s*=\\s*(true|false)\\s*$`, 'mi'))
  if (!match) {
    return undefined
  }

  return match[1].toLowerCase() === 'true'
}

function readNumberConfigValue(rawConfig: string | null, key: string): number | undefined {
  if (!rawConfig) {
    return undefined
  }

  const match = rawConfig.match(new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\\\]/g, '\\$&')}\\s*=\\s*(\\d+)\\s*$`, 'm'))
  if (!match) {
    return undefined
  }

  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : undefined
}

function readStringArrayConfigValue(rawConfig: string | null, key: string): string[] | undefined {
  if (!rawConfig) {
    return undefined
  }

  const match = rawConfig.match(
    new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\\\]/g, '\\$&')}\\s*=\\s*\\[(.*?)\\]\\s*$`, 'ms')
  )
  if (!match) {
    return undefined
  }

  const values = [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]).filter(Boolean)
  return values.length > 0 ? values : undefined
}

function parseResolvedMcpServers(rawConfig: string | null): CodexResolvedMcpServer[] {
  if (!rawConfig) {
    return []
  }

  const lines = rawConfig.split(/\r?\n/)
  const servers = new Map<string, CodexResolvedMcpServer>()
  let currentServerId: string | null = null
  let currentToolName: string | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const toolSectionMatch = trimmed.match(/^\[mcp_servers\.([^.]+)\.tools\.([^\]]+)\]$/)
    if (toolSectionMatch) {
      currentServerId = toolSectionMatch[1]
      currentToolName = toolSectionMatch[2]
      if (!servers.has(currentServerId)) {
        servers.set(currentServerId, {
          id: currentServerId,
          transport: 'unknown',
          enabled: true,
          readiness: 'unknown'
        })
      }
      continue
    }

    const sectionMatch = trimmed.match(/^\[mcp_servers\.([^\]]+)\]$/)
    if (sectionMatch) {
      currentServerId = sectionMatch[1]
      currentToolName = null
      if (!servers.has(currentServerId)) {
        servers.set(currentServerId, {
          id: currentServerId,
          transport: 'unknown',
          enabled: true,
          readiness: 'unknown'
        })
      }
      continue
    }

    if (!currentServerId) {
      continue
    }

    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex < 0) {
      continue
    }

    const key = trimmed.slice(0, equalsIndex).trim()
    const value = parseSimpleTomlValue(trimmed.slice(equalsIndex + 1))
    const server = servers.get(currentServerId)
    if (!server) {
      continue
    }

    if (currentToolName) {
      server.toolPolicies ??= []
      const existingToolPolicy =
        server.toolPolicies.find((tool) => tool.name === currentToolName) ??
        (() => {
          const created = { name: currentToolName } as CodexResolvedMcpToolPolicy
          server.toolPolicies?.push(created)
          return created
        })()

      if (key === 'approval_mode' && typeof value === 'string') {
        existingToolPolicy.approvalMode = value as 'auto' | 'prompt' | 'approve'
      } else if (key === 'enabled' && typeof value === 'boolean') {
        existingToolPolicy.enabled = value
      }

      continue
    }

    if (key === 'command' && typeof value === 'string') {
      server.command = value
      server.transport = 'stdio'
    } else if (key === 'url' && typeof value === 'string') {
      server.url = value
      server.transport = 'http'
    } else if (key === 'enabled' && typeof value === 'boolean') {
      server.enabled = value
      server.readiness = value ? server.readiness : 'disabled'
    } else if (key === 'required' && typeof value === 'boolean') {
      server.required = value
    } else if (key === 'args' && Array.isArray(value)) {
      server.args = value
    } else if (key === 'cwd' && typeof value === 'string') {
      server.cwd = value
    } else if (key === 'env_vars' && Array.isArray(value)) {
      server.envVarNames = value.filter((item): item is string => typeof item === 'string')
    } else if (key === 'enabled_tools' && Array.isArray(value)) {
      server.enabledTools = value
    } else if (key === 'disabled_tools' && Array.isArray(value)) {
      server.disabledTools = value
    } else if (key === 'default_tools_approval_mode' && typeof value === 'string') {
      server.defaultToolsApprovalMode = value as 'auto' | 'prompt' | 'approve'
    } else if (key === 'experimental_environment' && typeof value === 'string') {
      server.environment = value as 'local' | 'remote'
    } else if (key === 'startup_timeout_sec' && typeof value === 'number') {
      server.startupTimeoutSec = value
    } else if (key === 'tool_timeout_sec' && typeof value === 'number') {
      server.toolTimeoutSec = value
    }
  }

  return [...servers.values()].map((server) => {
    if (!server.enabled) {
      return {
        ...server,
        readiness: 'disabled',
        readinessCategory: 'disabled',
        reason: 'Disabled in project config.'
      }
    }

    if (server.transport === 'stdio' && !server.command) {
      return {
        ...server,
        readiness: 'not-ready',
        readinessCategory: 'missing-config',
        reason: 'Enabled MCP stdio server is missing a launcher command.'
      }
    }

    if (server.transport === 'http' && !server.url) {
      return {
        ...server,
        readiness: 'not-ready',
        readinessCategory: 'missing-config',
        reason: 'Enabled MCP HTTP server is missing a URL.'
      }
    }

    if (server.transport === 'stdio' && server.cwd && !isAbsolute(server.cwd)) {
      return {
        ...server,
        readiness: (server.required ? 'not-ready' : 'unknown') as CodexResolvedMcpServer['readiness'],
        readinessCategory: 'invalid-config',
        reason: 'MCP stdio server cwd is relative; Fluxion cannot verify it reliably.'
      }
    }

    if (server.transport === 'http' && server.url && !/^https?:\/\//i.test(server.url)) {
      return {
        ...server,
        readiness: (server.required ? 'not-ready' : 'unknown') as CodexResolvedMcpServer['readiness'],
        readinessCategory: 'invalid-config',
        reason: 'MCP HTTP server URL is not a valid http/https endpoint.'
      }
    }

    if (server.transport === 'unknown') {
      return {
        ...server,
        readiness: server.required ? 'not-ready' : 'unknown',
        readinessCategory: 'missing-config',
        reason: server.required
          ? 'Required MCP server is missing both command and URL configuration.'
          : 'MCP server transport could not be resolved from config.'
      }
    }

    return {
      ...server,
      readiness: 'ready',
      readinessCategory: (
        server.enabledTools?.length ||
        server.disabledTools?.length ||
        server.defaultToolsApprovalMode ||
        (server.toolPolicies?.length ?? 0) > 0
          ? 'policy-constrained'
          : 'ready'
      ) as CodexResolvedMcpServer['readinessCategory'],
      constrainedByPolicy:
        Boolean(server.enabledTools?.length) ||
        Boolean(server.disabledTools?.length) ||
        Boolean(server.defaultToolsApprovalMode) ||
        Boolean(server.toolPolicies?.length),
      reason: undefined
    }
  })
}

function createLayerValue<T>(
  trusted: boolean,
  source: 'project',
  value: T,
  detail?: string
): { source: 'project' | 'ignored-project'; value: T; detail?: string } {
  return trusted
    ? { source, value, detail }
    : {
        source: 'ignored-project',
        value,
        detail:
          detail ??
          'Declared in project .codex/config.toml, but Codex ignores project-scoped config until the workspace is trusted.'
      }
}

function createProjectEffectiveValue<T>(
  trusted: boolean,
  value: T | undefined
): T | undefined {
  return trusted ? value : undefined
}

export function parseResolvedCodexConfig(
  rawConfig: string | null,
  trusted: boolean
): ResolvedCodexConfig | undefined {
  const warnings: string[] = []
  if (!trusted && rawConfig) {
    warnings.push('Project-scoped .codex/config.toml exists but Codex only loads it for trusted projects.')
  }

  const modelMatch = rawConfig?.match(/^\s*model\s*=\s*"([^"]+)"/m)
  const reviewModel = readQuotedConfigValue(rawConfig, 'review_model')
  const sandboxMatch = rawConfig?.match(/^\s*sandbox_mode\s*=\s*"([^"]+)"/m)
  const approvalMatch = rawConfig?.match(/^\s*approval_policy\s*=\s*(.+)$/m)
  const approvalsReviewer = readQuotedConfigValue(rawConfig, 'approvals_reviewer')
  const profile = readQuotedConfigValue(rawConfig, 'profile')
  const serviceTier = readQuotedConfigValue(rawConfig, 'service_tier')
  const modelContextWindow = readNumberConfigValue(rawConfig, 'model_context_window')
  const modelAutoCompactTokenLimit = readNumberConfigValue(
    rawConfig,
    'model_auto_compact_token_limit'
  )
  const compactPrompt = readQuotedConfigValue(rawConfig, 'compact_prompt')
  const memoriesDisableOnExternalContext = readBooleanConfigValue(
    rawConfig,
    'memories.disable_on_external_context'
  )
  const modelVerbosity = readQuotedConfigValue(rawConfig, 'model_verbosity') as
    | CodexVerbosity
    | undefined
  const modelReasoningSummary = readQuotedConfigValue(rawConfig, 'model_reasoning_summary') as
    | CodexReasoningSummary
    | undefined
  const hideAgentReasoning = readBooleanConfigValue(rawConfig, 'hide_agent_reasoning')
  const showRawAgentReasoning = readBooleanConfigValue(rawConfig, 'show_raw_agent_reasoning')
  const writableRoots = readStringArrayConfigValue(rawConfig, 'sandbox_workspace_write.writable_roots')
  const networkAccess = readBooleanConfigValue(rawConfig, 'sandbox_workspace_write.network_access')

  const approvalPolicy: CodexApprovalPolicy =
    approvalMatch && approvalMatch[1].includes('granular')
      ? { kind: 'granular' }
      : ((approvalMatch?.[1]?.trim().replace(/^"|"$/g, '') as CodexApprovalPolicy) ?? 'never')

  if (profile) {
    warnings.push(
      'Project-scoped profile keys are ignored by Codex. Put profile selection in user-level config or launch Codex with an explicit profile.'
    )
  }

  const effectiveModel = createProjectEffectiveValue(trusted, modelMatch?.[1])
  const effectiveReviewModel = createProjectEffectiveValue(trusted, reviewModel)
  const effectiveServiceTier = createProjectEffectiveValue(trusted, serviceTier)
  const effectiveSandboxMode = createProjectEffectiveValue(
    trusted,
    sandboxMatch?.[1] as ResolvedCodexConfig['sandboxMode'] | undefined
  )
  const effectiveApprovalPolicy = trusted ? approvalPolicy : ('never' as CodexApprovalPolicy)
  const effectiveApprovalsReviewer = createProjectEffectiveValue(
    trusted,
    approvalsReviewer as ResolvedCodexConfig['approvalsReviewer']
  )
  const effectiveModelContextWindow = createProjectEffectiveValue(trusted, modelContextWindow)
  const effectiveModelAutoCompactTokenLimit = createProjectEffectiveValue(
    trusted,
    modelAutoCompactTokenLimit
  )
  const effectiveCompactPrompt = createProjectEffectiveValue(trusted, compactPrompt)
  const effectiveMemoriesDisableOnExternalContext = createProjectEffectiveValue(
    trusted,
    memoriesDisableOnExternalContext
  )
  const effectiveModelVerbosity = createProjectEffectiveValue(trusted, modelVerbosity)
  const effectiveModelReasoningSummary = createProjectEffectiveValue(
    trusted,
    modelReasoningSummary
  )
  const effectiveHideAgentReasoning = createProjectEffectiveValue(trusted, hideAgentReasoning)
  const effectiveShowRawAgentReasoning = createProjectEffectiveValue(trusted, showRawAgentReasoning)
  const effectiveWritableRoots = createProjectEffectiveValue(trusted, writableRoots)
  const effectiveNetworkAccess = createProjectEffectiveValue(trusted, networkAccess)
  const effectiveMcpServers = trusted ? parseResolvedMcpServers(rawConfig) : []

  return {
    model: effectiveModel,
    reviewModel: effectiveReviewModel,
    serviceTier: effectiveServiceTier,
    sandboxMode: effectiveSandboxMode ?? 'workspace-write',
    approvalPolicy: effectiveApprovalPolicy,
    approvalsReviewer: effectiveApprovalsReviewer,
    profile,
    trustLevel: trusted ? 'trusted' : 'untrusted',
    writableRoots: effectiveWritableRoots,
    networkAccess: effectiveNetworkAccess,
    modelContextWindow: effectiveModelContextWindow,
    modelAutoCompactTokenLimit: effectiveModelAutoCompactTokenLimit,
    compactPrompt: effectiveCompactPrompt,
    memoriesDisableOnExternalContext: effectiveMemoriesDisableOnExternalContext,
    modelVerbosity: effectiveModelVerbosity,
    modelReasoningSummary: effectiveModelReasoningSummary,
    hideAgentReasoning: effectiveHideAgentReasoning,
    showRawAgentReasoning: effectiveShowRawAgentReasoning,
    mcpServers: effectiveMcpServers,
    layers: {
      model: modelMatch
        ? [createLayerValue(trusted, 'project', modelMatch[1])]
        : undefined,
      reviewModel: reviewModel
        ? [createLayerValue(trusted, 'project', reviewModel)]
        : undefined,
      serviceTier: serviceTier
        ? [createLayerValue(trusted, 'project', serviceTier)]
        : undefined,
      sandboxMode: sandboxMatch
        ? [createLayerValue(trusted, 'project', sandboxMatch[1] as ResolvedCodexConfig['sandboxMode'])]
        : [{ source: 'runtime-default', value: 'workspace-write' }],
      approvalPolicy: approvalMatch
        ? [createLayerValue(trusted, 'project', approvalPolicy)]
        : [{ source: 'runtime-default', value: effectiveApprovalPolicy }],
      approvalsReviewer: approvalsReviewer
        ? [
            createLayerValue(
              trusted,
              'project',
              approvalsReviewer as NonNullable<ResolvedCodexConfig['approvalsReviewer']>
            )
          ]
        : undefined,
      profile: profile
        ? [
            {
              source: 'ignored-project',
              value: profile,
              detail:
                'Project-scoped profile keys are ignored by Codex; keep them in user config or apply them at launch.'
            }
          ]
        : undefined,
      modelContextWindow:
        typeof modelContextWindow === 'number'
          ? [createLayerValue(trusted, 'project', modelContextWindow)]
          : undefined,
      modelAutoCompactTokenLimit:
        typeof modelAutoCompactTokenLimit === 'number'
          ? [createLayerValue(trusted, 'project', modelAutoCompactTokenLimit)]
          : undefined,
      compactPrompt: compactPrompt
        ? [createLayerValue(trusted, 'project', compactPrompt)]
        : undefined,
      memoriesDisableOnExternalContext:
        typeof memoriesDisableOnExternalContext === 'boolean'
          ? [createLayerValue(trusted, 'project', memoriesDisableOnExternalContext)]
          : undefined,
      modelVerbosity: modelVerbosity
        ? [createLayerValue(trusted, 'project', modelVerbosity)]
        : undefined,
      modelReasoningSummary: modelReasoningSummary
        ? [createLayerValue(trusted, 'project', modelReasoningSummary)]
        : undefined,
      hideAgentReasoning:
        typeof hideAgentReasoning === 'boolean'
          ? [createLayerValue(trusted, 'project', hideAgentReasoning)]
          : undefined,
      showRawAgentReasoning:
        typeof showRawAgentReasoning === 'boolean'
          ? [createLayerValue(trusted, 'project', showRawAgentReasoning)]
          : undefined
    },
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

async function buildResolvedCodexConfig(workspacePath?: string): Promise<ResolvedCodexConfig | undefined> {
  if (!workspacePath) {
    return undefined
  }

  const [trusted, rawConfig] = await Promise.all([
    workspaceTrustService.isWorkspaceTrusted(workspacePath),
    readProjectCodexConfig(workspacePath)
  ])

  const resolvedConfig = parseResolvedCodexConfig(rawConfig, trusted)
  if (!resolvedConfig?.mcpServers || !workspacePath) {
    return resolvedConfig
  }

  const validatedServers = await Promise.all(
    resolvedConfig.mcpServers.map(async (server) => {
      if (server.transport !== 'stdio' || !server.cwd || !isAbsolute(server.cwd)) {
        return server
      }

      const resolvedCwd = resolve(server.cwd)
      try {
        await access(resolvedCwd)
        return server
      } catch {
        return {
          ...server,
          readiness: (server.required ? 'not-ready' : 'unknown') as CodexResolvedMcpServer['readiness'],
          readinessCategory: 'invalid-config' as const,
          reason: `MCP stdio server cwd does not exist: ${resolvedCwd}`
        } satisfies CodexResolvedMcpServer
      }
    })
  )

  const probedServers = await Promise.all(
    validatedServers.map(async (server) => probeMcpServerReadiness(server))
  )

  return {
    ...resolvedConfig,
    mcpServers: probedServers
  }
}

export async function probeMcpServerReadiness(
  server: CodexResolvedMcpServer
): Promise<CodexResolvedMcpServer> {
  if (!server.enabled || server.readiness === 'disabled' || server.readiness === 'not-ready') {
    return server
  }

  if (server.transport === 'http' && server.url) {
    return probeHttpMcpServer(server)
  }

  if (server.transport === 'stdio' && server.command) {
    return probeStdioMcpServer(server)
  }

  return server
}

async function probeHttpMcpServer(
  server: CodexResolvedMcpServer
): Promise<CodexResolvedMcpServer> {
  if (!server.url) {
    return server
  }

  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), MCP_HTTP_PROBE_TIMEOUT_MS)

  try {
    let response: Response

    try {
      response = await fetch(server.url, {
        method: 'HEAD',
        signal: controller.signal
      })
    } catch {
      response = await fetch(server.url, {
        method: 'GET',
        signal: controller.signal
      })
    }

    if (response.ok || response.status === 401 || response.status === 403) {
      return {
        ...server,
        readiness: 'ready',
        readinessCategory: response.ok ? server.readinessCategory ?? 'ready' : 'probe-auth',
        reason:
          response.ok
            ? undefined
            : `Endpoint responded with ${response.status}; server appears reachable but may require auth.`
      }
    }

    return {
      ...server,
      readiness: server.required ? 'not-ready' : 'unknown',
      readinessCategory: 'probe-unreachable',
      reason: `Endpoint responded with ${response.status}.`
    }
  } catch (error) {
    return {
      ...server,
      readiness: server.required ? 'not-ready' : 'unknown',
      readinessCategory: 'probe-unreachable',
      reason:
        error instanceof Error
          ? `HTTP probe failed: ${error.message}`
          : 'HTTP probe failed.'
    }
  } finally {
    clearTimeout(timeoutHandle)
  }
}

async function probeStdioMcpServer(
  server: CodexResolvedMcpServer
): Promise<CodexResolvedMcpServer> {
  if (!server.command) {
    return server
  }
  const command = server.command

  return new Promise((resolveProbe) => {
    let settled = false
    const spawnOptions: SpawnOptions = {
      cwd: server.cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    }
    const child: ChildProcess = spawn(command, server.args ?? [], spawnOptions)

    const finish = (result: CodexResolvedMcpServer): void => {
      if (settled) {
        return
      }
      settled = true
      try {
        child.kill()
      } catch {
        // best-effort cleanup
      }
      resolveProbe(result)
    }

    const timer = setTimeout(() => {
      finish({
        ...server,
        readiness: 'ready',
        readinessCategory: server.readinessCategory ?? 'ready',
        reason: 'Process stayed alive through the startup probe window.'
      })
    }, Math.max(250, Math.min(MCP_STDIO_PROBE_TIMEOUT_MS, (server.startupTimeoutSec ?? 2) * 1000)))

    child.once('spawn', () => {
      // Wait for the timer or an early exit/error.
    })

    child.once('error', (error) => {
      clearTimeout(timer)
      finish({
        ...server,
        readiness: server.required ? 'not-ready' : 'unknown',
        readinessCategory: 'probe-spawn-failed',
        reason: `Process spawn failed: ${error.message}`
      })
    })

    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      finish({
        ...server,
        readiness: server.required ? 'not-ready' : 'unknown',
        readinessCategory: 'probe-exit',
        reason:
          code === 0
            ? 'Process exited immediately during startup probe.'
            : `Process exited during startup probe with code ${code ?? 'unknown'}${signal ? `, signal ${signal}` : ''}.`
      })
    })
  })
}

export function isCodexAuthMissingMessage(message: string): boolean {
  return /(codex login|not authenticated|authentication|required login|please log in)/i.test(
    message
  )
}

function toReasoningLevels(input: unknown): ReasoningLevel[] {
  if (!Array.isArray(input)) {
    return []
  }

  const levels = input
    .map((item) => {
      if (typeof item === 'string') {
        return item
      }

      if (typeof item === 'object' && item !== null && 'effort' in item) {
        return String((item as CodexDebugReasoningLevel).effort ?? '')
      }

      return ''
    })
    .filter(
      (value): value is ReasoningLevel =>
        value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh'
    )

  return [...new Set(levels)]
}

export function mapCodexDebugModelToProviderModel(model: CodexDebugModel): ProviderModel | null {
  if (typeof model.slug !== 'string' || model.slug.trim().length === 0) {
    return null
  }

  const supportedReasoningLevels = toReasoningLevels(model.supported_reasoning_levels)
  const defaultReasoningLevel =
    typeof model.default_reasoning_level === 'string' ? model.default_reasoning_level : undefined

  return {
    id: model.slug,
    displayName:
      typeof model.display_name === 'string' && model.display_name.trim().length > 0
        ? model.display_name
        : model.slug,
    description:
      typeof model.description === 'string' && model.description.trim().length > 0
        ? model.description
        : undefined,
    visibility:
      typeof model.visibility === 'string' && model.visibility.trim().length > 0
        ? model.visibility
        : 'list',
    supportedInApi:
      typeof model.supported_in_api === 'boolean' ? model.supported_in_api : undefined,
    supportedReasoningLevels,
    defaultReasoningLevel:
      defaultReasoningLevel &&
      supportedReasoningLevels.includes(defaultReasoningLevel as ReasoningLevel)
        ? defaultReasoningLevel
        : supportedReasoningLevels[0]
  }
}

export function parseCodexDebugModelsOutput(output: string): ProviderModel[] {
  const payload = JSON.parse(output) as CodexDebugModelsResponse
  if (!Array.isArray(payload.models)) {
    throw new Error('Codex model discovery returned an invalid payload.')
  }

  return payload.models
    .map(mapCodexDebugModelToProviderModel)
    .filter((model): model is ProviderModel => model !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export function parseCodexVersionOutput(output: string): string | undefined {
  const match = output.trim().match(/(?:codex(?:-cli)?\s+)?v?(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)/i)
  return match?.[1]
}

function buildStaticOpenAIModels(): ProviderModel[] {
  return OPENAI_MVP_MODELS.map((model) => ({
    id: model.id,
    displayName: model.displayName,
    description: model.description,
    visibility: 'list',
    supportedReasoningLevels: model.supportedReasoningLevels,
    defaultReasoningLevel: model.supportsReasoning ? OPENAI_DEFAULT_REASONING_LEVEL : undefined
  }))
}

async function fetchOpenAIModels(apiKey: string): Promise<ProviderModel[]> {
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), OPENAI_MODELS_TIMEOUT_MS)

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(`OpenAI model list request failed with status ${response.status}.`)
    }

    const payload = (await response.json()) as OpenAIModelListResponse
    if (!Array.isArray(payload.data)) {
      throw new Error('OpenAI model list returned an invalid payload.')
    }

    const staticModels = new Map(buildStaticOpenAIModels().map((model) => [model.id, model]))

    return payload.data
      .map((item) => (typeof item.id === 'string' ? item.id : undefined))
      .filter((id): id is string => Boolean(id))
      .sort((a, b) => a.localeCompare(b))
      .map((id) => ({
        id,
        displayName: staticModels.get(id)?.displayName ?? id,
        description: staticModels.get(id)?.description,
        visibility: staticModels.has(id) ? 'list' : 'dynamic',
        supportedReasoningLevels: staticModels.get(id)?.supportedReasoningLevels ?? [],
        defaultReasoningLevel: staticModels.get(id)?.defaultReasoningLevel
      }))
  } finally {
    clearTimeout(timeoutHandle)
  }
}

async function getOpenAICapabilities(): Promise<ProviderCapabilities> {
  const apiKey = await settingsService.resolveOpenAIApiKey()
  const settingsSummary = await settingsService.getProviderSettingsSummary()
  const fallbackModels = buildStaticOpenAIModels()

  if (!apiKey) {
    return {
      provider: 'openai',
      displayName: 'OpenAI',
      available: true,
      auth: {
        type: 'api-key-env',
        status: 'missing',
        envVar: 'OPENAI_API_KEY',
        message: 'Set the OpenAI API key in Global Settings or via OPENAI_API_KEY.'
      },
      models: fallbackModels,
      defaultModel: OPENAI_DEFAULT_MODEL,
      parameters: OPENAI_PARAMETERS,
      refreshHint:
        'Uses /v1/models when OPENAI_API_KEY is available; otherwise shows fallback presets.'
    }
  }

  try {
    const models = await fetchOpenAIModels(apiKey)

    return {
      provider: 'openai',
      displayName: 'OpenAI',
      available: true,
      auth: {
        type: 'api-key-env',
        status: 'authenticated',
        envVar: settingsSummary.openaiApiKeySource === 'env' ? 'OPENAI_API_KEY' : undefined,
        message:
          settingsSummary.openaiApiKeySource === 'stored'
            ? 'Configured in Fluxion Global Settings.'
            : undefined
      },
      models: models.length > 0 ? models : fallbackModels,
      defaultModel: models.some((model) => model.id === OPENAI_DEFAULT_MODEL)
        ? OPENAI_DEFAULT_MODEL
        : (models[0]?.id ?? OPENAI_DEFAULT_MODEL),
      parameters: OPENAI_PARAMETERS,
      refreshHint: 'Uses OpenAI /v1/models for live model discovery.'
    }
  } catch (error) {
    return {
      provider: 'openai',
      displayName: 'OpenAI',
      available: true,
      auth: {
        type: 'api-key-env',
        status: 'authenticated',
        envVar: settingsSummary.openaiApiKeySource === 'env' ? 'OPENAI_API_KEY' : undefined,
        message:
          settingsSummary.openaiApiKeySource === 'stored'
            ? 'Configured in Fluxion Global Settings, but live model discovery failed.'
            : 'API key exists, but live model discovery failed.'
      },
      error: error instanceof Error ? error.message : 'Failed to fetch OpenAI models.',
      models: fallbackModels,
      defaultModel: OPENAI_DEFAULT_MODEL,
      parameters: OPENAI_PARAMETERS,
      refreshHint: 'Uses OpenAI /v1/models for live model discovery.'
    }
  }
}

async function createCodexDiscoveryContext(
  dependencies: CodexCapabilitiesDependencies = {}
): Promise<CodexDiscoveryContext> {
  const resolveCli = dependencies.resolveCli ?? resolveCodexCliCandidates
  const runCommand = dependencies.runCommand ?? createExecFileRunner()
  const cliCandidates = normalizeResolvedCliCandidates(await resolveCli())

  return {
    cliCandidates,
    runCommand
  }
}

async function runCodexCommandAcrossCandidates(
  context: CodexDiscoveryContext,
  args: string[]
): Promise<CodexCommandAttemptResult> {
  let lastError: unknown
  const attempts: CodexCommandAttempt[] = []

  for (const cliCandidate of getPrioritizedCliCandidates(context)) {
    try {
      const result = await context.runCommand(cliCandidate.command, [
        ...cliCandidate.argsPrefix,
        ...args
      ])
      context.preferredCandidate = cliCandidate
      attempts.push({
        candidate: cliCandidate,
        result
      })

      return {
        result,
        attempts
      }
    } catch (error) {
      lastError = error
      attempts.push({
        candidate: cliCandidate,
        error
      })
      if (!shouldTryNextCandidate(error)) {
        break
      }
    }
  }

  return {
    error: lastError ?? new Error(CODEX_CLI_NOT_FOUND_MESSAGE),
    attempts
  }
}

export async function getCodexCapabilities(
  dependencies: CodexCapabilitiesDependencies = {}
): Promise<ProviderCapabilities> {
  try {
    const resolvedConfig = await buildResolvedCodexConfig(dependencies.workspacePath)
    const discoveryContext = await createCodexDiscoveryContext(dependencies)
    const versionStatus = await runCodexCommandAcrossCandidates(discoveryContext, ['--version'])
    const codexVersion = versionStatus.result
      ? parseCodexVersionOutput(
          `${versionStatus.result.stdout}\n${versionStatus.result.stderr}`.trim()
        )
      : undefined
    const loginStatus = await runCodexCommandAcrossCandidates(discoveryContext, ['login', 'status'])

    let authStatus: ProviderCapabilities['auth']['status'] = 'authenticated'
    let authWarning: string | undefined

    if (loginStatus.error) {
      const { stdout, stderr } = getErrorOutput(loginStatus.error)
      const combinedOutput =
        `${stderr}\n${stdout}`.trim() ||
        (loginStatus.error instanceof Error ? loginStatus.error.message : '')

      if (hasWindowsAppsAliasBlock(loginStatus) && !isCodexAuthMissingMessage(combinedOutput)) {
        const readiness = buildCodexReadiness('windowsapps_alias_blocked')
        return withCodexApprovalProtocol({
          provider: 'codex',
          displayName: 'Codex',
          available: false,
          auth: {
            type: 'cli-login',
            status: 'unknown',
            loginCommand: 'codex login',
            message: readiness.message
          },
          readiness,
          version: codexVersion,
          error: combinedOutput || readiness.message,
          models: [],
          parameters: CODEX_PARAMETERS,
          resolvedConfig,
          refreshHint:
            'Install or update @openai/codex globally, fix PATH or App Execution Alias settings, then refresh Codex readiness.'
        })
      }

      if (isCodexAuthMissingMessage(combinedOutput)) {
        const readiness = buildCodexReadiness('auth_missing')
        return withCodexApprovalProtocol({
          provider: 'codex',
          displayName: 'Codex',
          available: true,
          auth: {
            type: 'cli-login',
            status: 'missing',
            loginCommand: 'codex login',
            message: readiness.message
          },
          readiness,
          version: codexVersion,
          error: combinedOutput || readiness.message,
          models: [],
          parameters: CODEX_PARAMETERS,
          resolvedConfig,
          refreshHint: 'Run `codex login`, then refresh Codex readiness.'
        })
      }

      authStatus = 'unknown'
      authWarning = combinedOutput || 'Codex auth status could not be confirmed.'
    }

    const liveCatalog = await runCodexCommandAcrossCandidates(discoveryContext, ['debug', 'models'])
    let catalogResult = liveCatalog.result
    let catalogSource: ProviderReadinessState['catalogSource'] = 'live'
    let catalogError = liveCatalog.error

    if (!catalogResult) {
      const bundledCatalog = await runCodexCommandAcrossCandidates(discoveryContext, [
        'debug',
        'models',
        '--bundled'
      ])
      catalogResult = bundledCatalog.result
      catalogError = bundledCatalog.error ?? catalogError
      catalogSource = catalogResult ? 'bundled' : 'none'
    }

    if (!catalogResult) {
      const { stdout, stderr } = getErrorOutput(catalogError)
      const combinedOutput = `${stderr}\n${stdout}`.trim()
      const errorMessage =
        combinedOutput ||
        (catalogError instanceof Error ? catalogError.message : 'Codex model discovery failed.')
      const readiness = buildCodexReadiness(
        authStatus === 'unknown' ? 'auth_unknown' : 'catalog_failed',
        {
          message:
            authStatus === 'unknown'
              ? `${authWarning} Catalog discovery also failed: ${errorMessage}`
              : errorMessage,
          catalogSource: 'none'
        }
      )

      return withCodexApprovalProtocol({
        provider: 'codex',
        displayName: 'Codex',
        available: true,
        auth: {
          type: 'cli-login',
          status: authStatus,
          loginCommand: 'codex login',
          message: authWarning
        },
        readiness,
        version: codexVersion,
        error: errorMessage,
        models: [],
        parameters: CODEX_PARAMETERS,
        resolvedConfig,
        refreshHint: 'Uses `codex login status` and `codex debug models` for readiness.'
      })
    }

    const models = parseCodexDebugModelsOutput(catalogResult.stdout)
    const defaultModel =
      models.find((model) => model.id === CODEX_DEFAULT_MODEL)?.id ??
      models.find((model) => model.visibility !== 'hide')?.id ??
      models[0]?.id
    const catalogMessage =
      catalogSource === 'bundled'
        ? 'Live model discovery failed, so Fluxion is using the bundled Codex catalog.'
        : 'Fluxion can run workflows through the local Codex CLI.'
    const readiness =
      authStatus === 'unknown'
        ? buildCodexReadiness('auth_unknown', {
            message: authWarning ?? 'Codex auth status could not be confirmed.',
            catalogSource
          })
        : buildCodexReadiness('ready', {
            message: catalogMessage,
            catalogSource,
            ...(catalogSource === 'bundled' ? { title: 'Codex bundled catalog loaded.' } : {})
          })

    return withCodexApprovalProtocol({
      provider: 'codex',
      displayName: 'Codex',
      available: true,
      auth: {
        type: 'cli-login',
        status: authStatus,
        loginCommand: 'codex login',
        message:
          authWarning ??
          (catalogResult.stderr.trim().length > 0 ? catalogResult.stderr.trim() : undefined)
      },
      readiness,
      version: codexVersion,
      models,
      defaultModel,
      parameters: CODEX_PARAMETERS,
      resolvedConfig,
      refreshHint: 'Uses `codex login status` and `codex debug models` for readiness.'
    })
  } catch (error) {
    const { stdout, stderr } = getErrorOutput(error)
    const combinedOutput = `${stderr}\n${stdout}`.trim()

    if (
      error instanceof Error &&
      (error.message.includes(CODEX_CLI_NOT_FOUND_MESSAGE) || getErrorCode(error) === 'ENOENT')
    ) {
      const readiness = buildCodexReadiness('cli_missing')
      return withCodexApprovalProtocol({
        provider: 'codex',
        displayName: 'Codex',
        available: false,
        auth: {
          type: 'cli-login',
          status: 'missing',
          loginCommand: 'codex login',
          message: readiness.message
        },
        readiness,
        error: CODEX_CLI_NOT_FOUND_MESSAGE,
        models: [],
        parameters: CODEX_PARAMETERS,
        resolvedConfig: await buildResolvedCodexConfig(dependencies.workspacePath),
        refreshHint: 'Install @openai/codex in Windows, then refresh Codex readiness.'
      })
    }

    if (combinedOutput && isCodexAuthMissingMessage(combinedOutput)) {
      const readiness = buildCodexReadiness('auth_missing')
      return withCodexApprovalProtocol({
        provider: 'codex',
        displayName: 'Codex',
        available: true,
        auth: {
          type: 'cli-login',
          status: 'missing',
          loginCommand: 'codex login',
          message: readiness.message
        },
        readiness,
        error: combinedOutput,
        models: [],
        parameters: CODEX_PARAMETERS,
        resolvedConfig: await buildResolvedCodexConfig(dependencies.workspacePath),
        refreshHint: 'Run `codex login`, then refresh Codex readiness.'
      })
    }

    const readiness = buildCodexReadiness('catalog_failed', {
      message:
        combinedOutput || (error instanceof Error ? error.message : 'Codex model discovery failed.')
    })

    return withCodexApprovalProtocol({
      provider: 'codex',
      displayName: 'Codex',
      available: true,
      auth: {
        type: 'cli-login',
        status: 'unknown',
        loginCommand: 'codex login',
        message: combinedOutput || 'Codex model discovery failed.'
      },
      readiness,
      error:
        combinedOutput ||
        (error instanceof Error ? error.message : 'Codex model discovery failed.'),
      models: [],
      parameters: CODEX_PARAMETERS,
      resolvedConfig: await buildResolvedCodexConfig(dependencies.workspacePath),
      refreshHint: 'Uses `codex login status` and `codex debug models` for readiness.'
    })
  }
}

export class ProviderRegistryService {
  private static instance: ProviderRegistryService
  private cachedCapabilities: ProviderCapabilitiesMap | null = null
  private cachedAt = 0
  private pendingCapabilities: Promise<ProviderCapabilitiesMap> | null = null
  private cacheGeneration = 0
  private readonly cacheTtlMs = 30_000

  private constructor() {
    // Singleton
  }

  public static getInstance(): ProviderRegistryService {
    if (!ProviderRegistryService.instance) {
      ProviderRegistryService.instance = new ProviderRegistryService()
    }

    return ProviderRegistryService.instance
  }

  public async fetchCapabilities(forceRefresh = false, workspacePath?: string): Promise<ProviderCapabilitiesMap> {
    const now = Date.now()
    if (!forceRefresh && this.cachedCapabilities && now - this.cachedAt < this.cacheTtlMs) {
      return this.cachedCapabilities
    }

    if (this.pendingCapabilities) {
      return this.pendingCapabilities
    }

    const generation = this.cacheGeneration
    const pendingCapabilities = Promise.all([
      getCodexCapabilities({ workspacePath }),
      getOpenAICapabilities()
    ]).then(
      ([codex, openai]) => {
        const capabilities: ProviderCapabilitiesMap = {
          codex,
          openai
        }

        if (this.cacheGeneration === generation) {
          this.cachedCapabilities = capabilities
          this.cachedAt = Date.now()
        }

        return capabilities
      }
    )

    this.pendingCapabilities = pendingCapabilities

    try {
      return await pendingCapabilities
    } finally {
      if (this.pendingCapabilities === pendingCapabilities) {
        this.pendingCapabilities = null
      }
    }
  }

  public getCachedCapabilities(): ProviderCapabilitiesMap | null {
    return this.cachedCapabilities
  }

  public invalidateCache(): void {
    this.cachedCapabilities = null
    this.cachedAt = 0
    this.pendingCapabilities = null
    this.cacheGeneration += 1
  }
}

export const providerRegistryService = ProviderRegistryService.getInstance()
