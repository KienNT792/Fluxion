import { randomUUID } from 'crypto';
import {
  AbortReason,
  AgentChunk,
  AgentNodeData,
  AgentResult,
  NodeId,
} from '@shared';
import { RunnerContext, WorkflowNodeSchema } from '@core';
import { BaseAdapter } from './base.adapter';
import { CodexCliRunner } from '../runners/codex-cli-runner';

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
          };
          break;
        }

        const event = next.value;
        if (event.type === 'stdout' || event.type === 'stderr' || event.type === 'status') {
          yield this.createChunk(event.type, event.content);
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
    await this.runner.abort(runId, nodeId);
  }
}
