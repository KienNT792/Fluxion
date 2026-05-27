// ─── Enums ───────────────────────────────────────────────────────────────────

// ─── Enums & Types ─────────────────────────────────────────────────────────────

export type ProviderType = 'codex' | 'openai'

/**
 * Dynamic model identifier.
 * Some providers still render from a static curated list, but persisted workflow
 * data must accept arbitrary model strings for compatibility and future discovery.
 */
export type ModelId = string

export type ReasoningLevel = 'low' | 'medium' | 'high' | 'xhigh'
export type CodexVerbosity = 'low' | 'medium' | 'high'
export type CodexReasoningSummary = 'auto' | 'concise' | 'detailed' | 'none'

export type RunnerId = 'codex' | 'custom'

export type ExecutionMode = 'auto' | 'manual'

export type CodexSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'

export type CodexApprovalReviewer = 'user' | 'auto_review'

export interface CodexGranularApprovalPolicy {
  kind: 'granular'
  sandboxApproval?: boolean
  rules?: boolean
  mcpElicitations?: boolean
  requestPermissions?: boolean
  skillApproval?: boolean
}

export type CodexApprovalPolicyMode = 'untrusted' | 'on-request' | 'never'

export type CodexApprovalPolicy = CodexApprovalPolicyMode | CodexGranularApprovalPolicy

export type CodexWindowsSandbox = 'unelevated' | 'elevated'

export type CodexApprovalProtocolStatus = 'supported' | 'unsupported' | 'unknown'

export type CodexConfigLayerSource =
  | 'user'
  | 'project'
  | 'ignored-project'
  | 'profile'
  | 'workflow'
  | 'node'
  | 'inline'
  | 'managed-requirements'
  | 'runtime-default'

export interface CodexConfigLayerValue<T = unknown> {
  source: CodexConfigLayerSource
  value: T
  detail?: string
}

export interface CodexResolvedMcpToolPolicy {
  name: string
  enabled?: boolean
  approvalMode?: 'auto' | 'prompt' | 'approve'
}

export interface CodexResolvedMcpServer {
  id: string
  transport: 'stdio' | 'http' | 'unknown'
  enabled: boolean
  required?: boolean
  environment?: 'local' | 'remote'
  command?: string
  args?: string[]
  url?: string
  cwd?: string
  envVarNames?: string[]
  startupTimeoutSec?: number
  toolTimeoutSec?: number
  enabledTools?: string[]
  disabledTools?: string[]
  defaultToolsApprovalMode?: 'auto' | 'prompt' | 'approve'
  toolPolicies?: CodexResolvedMcpToolPolicy[]
  readiness: 'ready' | 'disabled' | 'not-ready' | 'unknown'
  reason?: string
  constrainedByPolicy?: boolean
  readinessCategory?:
    | 'disabled'
    | 'missing-config'
    | 'invalid-config'
    | 'probe-auth'
    | 'probe-unreachable'
    | 'probe-exit'
    | 'probe-spawn-failed'
    | 'policy-constrained'
    | 'ready'
}

export interface ResolvedCodexConfig {
  model?: string
  reviewModel?: string
  serviceTier?: string
  sandboxMode: CodexSandboxMode
  approvalPolicy: CodexApprovalPolicy
  approvalsReviewer?: CodexApprovalReviewer
  windowsSandbox?: CodexWindowsSandbox
  profile?: string
  trustLevel?: 'trusted' | 'untrusted' | 'unknown'
  writableRoots?: string[]
  networkAccess?: boolean
  modelContextWindow?: number
  modelAutoCompactTokenLimit?: number
  compactPrompt?: string
  memoriesDisableOnExternalContext?: boolean
  modelVerbosity?: CodexVerbosity
  modelReasoningSummary?: CodexReasoningSummary
  hideAgentReasoning?: boolean
  showRawAgentReasoning?: boolean
  mcpServers?: CodexResolvedMcpServer[]
  configEntries?: Record<string, string | number | boolean>
  layers: {
    model?: CodexConfigLayerValue<string>[]
    reviewModel?: CodexConfigLayerValue<string>[]
    serviceTier?: CodexConfigLayerValue<string>[]
    sandboxMode?: CodexConfigLayerValue<CodexSandboxMode>[]
    approvalPolicy?: CodexConfigLayerValue<CodexApprovalPolicy>[]
    approvalsReviewer?: CodexConfigLayerValue<CodexApprovalReviewer>[]
    windowsSandbox?: CodexConfigLayerValue<CodexWindowsSandbox>[]
    profile?: CodexConfigLayerValue<string>[]
    modelContextWindow?: CodexConfigLayerValue<number>[]
    modelAutoCompactTokenLimit?: CodexConfigLayerValue<number>[]
    compactPrompt?: CodexConfigLayerValue<string>[]
    memoriesDisableOnExternalContext?: CodexConfigLayerValue<boolean>[]
    modelVerbosity?: CodexConfigLayerValue<CodexVerbosity>[]
    modelReasoningSummary?: CodexConfigLayerValue<CodexReasoningSummary>[]
    hideAgentReasoning?: CodexConfigLayerValue<boolean>[]
    showRawAgentReasoning?: CodexConfigLayerValue<boolean>[]
  }
  warnings?: string[]
}

export interface CompiledContextSourceBreakdown {
  id: 'global-context' | 'short-term-memory' | 'long-term-memory' | 'node-prompt' | 'system-instruction' | 'artifacts' | 'other'
  label: string
  bytes: number
  estimatedTokens: number
}

export interface CompiledContextDiagnostics {
  model?: string
  modelContextWindow?: number
  autoCompactTokenLimit?: number
  estimatedTotalTokens: number
  estimatedTotalBytes: number
  pressure: 'low' | 'medium' | 'high' | 'over-limit' | 'unknown'
  breakdown: CompiledContextSourceBreakdown[]
  contextHash?: string
  previousNodeIds?: NodeId[]
  staleSourceNodeIds?: NodeId[]
  staleAttemptNodeIds?: NodeId[]
  includesExternalContext?: boolean
  memoriesDisableOnExternalContext?: boolean
  memoryGenerationEligible?: boolean
  compactPriority?: 'none' | 'low' | 'medium' | 'high'
  memoryEligibilityReason?: string
  compactSuggested?: boolean
  compactReason?: string
  compactCandidateSourceIds?: CompiledContextSourceBreakdown['id'][]
  effectiveReviewModel?: string
  effectiveServiceTier?: string
  effectiveModelVerbosity?: CodexVerbosity
  effectiveModelReasoningSummary?: CodexReasoningSummary
  effectiveHideAgentReasoning?: boolean
  effectiveShowRawAgentReasoning?: boolean
  warnings?: string[]
}

export interface CodexApprovalProtocolProbeResult {
  status: CodexApprovalProtocolStatus
  message: string
  checkedAt?: string
  cliDisplayCommand?: string
  observedEventTypes?: string[]
  hasStructuredApprovalRequest?: boolean
  hasCorrelationId?: boolean
  hasProgrammaticReplyChannel?: boolean
  approveDeterministic?: boolean
  rejectDeterministic?: boolean
  rawEventPreview?: unknown[]
}

export interface CodexExecutionOptions {
  json?: boolean
  sandboxMode?: CodexSandboxMode
  approvalPolicy?: CodexApprovalPolicy
  approvalsReviewer?: CodexApprovalReviewer
  windowsSandbox?: CodexWindowsSandbox
  profile?: string
  reviewModel?: string
  serviceTier?: string
  modelVerbosity?: CodexVerbosity
  modelReasoningSummary?: CodexReasoningSummary
  hideAgentReasoning?: boolean
  showRawAgentReasoning?: boolean
  config?: Record<string, string | number | boolean>
}

export interface ArtifactRef {
  path: string
  required?: boolean
}

export interface RetryPolicy {
  maxAttempts?: number
  [key: string]: unknown
}

export type ProviderAuthType = 'api-key-env' | 'browser-login' | 'cli-login' | 'none' | 'unknown'

export type ProviderAuthStatus = 'authenticated' | 'missing' | 'not-required' | 'unknown'

export type ProviderReadinessCode =
  | 'ready'
  | 'cli_missing'
  | 'windowsapps_alias_blocked'
  | 'auth_missing'
  | 'auth_unknown'
  | 'catalog_failed'

export type ProviderCatalogSource = 'live' | 'bundled' | 'none'

export interface ProviderAuthState {
  type: ProviderAuthType
  status: ProviderAuthStatus
  envVar?: string
  loginCommand?: string
  message?: string
}

export interface ProviderReadinessState {
  code: ProviderReadinessCode
  blocking: boolean
  title: string
  message: string
  actionCommand?: string
  catalogSource?: ProviderCatalogSource
}

export interface ProviderModel {
  id: string
  displayName: string
  description?: string
  visibility: 'list' | 'hide' | string
  supportedInApi?: boolean
  supportedReasoningLevels: string[]
  defaultReasoningLevel?: string
  supportVerbosity?: boolean
  defaultVerbosity?: string
  contextWindow?: number
  maxContextWindow?: number
  inputModalities?: string[]
  supportsImages?: boolean
}

export interface ProviderParameterOption {
  value: string
  label: string
  hint?: string
}

export interface ProviderParameterSpec {
  id: string
  label: string
  type: 'select' | 'number' | 'text' | 'boolean'
  defaultValue?: string | number | boolean
  options?: ProviderParameterOption[]
  min?: number
  max?: number
  step?: number
  appliesTo?: 'all' | 'reasoning-models' | 'standard-models'
}

export interface ProviderCapabilities {
  provider: ProviderType
  displayName: string
  available: boolean
  version?: string
  auth: ProviderAuthState
  readiness?: ProviderReadinessState
  error?: string
  models: ProviderModel[]
  defaultModel?: string
  parameters: ProviderParameterSpec[]
  approvalProtocol?: CodexApprovalProtocolProbeResult
  resolvedConfig?: ResolvedCodexConfig
  refreshHint?: string
}

export interface ProviderCapabilitiesMap {
  codex?: ProviderCapabilities
  openai?: ProviderCapabilities
}

// ─── Node Status ─────────────────────────────────────────────────────────────

/**
 * Lifecycle states of a single workflow node.
 * - idle:      Not yet started.
 * - running:   CLI process is actively executing.
 * - stopping:  Abort has been requested; waiting for process to terminate.
 * - completed: Finished successfully; output .md saved to short-term memory.
 * - error:     Terminated with a non-zero exit code or stderr.
 * - paused:    Manual-Accept mode; waiting for user to approve continuation.
 */
export type NodeStatus = 'idle' | 'running' | 'stopping' | 'completed' | 'error' | 'paused'

// ─── Node Data ───────────────────────────────────────────────────────────────

/**
 * Typed data payload stored inside each Agent Node.
 * Replaces the unsafe `Record<string, unknown>` pattern.
 */
export interface AgentNodeData {
  [key: string]: unknown
  provider: ProviderType
  model: ModelId
  runner?: RunnerId
  codex?: CodexExecutionOptions
  /** Optional custom label for this node (e.g. "Analyze Bug", "Write Tests") */
  label?: string
  /** The prompt or instruction to send to this agent. */
  prompt: string
  /** Optional extra system instruction injected before global context. */
  systemInstruction?: string
  /** Optional artifact paths that must exist before this node can run. */
  requires?: ArtifactRef[]
  /** Optional artifact paths this node is expected to produce. */
  produces?: ArtifactRef[]
  /** If true, future phases may pause here for human approval. */
  humanReview?: boolean
  /** Optional retry settings reserved for future execution policies. */
  retryPolicy?: RetryPolicy
  /** If true, the engine serializes this node's ready batch for context writes. */
  contextWriter?: boolean

  // Specific to standard models
  maxTokens?: number
  temperature?: number

  // Specific to reasoning-style models that expose effort levels.
  reasoningLevel?: ReasoningLevel
}

// ─── Multi-Workflow Metadata ─────────────────────────────────────────────────

/** Schema version for forward-compatible migration of .fluxion.json files. */
export type FluxionSchemaVersion = '1.0'

/**
 * Lightweight metadata for listing workflows in the Sidebar.
 * Parsed from file headers without loading the full node/edge graph.
 */
export interface WorkflowMetadata {
  /** ULID — immutable, globally unique. */
  id: string
  /** Human-readable display name (editable by user). */
  name: string
  /** Optional short description, shown in Sidebar tooltip. */
  description?: string
  /** Tags for future filtering/search. */
  tags?: string[]
  /** ISO timestamp of creation. */
  createdAt: string
  /** ISO timestamp of last save. */
  updatedAt: string
  /** Schema version of this workflow file. */
  fluxionVersion: FluxionSchemaVersion
  /**
   * Absolute path to the .fluxion.json file on disk.
   * Used internally for load/save — NOT persisted inside the JSON file itself.
   */
  filePath: string
  /** True if this was loaded from the legacy `.fluxion/workflow.json` format. */
  isLegacy: boolean
}

// ─── Graph Structures ────────────────────────────────────────────────────────

export type NodeId = string

export interface WorkflowNode {
  id: NodeId
  /** React Flow node type identifier (e.g. 'agentNode', 'conditionNode'). */
  type: string
  label: string
  data: AgentNodeData
  position: { x: number; y: number }
}

export interface WorkflowEdge {
  id: string
  source: NodeId
  target: NodeId
  /** Optional: label shown on edge in the canvas. */
  label?: string
}

export interface Workflow {
  id: string
  name: string
  /** Optional short description. */
  description?: string
  /** Tags for categorization. */
  tags?: string[]
  /** Workflow-level review gating mode. */
  executionMode?: ExecutionMode
  /** Optional override for review-focused Codex flows. */
  reviewModel?: string
  /** Workflow-level Codex service tier fallback when nodes do not override it. */
  serviceTier?: string
  /** Workflow-level Codex verbosity fallback when nodes do not override it. */
  modelVerbosity?: CodexVerbosity
  /** Workflow-level Codex reasoning-summary fallback when nodes do not override it. */
  modelReasoningSummary?: CodexReasoningSummary
  /** Workflow-level reasoning visibility fallback when nodes do not override it. */
  hideAgentReasoning?: boolean
  /** Workflow-level raw reasoning visibility fallback when nodes do not override it. */
  showRawAgentReasoning?: boolean
  /** Workflow-level context compaction threshold override. */
  modelAutoCompactTokenLimit?: number
  /** Workflow-level context window hint when the active model catalog is incomplete. */
  modelContextWindow?: number
  /** Schema version. */
  fluxionVersion?: FluxionSchemaVersion
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  /** ISO timestamp of creation. */
  createdAt?: string
  /** ISO timestamp of last save. */
  updatedAt?: string
}

// ─── Execution Data ──────────────────────────────────────────────────────────

/**
 * Runtime state for a single node — stored in useExecutionStore, NOT in
 * useWorkflowStore to prevent React Flow canvas from re-rendering on log updates.
 */
export interface NodeExecutionData {
  status: NodeStatus
  /** Accumulated raw log text from stdout/stderr. Append-only. */
  logs: string
  /** Absolute path to the .md output file written to .fluxion/memory/short-term/ */
  outputFilePath?: string
  error?: string
  /** Unix ms timestamp when execution started. */
  startedAt?: number
  /** Unix ms timestamp when execution ended (success or failure). */
  endedAt?: number
}
