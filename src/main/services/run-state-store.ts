import * as fs from 'fs/promises';
import * as path from 'path';
import {
  NodeRunState,
  RunStatus,
  WorkflowRunState,
  WorkflowRunStateSchema,
} from '@core';
import { NodeId, Workflow } from '@shared';

export interface InitializeRunOptions {
  workspacePath: string;
  workflow: Workflow;
  executionNodeIds: Set<NodeId>;
  runId: string;
  startedAt?: string;
}

export interface NodeCompletionUpdate {
  exitCode?: number;
  runnerSessionId?: string;
  outputArtifactPaths?: string[];
  completedAt?: string;
}

export interface NodeFailureUpdate {
  error: string;
  exitCode?: number;
  completedAt?: string;
}

type RunMutation<T> = (state: WorkflowRunState) => T | Promise<T>;

function nowIso(): string {
  return new Date().toISOString();
}

function runFilePath(workspacePath: string, runId: string): string {
  return path.join(workspacePath, '.fluxion', 'runs', `${runId}.json`);
}

function sortNodeIds(nodeIds: string[]): string[] {
  return [...new Set(nodeIds)].sort((a, b) => a.localeCompare(b));
}

function removeNodeId(nodeIds: string[], nodeId: string): string[] {
  return sortNodeIds(nodeIds.filter((id) => id !== nodeId));
}

export class RunStateStore {
  private readonly writeQueues = new Map<string, Promise<unknown>>();
  private readonly states = new Map<string, WorkflowRunState>();

  public async initializeRun(options: InitializeRunOptions): Promise<WorkflowRunState> {
    const startedAt = options.startedAt ?? nowIso();
    const nodes: Record<string, NodeRunState> = {};

    for (const node of options.workflow.nodes) {
      if (!options.executionNodeIds.has(node.id)) {
        continue;
      }

      nodes[node.id] = {
        nodeId: node.id,
        runner: node.data.runner ?? 'codex',
        status: 'pending',
        attempts: 0,
        model: node.data.model,
        outputArtifactPaths: [],
      };
    }

    const state = WorkflowRunStateSchema.parse({
      schemaVersion: 1,
      runId: options.runId,
      workflowId: options.workflow.id,
      status: 'running',
      startedAt,
      updatedAt: startedAt,
      currentNodeIds: [],
      nodes,
    });

    this.states.set(this.key(options.workspacePath, options.runId), state);
    await this.writeState(options.workspacePath, state);
    return state;
  }

  public async readRun(workspacePath: string, runId: string): Promise<WorkflowRunState> {
    const existing = this.states.get(this.key(workspacePath, runId));
    if (existing) {
      return structuredClone(existing);
    }

    const content = await fs.readFile(runFilePath(workspacePath, runId), 'utf8');
    const state = WorkflowRunStateSchema.parse(JSON.parse(content) as unknown);
    this.states.set(this.key(workspacePath, runId), state);
    return structuredClone(state);
  }

  public async markNodeRunning(
    workspacePath: string,
    runId: string,
    nodeId: NodeId,
    startedAt = nowIso()
  ): Promise<WorkflowRunState> {
    return this.updateRun(workspacePath, runId, (state) => {
      const node = this.requireNode(state, nodeId);
      node.status = 'running';
      node.startedAt = node.startedAt ?? startedAt;
      node.completedAt = undefined;
      node.error = undefined;
      node.attempts += 1;
      state.status = 'running';
      state.currentNodeIds = sortNodeIds([...state.currentNodeIds, nodeId]);
      return state;
    });
  }

  public async markNodeCompleted(
    workspacePath: string,
    runId: string,
    nodeId: NodeId,
    update: NodeCompletionUpdate = {}
  ): Promise<WorkflowRunState> {
    return this.updateRun(workspacePath, runId, (state) => {
      const node = this.requireNode(state, nodeId);
      node.status = 'completed';
      node.completedAt = update.completedAt ?? nowIso();
      node.exitCode = update.exitCode;
      node.error = undefined;
      node.runnerSessionId = update.runnerSessionId;
      node.outputArtifactPaths = sortNodeIds(update.outputArtifactPaths ?? []);
      state.currentNodeIds = removeNodeId(state.currentNodeIds, nodeId);
      return state;
    });
  }

  public async markNodeFailed(
    workspacePath: string,
    runId: string,
    nodeId: NodeId,
    update: NodeFailureUpdate
  ): Promise<WorkflowRunState> {
    return this.updateRun(workspacePath, runId, (state) => {
      const node = this.requireNode(state, nodeId);
      node.status = 'failed';
      node.completedAt = update.completedAt ?? nowIso();
      node.exitCode = update.exitCode;
      node.error = update.error;
      state.status = 'failed';
      state.currentNodeIds = removeNodeId(state.currentNodeIds, nodeId);
      return state;
    });
  }

  public async markNodeAborted(
    workspacePath: string,
    runId: string,
    nodeId: NodeId,
    error: string,
    exitCode?: number
  ): Promise<WorkflowRunState> {
    return this.updateRun(workspacePath, runId, (state) => {
      const node = this.requireNode(state, nodeId);
      node.status = 'aborted';
      node.completedAt = nowIso();
      node.exitCode = exitCode;
      node.error = error;
      state.status = 'aborted';
      state.currentNodeIds = removeNodeId(state.currentNodeIds, nodeId);
      return state;
    });
  }

  public async finalizeWorkflow(
    workspacePath: string,
    runId: string,
    status: Extract<RunStatus, 'completed' | 'failed' | 'aborted' | 'rejected'>,
    completedAt = nowIso()
  ): Promise<WorkflowRunState> {
    return this.updateRun(workspacePath, runId, (state) => {
      state.status = status;
      state.completedAt = completedAt;
      state.currentNodeIds = [];
      return state;
    });
  }

  private async updateRun(
    workspacePath: string,
    runId: string,
    mutation: RunMutation<WorkflowRunState>
  ): Promise<WorkflowRunState> {
    return this.enqueue(workspacePath, runId, async () => {
      const mapKey = this.key(workspacePath, runId);
      const state = this.states.get(mapKey) ?? (await this.readRun(workspacePath, runId));
      const updated = await mutation(structuredClone(state));
      updated.currentNodeIds = sortNodeIds(updated.currentNodeIds);
      updated.updatedAt = nowIso();
      const parsed = WorkflowRunStateSchema.parse(updated);
      this.states.set(mapKey, parsed);
      await this.writeState(workspacePath, parsed);
      return structuredClone(parsed);
    });
  }

  private enqueue<T>(workspacePath: string, runId: string, operation: () => Promise<T>): Promise<T> {
    const queueKey = this.key(workspacePath, runId);
    const previous = this.writeQueues.get(queueKey) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    this.writeQueues.set(queueKey, next.catch(() => undefined));
    return next;
  }

  private async writeState(workspacePath: string, state: WorkflowRunState): Promise<void> {
    const parsed = WorkflowRunStateSchema.parse(state);
    const filePath = runFilePath(workspacePath, parsed.runId);
    const directory = path.dirname(filePath);
    const tempPath = `${filePath}.tmp`;
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(tempPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');

    try {
      await fs.rename(tempPath, filePath);
    } catch {
      await fs.rm(filePath, { force: true });
      await fs.rename(tempPath, filePath);
    }
  }

  private requireNode(state: WorkflowRunState, nodeId: NodeId): NodeRunState {
    const node = state.nodes[nodeId];
    if (!node) {
      throw new Error(`Node ${nodeId} is not part of run ${state.runId}.`);
    }
    return node;
  }

  private key(workspacePath: string, runId: string): string {
    return `${path.resolve(workspacePath)}:${runId}`;
  }
}

export const runStateStore = new RunStateStore();
