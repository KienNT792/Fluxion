import { WorkflowNode } from '../schema/workflow.schema';

export interface RunnerContext {
  runId: string;
  workflowId: string;
  node: WorkflowNode;
  prompt: string;
  workspacePath: string;
  env?: Record<string, string>;
}

export interface RunnerTextEvent {
  type: 'stdout' | 'stderr' | 'status';
  content: string;
  timestamp: number;
}

export interface RunnerJsonEvent {
  type: 'json-event';
  event: unknown;
  raw: string;
  timestamp: number;
}

export interface RunnerProcessStartedEvent {
  type: 'process-started';
  pid?: number;
  displayCommand: string;
  startedAt: string;
  timestamp: number;
}

export type RunnerEvent = RunnerTextEvent | RunnerJsonEvent | RunnerProcessStartedEvent;

export interface RunnerProcessTelemetry {
  pid?: number;
  displayCommand: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  exitCode?: number;
  aborted: boolean;
  abortReason?: string;
  stdoutBytes: number;
  stderrBytes: number;
}

export interface RunnerResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  runnerSessionId?: string;
  processTelemetry?: RunnerProcessTelemetry;
}

export interface FluxionRunner {
  id: 'codex' | 'custom' | string;
  run(ctx: RunnerContext): AsyncGenerator<RunnerEvent, RunnerResult, void>;
  abort(runId: string, nodeId: string, reason?: string): Promise<void>;
}
