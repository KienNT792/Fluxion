import { randomUUID } from 'crypto';
import {
  AbortReason,
  AgentChunk,
  AgentNodeData,
  AgentResult,
  NodeId,
} from '@shared';
import { RunnerContext, RunnerEvent, WorkflowNodeSchema } from '@core';
import { BaseAdapter } from './base.adapter';
import { CodexCliRunner } from '../runners/codex-cli-runner';

// ─── Abort Message ────────────────────────────────────────────────────────────

function buildAbortMessage(reason: AbortReason): string {
  switch (reason) {
    case AbortReason.ENGINE_HALTED:
      return 'Codex CLI execution was cancelled because the workflow was halted.';
    case AbortReason.USER_REQUESTED:
      return 'Codex CLI execution was cancelled by the user.';
    default:
      return 'Codex CLI execution was cancelled.';
  }
}

// ─── Event Translation ────────────────────────────────────────────────────────

/**
 * Attempts to extract a human-readable summary line from a Codex NDJSON event.
 *
 * Contract:
 * - Returns a concise operational string on success.
 * - Returns null for high-frequency, unknown, or non-observable events.
 * - NEVER returns raw JSON strings.
 * - NEVER dumps entire event payloads.
 * - Defensive: treats the Codex schema as potentially evolving.
 */
export function extractJsonEventSummary(event: unknown): string | null {
  if (typeof event !== 'object' || event === null) {
    return null;
  }

  const e = event as Record<string, unknown>;

  // Top-level type discriminator
  const topType = typeof e['type'] === 'string' ? e['type'] : null;

  if (topType === 'session_started') {
    return 'session started';
  }

  if (topType === 'session_stopped' || topType === 'session_completed') {
    return 'session completed';
  }

  // Message-level events (e.g. { type: 'message', msg: { type: 'text_delta', delta: '...' } })
  if (topType === 'message' || topType === 'response') {
    const msg = e['msg'] as Record<string, unknown> | undefined;
    const msgType = msg && typeof msg['type'] === 'string' ? msg['type'] : null;

    // text_delta events are high-frequency token streams — suppress for Phase 1
    if (msgType === 'text_delta') {
      return null;
    }

    if (msgType === 'assistant_message' || msgType === 'message_complete') {
      return 'assistant response received';
    }

    return null;
  }

  // Tool / command execution events
  if (topType === 'function_call' || topType === 'tool_call') {
    const name = typeof e['name'] === 'string' ? e['name'] : null;
    const command = typeof e['command'] === 'string' ? e['command'] : null;
    const label = name ?? command;
    return label ? `running: ${label}` : 'running command';
  }

  if (topType === 'function_call_output' || topType === 'tool_result') {
    return 'command completed';
  }

  // File system events
  if (topType === 'file_read') {
    const path = typeof e['path'] === 'string' ? e['path'] : null;
    return path ? `reading: ${path}` : 'reading file';
  }

  if (topType === 'file_write' || topType === 'file_edit') {
    const path = typeof e['path'] === 'string' ? e['path'] : null;
    return path ? `editing: ${path}` : 'editing file';
  }

  // Error events
  const errorField = e['error'];
  if (typeof errorField === 'string' && errorField.trim().length > 0) {
    return `error: ${errorField.trim()}`;
  }
  if (typeof errorField === 'object' && errorField !== null) {
    const errMsg = (errorField as Record<string, unknown>)['message'];
    if (typeof errMsg === 'string' && errMsg.trim().length > 0) {
      return `error: ${errMsg.trim()}`;
    }
  }

  // Everything else: unknown or high-frequency internal event — suppress
  return null;
}

/**
 * Translates a raw RunnerEvent from CodexCliRunner into an AgentChunk suitable
 * for WorkflowEngine batching, or null if the event should be suppressed.
 *
 * Ownership: This is the ONLY location where json-event/status translation happens.
 * WorkflowEngine continues to batch stdout/stderr only.
 */
export function translateRunnerEventToChunk(
  event: RunnerEvent,
  now: () => number = Date.now
): AgentChunk | null {
  if (event.type === 'process-started') {
    return {
      type: 'process-started',
      pid: event.pid,
      displayCommand: event.displayCommand,
      startedAt: event.startedAt,
      timestamp: now(),
    };
  }

  // stdout/stderr pass through unchanged
  if (event.type === 'stdout' || event.type === 'stderr') {
    return { type: event.type, content: event.content, timestamp: now() };
  }

  // status events: prefix with dim [codex] marker
  if (event.type === 'status') {
    const trimmed = event.content.trimEnd();
    if (trimmed.length === 0) return null;
    return {
      type: 'stdout',
      content: `\x1b[2m[codex]\x1b[0m ${trimmed}\n`,
      timestamp: now(),
    };
  }

  // json-event: extract a meaningful summary or suppress
  if (event.type === 'json-event') {
    const summary = extractJsonEventSummary(event.event);
    if (summary === null) return null;

    // Error summaries are semantically distinct from execution narrative
    if (summary.startsWith('error:')) {
      const message = summary.slice('error:'.length).trim();
      return {
        type: 'stderr',
        content: `\x1b[31m[error]\x1b[0m ${message}\n`,
        timestamp: now(),
      };
    }

    return {
      type: 'stdout',
      content: `\x1b[2m[codex]\x1b[0m ${summary}\n`,
      timestamp: now(),
    };
  }

  return null;
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class CodexCliAdapter extends BaseAdapter {
  private readonly runner: CodexCliRunner;
  private readonly runIdsByNodeId = new Map<NodeId, string>();
  private readonly abortReasons = new Map<NodeId, AbortReason>();

  public constructor(runner = new CodexCliRunner()) {
    super();
    this.runner = runner;
  }

  public async *execute(
    nodeId: NodeId,
    nodeData: AgentNodeData,
    prompt: string,
    workspacePath: string
  ): AsyncGenerator<AgentChunk, AgentResult, void> {
    this.activeExecutions.add(nodeId);

    if ((nodeData.runner ?? 'codex') !== 'codex') {
      const error = `Runner "${nodeData.runner}" is not implemented in P1.`;
      yield this.createChunk('stderr', `${error}\n`);
      this.activeExecutions.delete(nodeId);
      return {
        success: false,
        error,
        exitCode: 78,
      };
    }

    const runId = randomUUID();
    this.runIdsByNodeId.set(nodeId, runId);
    this.abortReasons.delete(nodeId);

    const node = WorkflowNodeSchema.parse({
      id: nodeId,
      type: 'agentNode',
      label:
        typeof nodeData.label === 'string' && nodeData.label.trim().length > 0
          ? nodeData.label
          : nodeId,
      data: {
        ...nodeData,
        runner: 'codex',
      },
      position: { x: 0, y: 0 },
    });

    const ctx: RunnerContext = {
      runId,
      workflowId: 'workflow-runtime',
      node,
      prompt,
      workspacePath,
    };

    try {
      const iterator = this.runner.run(ctx);
      let result: AgentResult = {
        success: false,
        error: 'Codex CLI execution exited without a result.',
      };

      while (true) {
        const next = await iterator.next();

        if (next.done) {
          const runnerResult = next.value;
          const abortReason = this.abortReasons.get(nodeId);
          result = {
            success: runnerResult.success,
            output: runnerResult.output,
            error: abortReason ? buildAbortMessage(abortReason) : runnerResult.error,
            exitCode: runnerResult.exitCode,
            runnerSessionId: runnerResult.runnerSessionId,
            abortReason,
            processTelemetry: runnerResult.processTelemetry
              ? {
                  ...runnerResult.processTelemetry,
                  abortReason: abortReason ?? runnerResult.processTelemetry.abortReason,
                }
              : undefined,
          };
          break;
        }

        const chunk = translateRunnerEventToChunk(next.value);
        if (chunk !== null) {
          yield chunk;
        }
      }

      return result;
    } finally {
      this.runIdsByNodeId.delete(nodeId);
      this.abortReasons.delete(nodeId);
      this.activeExecutions.delete(nodeId);
    }
  }

  protected async onAbort(nodeId: NodeId, reason: AbortReason): Promise<void> {
    const runId = this.runIdsByNodeId.get(nodeId);
    if (!runId) {
      return;
    }

    this.abortReasons.set(nodeId, reason);
    await this.runner.abort(runId, nodeId, reason);
  }
}
