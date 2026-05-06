import { randomUUID } from 'crypto';
import {
  AbortReason,
  AgentResult,
  IpcChannels,
  NodeId,
  NodeStatus,
  SaveNodeOutputParams,
  Workflow,
  WorkflowNode,
} from '@shared';
import { CodexCliAdapter } from '../adapters/codex-cli.adapter';
import { IAgentAdapter } from '../adapters/base.adapter';
import { artifactGateService, ArtifactGateService, ArtifactSnapshot } from './artifact-gate-service';
import { memoryManager, MemoryManager } from './memory-manager';
import { InitializeRunOptions, runStateStore, RunStateStore } from './run-state-store';

export interface WorkflowEventSender {
  send(channel: string, payload: unknown): void;
}

interface WorkflowEngineDependencies {
  adapter?: IAgentAdapter;
  memoryManager?: Pick<MemoryManager, 'initWorkspace' | 'compileContext' | 'saveNodeOutput'>;
  runStateStore?: Pick<
    RunStateStore,
    'initializeRun' | 'markNodeRunning' | 'markNodeCompleted' | 'markNodeFailed' | 'markNodeAborted' | 'finalizeWorkflow'
  >;
  artifactGateService?: Pick<
    ArtifactGateService,
    'validateRequires' | 'snapshotProduces' | 'validateProduces'
  >;
}

function buildPrompt(node: WorkflowNode, context: string): string {
  const promptSections = [context.trim()];
  const systemInstruction =
    typeof node.data.systemInstruction === 'string' ? node.data.systemInstruction.trim() : '';

  if (systemInstruction) {
    promptSections.push(`[SYSTEM INSTRUCTION]\n${systemInstruction}`);
  }

  promptSections.push(`[USER INSTRUCTION]\n${node.data.prompt}`);
  return promptSections.filter((section) => section.length > 0).join('\n\n');
}

export class WorkflowEngine {
  private static instance: WorkflowEngine;

  private isHalted = false;
  private currentWorkflowId: string | null = null;
  private currentRunId: string | null = null;
  private currentWorkspacePath: string | null = null;
  private activeNodes: Set<NodeId> = new Set();
  private haltReason: 'aborted' | 'error' | null = null;
  private haltError: string | null = null;
  private readonly adapter: IAgentAdapter;
  private readonly memoryManager: Pick<
    MemoryManager,
    'initWorkspace' | 'compileContext' | 'saveNodeOutput'
  >;
  private readonly runStateStore: Pick<
    RunStateStore,
    'initializeRun' | 'markNodeRunning' | 'markNodeCompleted' | 'markNodeFailed' | 'markNodeAborted' | 'finalizeWorkflow'
  >;
  private readonly artifactGateService: Pick<
    ArtifactGateService,
    'validateRequires' | 'snapshotProduces' | 'validateProduces'
  >;

  private constructor(dependencies: WorkflowEngineDependencies = {}) {
    this.adapter = dependencies.adapter ?? new CodexCliAdapter();
    this.memoryManager = dependencies.memoryManager ?? memoryManager;
    this.runStateStore = dependencies.runStateStore ?? runStateStore;
    this.artifactGateService = dependencies.artifactGateService ?? artifactGateService;
  }

  public static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  public static createForTesting(dependencies: WorkflowEngineDependencies): WorkflowEngine {
    return new WorkflowEngine(dependencies);
  }

  /**
   * Starts executing a workflow DAG.
   */
  public async start(
    workflow: Workflow,
    workspacePath: string,
    sender: WorkflowEventSender,
    resumeFromNodeId?: NodeId
  ): Promise<void> {
    if (this.currentWorkflowId) {
      throw new Error('A workflow is already running.');
    }

    this.isHalted = false;
    this.currentWorkflowId = workflow.id;
    this.currentRunId = randomUUID();
    this.currentWorkspacePath = workspacePath;
    this.haltReason = null;
    this.haltError = null;
    const startTime = Date.now();
    const executionNodeIds = this.getExecutionNodeIds(workflow, resumeFromNodeId);
    let runInitialized = false;

    try {
      await this.memoryManager.initWorkspace(workspacePath);
      await this.runStateStore.initializeRun({
        workspacePath,
        workflow,
        executionNodeIds,
        runId: this.currentRunId,
      } satisfies InitializeRunOptions);
      runInitialized = true;

      await this.executeDag(workflow, workspacePath, sender, executionNodeIds);
      await this.runStateStore.finalizeWorkflow(
        workspacePath,
        this.currentRunId,
        this.getFinalRunStatus()
      );

      if (!this.isHalted) {
        sender.send(IpcChannels.WORKFLOW_COMPLETED, {
          workflowId: workflow.id,
          success: true,
          totalTimeMs: Date.now() - startTime,
        });
      } else {
        sender.send(IpcChannels.WORKFLOW_COMPLETED, {
          workflowId: workflow.id,
          success: false,
          totalTimeMs: Date.now() - startTime,
          aborted: this.haltReason === 'aborted',
          error: this.haltError ?? undefined,
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown workflow execution error';
      console.error('Workflow execution failed:', err);
      this.markWorkflowFailed(errorMessage);

      if (runInitialized && this.currentRunId && this.currentWorkspacePath) {
        await this.runStateStore.finalizeWorkflow(
          this.currentWorkspacePath,
          this.currentRunId,
          this.getFinalRunStatus()
        );
      }

      sender.send(IpcChannels.WORKFLOW_COMPLETED, {
        workflowId: workflow.id,
        success: false,
        totalTimeMs: Date.now() - startTime,
        aborted: this.haltReason === 'aborted',
        error: errorMessage,
      });
    } finally {
      this.currentWorkflowId = null;
      this.currentRunId = null;
      this.currentWorkspacePath = null;
      this.activeNodes.clear();
      this.haltReason = null;
      this.haltError = null;
    }
  }

  /**
   * Aborts the entire workflow or a specific node.
   */
  public async abort(
    nodeId?: NodeId,
    reason: AbortReason = AbortReason.USER_REQUESTED
  ): Promise<void> {
    if (nodeId) {
      this.isHalted = true;
      this.haltReason = 'aborted';
      this.haltError = `Execution stopped for node ${nodeId}.`;
      await this.abortNode(nodeId, reason);
      return;
    }

    this.isHalted = true;
    this.haltReason = 'aborted';
    this.haltError = 'Workflow aborted by user.';
    const promises = Array.from(this.activeNodes).map((id) => this.abortNode(id, reason));
    await Promise.all(promises);
  }

  private async abortNode(nodeId: NodeId, reason: AbortReason): Promise<void> {
    await this.adapter.abort(nodeId, reason);
  }

  private async haltActiveNodes(excludeNodeId?: NodeId): Promise<void> {
    const nodeIds = Array.from(this.activeNodes).filter((nodeId) => nodeId !== excludeNodeId);
    const promises = nodeIds.map((nodeId) => this.abortNode(nodeId, AbortReason.ENGINE_HALTED));
    await Promise.all(promises);
  }

  private sendNodeStatus(
    sender: WorkflowEventSender,
    nodeId: NodeId,
    status: NodeStatus,
    error?: string,
    exitCode?: number
  ): void {
    sender.send(IpcChannels.WORKFLOW_NODE_STATUS, { nodeId, status, error, exitCode });
  }

  private markWorkflowFailed(error: string): void {
    this.isHalted = true;
    this.haltReason = 'error';
    this.haltError = error;
  }

  private getFinalRunStatus(): 'completed' | 'failed' | 'aborted' {
    if (this.haltReason === 'aborted') {
      return 'aborted';
    }

    if (this.isHalted) {
      return 'failed';
    }

    return 'completed';
  }

  private getExecutionNodeIds(workflow: Workflow, resumeFromNodeId?: NodeId): Set<NodeId> {
    if (!resumeFromNodeId) {
      return new Set(workflow.nodes.map((node) => node.id));
    }

    const adjacency = new Map<NodeId, NodeId[]>();
    workflow.nodes.forEach((node) => {
      adjacency.set(node.id, []);
    });

    workflow.edges.forEach((edge) => {
      adjacency.get(edge.source)?.push(edge.target);
    });

    const selectedNodeIds = new Set<NodeId>();
    const queue: NodeId[] = [resumeFromNodeId];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (selectedNodeIds.has(nodeId)) {
        continue;
      }

      selectedNodeIds.add(nodeId);
      for (const neighbor of adjacency.get(nodeId) ?? []) {
        queue.push(neighbor);
      }
    }

    return selectedNodeIds;
  }

  /**
   * Executes the DAG using a topological approach.
   * Finds nodes with indegree=0, runs them, then removes them from the graph.
   */
  private async executeDag(
    workflow: Workflow,
    workspacePath: string,
    sender: WorkflowEventSender,
    executionNodeIds: Set<NodeId>
  ): Promise<void> {
    const nodes = new Map<NodeId, WorkflowNode>();
    workflow.nodes
      .filter((node) => executionNodeIds.has(node.id))
      .forEach((node) => nodes.set(node.id, node));

    const inDegree = new Map<NodeId, number>();
    const graph = new Map<NodeId, NodeId[]>();

    workflow.nodes
      .filter((node) => executionNodeIds.has(node.id))
      .forEach((node) => {
        inDegree.set(node.id, 0);
        graph.set(node.id, []);
      });

    workflow.edges.forEach((edge) => {
      if (executionNodeIds.has(edge.source) && executionNodeIds.has(edge.target)) {
        graph.get(edge.source)?.push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
      }
    });

    const queue: NodeId[] = [];
    inDegree.forEach((degree, id) => {
      if (degree === 0) {
        queue.push(id);
      }
    });

    while (queue.length > 0 && !this.isHalted) {
      const currentBatch = [...queue];
      queue.length = 0;

      const batchPromises = currentBatch.map(async (nodeId) => {
        if (this.isHalted) {
          return;
        }

        const node = nodes.get(nodeId);
        if (!node) {
          return;
        }

        const previousNodes = workflow.edges
          .filter((edge) => edge.target === nodeId && executionNodeIds.has(edge.source))
          .map((edge) => edge.source);

        const nodeCompleted = await this.runNode(node, workspacePath, previousNodes, sender);
        if (nodeCompleted && !this.isHalted) {
          const neighbors = graph.get(nodeId) ?? [];
          for (const neighbor of neighbors) {
            const nextDegree = (inDegree.get(neighbor) ?? 0) - 1;
            inDegree.set(neighbor, nextDegree);
            if (nextDegree === 0) {
              queue.push(neighbor);
            }
          }
        }
      });

      await Promise.all(batchPromises);
    }
  }

  private async runNode(
    node: WorkflowNode,
    workspacePath: string,
    previousNodeIds: NodeId[],
    sender: WorkflowEventSender
  ): Promise<boolean> {
    const workflowId = this.currentWorkflowId;
    const runId = this.currentRunId;
    if (!workflowId || !runId) {
      throw new Error('Workflow runtime context is not initialized.');
    }

    try {
      await this.ensureRequiredArtifacts(workspacePath, node);
      const produceSnapshots = await this.artifactGateService.snapshotProduces(
        workspacePath,
        node.data.produces ?? []
      );
      const runningState = await this.runStateStore.markNodeRunning(
        workspacePath,
        runId,
        node.id
      );
      const startedAt = runningState.nodes[node.id]?.startedAt ?? new Date().toISOString();

      this.activeNodes.add(node.id);
      this.sendNodeStatus(sender, node.id, 'running');

      const context = await this.memoryManager.compileContext(
        workspacePath,
        workflowId,
        previousNodeIds
      );
      sender.send(IpcChannels.MEMORY_CONTEXT_READY, {
        nodeId: node.id,
        compiledContext: context,
      });

      const fullPrompt = buildPrompt(node, context);
      const result = await this.executeNode(node, fullPrompt, workspacePath, sender);

      sender.send(IpcChannels.TERMINAL_EXIT, {
        nodeId: node.id,
        code: result.exitCode ?? null,
      });

      if (result.abortReason) {
        const errorMessage = result.error ?? 'Workflow aborted.';
        this.sendNodeStatus(sender, node.id, 'stopping', errorMessage, result.exitCode);
        await this.runStateStore.markNodeAborted(
          workspacePath,
          runId,
          node.id,
          errorMessage,
          result.exitCode
        );
        if (!this.haltReason) {
          this.isHalted = true;
          this.haltReason = 'aborted';
          this.haltError = errorMessage;
        }
        return false;
      }

      if (!result.success) {
        const errorMessage =
          result.error ?? `Agent exited with code ${result.exitCode ?? 'unknown'}.`;
        sender.send(IpcChannels.TERMINAL_ERROR, { nodeId: node.id, error: errorMessage });
        this.sendNodeStatus(sender, node.id, 'error', errorMessage, result.exitCode);
        await this.runStateStore.markNodeFailed(workspacePath, runId, node.id, {
          error: errorMessage,
          exitCode: result.exitCode,
        });
        this.markWorkflowFailed(errorMessage);
        await this.haltActiveNodes(node.id);
        return false;
      }

      if (this.isHalted) {
        const errorMessage = this.haltError ?? 'Workflow halted before node completion.';
        this.sendNodeStatus(sender, node.id, 'stopping', errorMessage, result.exitCode);
        await this.runStateStore.markNodeAborted(
          workspacePath,
          runId,
          node.id,
          errorMessage,
          result.exitCode
        );
        return false;
      }

      const producedPaths = await this.ensureProducedArtifacts(
        workspacePath,
        node,
        produceSnapshots
      );
      const completedAt = new Date().toISOString();
      const outputFilePath = await this.memoryManager.saveNodeOutput(
        workspacePath,
        workflowId,
        this.createSaveNodeOutputParams(node, runId, startedAt, completedAt, result)
      );

      await this.runStateStore.markNodeCompleted(workspacePath, runId, node.id, {
        completedAt,
        exitCode: result.exitCode,
        runnerSessionId: result.runnerSessionId,
        outputArtifactPaths: producedPaths,
      });

      this.sendNodeStatus(sender, node.id, 'completed', undefined, result.exitCode);
      sender.send(IpcChannels.WORKFLOW_NODE_OUTPUT, {
        nodeId: node.id,
        status: 'completed',
        outputFilePath,
      });

      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown node execution error';
      sender.send(IpcChannels.TERMINAL_ERROR, { nodeId: node.id, error: errorMessage });
      this.sendNodeStatus(sender, node.id, 'error', errorMessage);

      if (this.currentRunId) {
        try {
          await this.runStateStore.markNodeFailed(workspacePath, this.currentRunId, node.id, {
            error: errorMessage,
          });
        } catch {
          // Best-effort: do not hide the original node error if persistence update also fails.
        }
      }

      this.markWorkflowFailed(errorMessage);
      await this.haltActiveNodes(node.id);
      return false;
    } finally {
      this.activeNodes.delete(node.id);
    }
  }

  private async executeNode(
    node: WorkflowNode,
    fullPrompt: string,
    workspacePath: string,
    sender: WorkflowEventSender
  ): Promise<AgentResult> {
    const batches: Record<'stdout' | 'stderr', string[]> = {
      stdout: [],
      stderr: [],
    };

    const flushBatch = (): void => {
      for (const sourceType of ['stdout', 'stderr'] as const) {
        if (batches[sourceType].length === 0) {
          continue;
        }

        sender.send(IpcChannels.TERMINAL_DATA_BATCH, {
          nodeId: node.id,
          batch: [...batches[sourceType]],
          sourceType,
        });
        batches[sourceType] = [];
      }
    };

    const batchInterval = setInterval(flushBatch, 100);

    try {
      let fullOutput = '';
      let result: AgentResult = {
        success: false,
        error: 'Agent execution exited without a result.',
      };
      const iterator = this.adapter.execute(node.id, node.data, fullPrompt, workspacePath);

      while (true) {
        const next = await iterator.next();
        if (next.done) {
          result = next.value;
          break;
        }

        if (this.isHalted && this.haltReason === 'aborted') {
          continue;
        }

        const chunk = next.value;
        if (chunk.type === 'stdout' || chunk.type === 'stderr') {
          batches[chunk.type].push(chunk.content);
          fullOutput += chunk.content;
        }
      }

      return {
        ...result,
        output: result.output ?? fullOutput,
      };
    } finally {
      clearInterval(batchInterval);
      flushBatch();
    }
  }

  private async ensureRequiredArtifacts(
    workspacePath: string,
    node: WorkflowNode
  ): Promise<void> {
    const result = await this.artifactGateService.validateRequires(
      workspacePath,
      node.data.requires ?? []
    );

    if (result.valid) {
      return;
    }

    throw new Error(
      result.error ?? `Required artifact validation failed for node ${node.id}.`
    );
  }

  private async ensureProducedArtifacts(
    workspacePath: string,
    node: WorkflowNode,
    snapshots: ArtifactSnapshot[]
  ): Promise<string[]> {
    const result = await this.artifactGateService.validateProduces(
      workspacePath,
      node.data.produces ?? [],
      snapshots
    );

    if (result.valid) {
      return result.artifactPaths;
    }

    throw new Error(
      result.error ?? `Produced artifact validation failed for node ${node.id}.`
    );
  }

  private createSaveNodeOutputParams(
    node: WorkflowNode,
    runId: string,
    startedAt: string,
    completedAt: string,
    result: AgentResult
  ): SaveNodeOutputParams {
    return {
      runId,
      nodeId: node.id,
      runner: node.data.runner ?? 'codex',
      model: node.data.model,
      status: 'completed',
      startedAt,
      completedAt,
      exitCode: result.exitCode,
      runnerSessionId: result.runnerSessionId,
      provider: node.data.provider,
      content: result.output ?? '',
    };
  }
}

export const workflowEngine = WorkflowEngine.getInstance();
