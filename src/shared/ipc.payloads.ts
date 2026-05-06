import { AbortReason } from './agent.types';
import {
  ExecutionMode,
  NodeId,
  NodeStatus,
  ProviderCapabilitiesMap,
  Workflow,
  WorkflowEdge,
  WorkflowMetadata,
  WorkflowNode,
} from './workflow.types';

// ─── Workspace Payloads ──────────────────────────────────────────────────────

export interface WorkspaceOpenedPayload {
  workspacePath: string;
  /** Full document of the initially active workflow. */
  workflow: Workflow;
  /** Absolute path to the active workflow file on disk. */
  activeWorkflowFilePath: string;
  /** ULID of the active workflow. */
  activeWorkflowId: string;
  /** List of all detected workflows (metadata only, no nodes/edges). */
  workflows: WorkflowMetadata[];
  isNewWorkspace: boolean;
  /** Whether .fluxion/context.json already exists for this workspace. */
  hasContext: boolean;
  /** True if a legacy `.fluxion/workflow.json` was detected. */
  legacyWorkflowDetected: boolean;
}

export interface WorkspaceFileChangedPayload {
  filePath: string;
  relativePath: string;
  changeType: 'add' | 'change' | 'unlink';
}

export interface WorkflowSavePayload {
  workspacePath: string;
  workflow: Workflow;
  activeWorkflowFilePath: string;
}

export interface WorkflowSavedPayload {
  workspacePath: string;
  workflowFilePath: string;
  savedAt: string;
}

// ─── Multi-Workflow Payloads ──────────────────────────────────────────────────

export interface WorkflowCreatePayload {
  workspacePath: string;
  name: string;
  /** Optional specific template to use. If omitted, creates a blank workflow. */
  templateId?: string;
}

export interface WorkflowCreateResult {
  /** The newly created workflow document. */
  workflow: Workflow;
  /** Absolute path to the newly created file. */
  workflowFilePath: string;
}

export interface WorkflowLoadPayload {
  workspacePath: string;
  /** ID of the workflow to load. */
  workflowId: string;
}

export interface WorkflowDeletePayload {
  workspacePath: string;
  /** ID of the workflow to delete. */
  workflowId: string;
}

// ─── Workflow Execution Payloads ─────────────────────────────────────────────
export interface WorkflowRunPayload {
  workflowId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  workspacePath: string;
  executionMode?: ExecutionMode;
  resumeFromNodeId?: NodeId;
}

export interface WorkflowAbortPayload {
  /** If provided, abort only this node. If omitted, abort the entire workflow. */
  nodeId?: NodeId;
  reason: AbortReason;
}

export interface WorkflowReviewActionPayload {
  workflowId: string;
  runId: string;
  nodeId: NodeId;
  comment?: string;
}

export interface WorkflowNodeStatusPayload {
  nodeId: NodeId;
  status: NodeStatus;
  error?: string;
  exitCode?: number;
}

export interface WorkflowNodeOutputPayload {
  nodeId: NodeId;
  status: NodeStatus;
  /** Absolute path to the generated .md file in .fluxion/memory/short-term/ */
  outputFilePath?: string;
}

export interface WorkflowReviewRequiredPayload {
  workflowId: string;
  runId: string;
  nodeId: NodeId;
  outputFilePath: string;
  status: 'awaiting_review';
}

export interface WorkflowCompletedPayload {
  workflowId: string;
  success: boolean;
  totalTimeMs: number;
  aborted?: boolean;
  error?: string;
}

// Terminal payloads
export interface TerminalDataBatchPayload {
  nodeId: NodeId;
  /** Array of lines or raw text chunks. */
  batch: string[];
  /** Distinguishes standard output from error logs. */
  sourceType: 'stdout' | 'stderr';
}

export interface TerminalErrorPayload {
  nodeId: NodeId;
  error: string;
}

export interface TerminalExitPayload {
  nodeId: NodeId;
  code: number | null;
}

// Memory payloads
export interface MemoryContextReadyPayload {
  nodeId: NodeId;
  /** The fully compiled mega-prompt string ready to be fed to the agent. */
  compiledContext: string;
}

export type ProviderCapabilitiesPayload = ProviderCapabilitiesMap;

export interface ProviderSettingsSummaryPayload {
  openaiApiKeyConfigured: boolean;
  openaiApiKeySource: 'stored' | 'env' | 'none';
  openaiApiKeyMasked?: string;
  storageMode: 'secure' | 'plain' | 'env' | 'none';
}

export interface UpdateOpenAIApiKeyPayload {
  apiKey: string | null;
}
