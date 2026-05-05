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

export type RunnerEvent = RunnerTextEvent | RunnerJsonEvent;

export interface RunnerResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  runnerSessionId?: string;
}

export interface FluxionRunner {
  id: 'codex' | 'custom' | string;
  run(ctx: RunnerContext): AsyncGenerator<RunnerEvent, RunnerResult, void>;
  abort(runId: string, nodeId: string): Promise<void>;
}
