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

export type RunnerId = 'codex' | 'custom'

export type ExecutionMode = 'auto' | 'manual'

export type CodexSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'

export type CodexApprovalPolicy = 'untrusted' | 'on-request' | 'never'

export type CodexWindowsSandbox = 'unelevated' | 'elevated'

export type CodexApprovalProtocolStatus = 'supported' | 'unsupported' | 'unknown'

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
  windowsSandbox?: CodexWindowsSandbox
  profile?: string
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
