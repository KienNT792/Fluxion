import { ProviderType, ModelId } from './workflow.types';

// ─── Abort Reason ─────────────────────────────────────────────────────────────

/**
 * Specific reason why an agent execution was terminated prematurely.
 * Used by the diagnostic flow to provide accurate suggestions.
 *
 * - USER_REQUESTED:  User clicked the STOP button.
 * - ENGINE_HALTED:   WorkflowEngine stopped the entire DAG (e.g. a previous node errored).
 * - PROCESS_TIMEOUT: CLI process became unresponsive and did not exit within the grace period.
 *                    On Windows, this often indicates an antivirus block or missing admin rights.
 */
export enum AbortReason {
  USER_REQUESTED = 'USER_REQUESTED',
  ENGINE_HALTED = 'ENGINE_HALTED',
  PROCESS_TIMEOUT = 'PROCESS_TIMEOUT',
}

// ─── Agent Config ─────────────────────────────────────────────────────────────

/**
 * Configuration for an AI Agent adapter.
 * IMPORTANT: Never store the actual API key here.
 * Use `apiKeyEnvVar` to name the environment variable that holds the key.
 */
export interface AgentConfig {
  provider: ProviderType;
  model: ModelId;
  /** Absolute path to the CLI executable when needed. Optional for API-based agents. */
  cliPath?: string;
  /** Name of the OS environment variable that holds the API key (e.g. 'OPENAI_API_KEY'). */
  apiKeyEnvVar: string;
  /** Additional flags to pass to the CLI. */
  extraFlags?: string[];
}

// ─── Streaming Types ─────────────────────────────────────────────────────────

/**
 * A single data chunk yielded by an Agent Adapter's AsyncGenerator.
 */
export interface AgentChunk {
  type: 'stdout' | 'stderr' | 'status';
  content: string;
  timestamp: number;
}

/**
 * The final return value of an Agent Adapter's AsyncGenerator.
 */
export interface AgentResult {
  success: boolean;
  /** Absolute path to the .md output file (only set if execution completed). */
  outputFilePath?: string;
  error?: string;
  exitCode?: number;
  abortReason?: AbortReason;
}
