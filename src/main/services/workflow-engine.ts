import { 
  AgentResult,
  Workflow, 
  NodeId, 
  WorkflowNode, 
  ProviderType,
  AbortReason, 
  IpcChannels,
  NodeStatus
} from '@shared';
import { MockAdapter } from '../adapters/mock.adapter';
import { CodexAdapter } from '../adapters/codex.adapter';
import { OpenAIAdapter } from '../adapters/openai.adapter';
import { memoryManager } from './memory-manager';
import { IAgentAdapter } from '../adapters/base.adapter';
import { join } from 'path';

export class WorkflowEngine {
  private static instance: WorkflowEngine;
  
  private isHalted = false;
  private currentWorkflowId: string | null = null;
  private activeNodes: Set<NodeId> = new Set();
  private haltReason: 'aborted' | 'error' | null = null;
  private haltError: string | null = null;
  
  // Basic factory map for adapters — keyed by ProviderType
  private adapters: Record<ProviderType, IAgentAdapter> = {
    'mock':      new MockAdapter(),
    'codex':     new CodexAdapter(),
    'google':    new MockAdapter(), // MVP fallback — replace with GeminiAdapter
    'openai':    new OpenAIAdapter(),
    'anthropic': new MockAdapter(), // MVP fallback — replace with ClaudeAdapter
  };

  private constructor() {
    // Singleton
  }

  public static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  /**
   * Starts executing a workflow DAG.
   */
  public async start(
    workflow: Workflow,
    workspacePath: string,
    sender: Electron.WebContents,
    resumeFromNodeId?: NodeId
  ): Promise<void> {
    if (this.currentWorkflowId) {
      throw new Error('A workflow is already running.');
    }

    this.isHalted = false;
    this.currentWorkflowId = workflow.id;
    this.haltReason = null;
    this.haltError = null;
    const startTime = Date.now();

    try {
      await memoryManager.initWorkspace(workspacePath);
      await this.executeDag(workflow, workspacePath, sender, resumeFromNodeId);
      
      if (!this.isHalted) {
        sender.send(IpcChannels.WORKFLOW_COMPLETED, {
          workflowId: workflow.id,
          success: true,
          totalTimeMs: Date.now() - startTime
        })
      } else {
        sender.send(IpcChannels.WORKFLOW_COMPLETED, {
          workflowId: workflow.id,
          success: false,
          totalTimeMs: Date.now() - startTime,
          aborted: this.haltReason === 'aborted',
          error: this.haltError ?? undefined
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown workflow execution error'
      console.error('Workflow execution failed:', err);
      sender.send(IpcChannels.WORKFLOW_COMPLETED, {
        workflowId: workflow.id,
        success: false,
        totalTimeMs: Date.now() - startTime,
        aborted: false,
        error: errorMessage
      })
    } finally {
      this.currentWorkflowId = null
      this.activeNodes.clear()
      this.haltReason = null
      this.haltError = null
    }
  }

  /**
   * Aborts the entire workflow or a specific node.
   */
  public async abort(nodeId?: NodeId, reason: AbortReason = AbortReason.USER_REQUESTED): Promise<void> {
    if (nodeId) {
      // Abort single node
      this.isHalted = true
      this.haltReason = 'aborted'
      this.haltError = `Execution stopped for node ${nodeId}.`
      await this.abortNode(nodeId, reason)
    } else {
      // Abort entire workflow
      this.isHalted = true
      this.haltReason = 'aborted'
      this.haltError = 'Workflow aborted by user.'
      const promises = Array.from(this.activeNodes).map((id) => this.abortNode(id, reason))
      await Promise.all(promises)
    }
  }

  private async abortNode(nodeId: NodeId, reason: AbortReason): Promise<void> {
    // We send abort to all adapters. They handle ignoring if they don't own the node.
    const promises = Object.values(this.adapters).map((adapter) => adapter.abort(nodeId, reason))
    await Promise.all(promises)
  }

  private async haltActiveNodes(excludeNodeId?: NodeId): Promise<void> {
    const nodeIds = Array.from(this.activeNodes).filter((nodeId) => nodeId !== excludeNodeId)
    const promises = nodeIds.map((nodeId) => this.abortNode(nodeId, AbortReason.ENGINE_HALTED))
    await Promise.all(promises)
  }

  private sendNodeStatus(
    sender: Electron.WebContents,
    nodeId: NodeId,
    status: NodeStatus,
    error?: string,
    exitCode?: number
  ): void {
    sender.send(IpcChannels.WORKFLOW_NODE_STATUS, { nodeId, status, error, exitCode })
  }

  private markWorkflowFailed(error: string): void {
    this.isHalted = true
    this.haltReason = 'error'
    this.haltError = error
  }

  private getExecutionNodeIds(workflow: Workflow, resumeFromNodeId?: NodeId): Set<NodeId> {
    if (!resumeFromNodeId) {
      return new Set(workflow.nodes.map((node) => node.id))
    }

    const adjacency = new Map<NodeId, NodeId[]>()
    workflow.nodes.forEach((node) => {
      adjacency.set(node.id, [])
    })

    workflow.edges.forEach((edge) => {
      adjacency.get(edge.source)?.push(edge.target)
    })

    const selectedNodeIds = new Set<NodeId>()
    const queue: NodeId[] = [resumeFromNodeId]

    while (queue.length > 0) {
      const nodeId = queue.shift()!
      if (selectedNodeIds.has(nodeId)) {
        continue
      }

      selectedNodeIds.add(nodeId)
      for (const neighbor of adjacency.get(nodeId) ?? []) {
        queue.push(neighbor)
      }
    }

    return selectedNodeIds
  }

  /**
   * Executes the DAG using a topological approach.
   * Finds nodes with indegree=0, runs them, then removes them from the graph.
   */
  private async executeDag(
    workflow: Workflow,
    workspacePath: string,
    sender: Electron.WebContents,
    resumeFromNodeId?: NodeId
  ): Promise<void> {
    const executionNodeIds = this.getExecutionNodeIds(workflow, resumeFromNodeId)
    const nodes = new Map<NodeId, WorkflowNode>();
    workflow.nodes
      .filter((node) => executionNodeIds.has(node.id))
      .forEach((n) => nodes.set(n.id, n))

    const inDegree = new Map<NodeId, number>();
    const graph = new Map<NodeId, NodeId[]>();

    workflow.nodes
      .filter((node) => executionNodeIds.has(node.id))
      .forEach((n) => {
      inDegree.set(n.id, 0)
      graph.set(n.id, [])
      })

    workflow.edges.forEach((e) => {
      if (executionNodeIds.has(e.source) && executionNodeIds.has(e.target)) {
        graph.get(e.source)!.push(e.target)
        inDegree.set(e.target, inDegree.get(e.target)! + 1)
      }
    })

    const queue: NodeId[] = []
    inDegree.forEach((degree, id) => {
      if (degree === 0) queue.push(id)
    })

    // we would run independent nodes concurrently using Promise.all
    while (queue.length > 0 && !this.isHalted) {
      const currentBatch = [...queue]
      queue.length = 0 // clear queue

      // Run this batch concurrently
      const batchPromises = currentBatch.map(async (nodeId) => {
        if (this.isHalted) return

        const node = nodes.get(nodeId)!
        const previousNodes = workflow.edges
          .filter((e) => e.target === nodeId)
          .map((e) => e.source)

        const nodeCompleted = await this.runNode(node, workspacePath, previousNodes, sender)

        // After node completes successfully, unlock neighbors
        if (nodeCompleted && !this.isHalted) {
          const neighbors = graph.get(nodeId) || []
          for (const neighbor of neighbors) {
            const currentDegree = inDegree.get(neighbor)! - 1
            inDegree.set(neighbor, currentDegree)
            if (currentDegree === 0) {
              queue.push(neighbor)
            }
          }
        }
      })

      await Promise.all(batchPromises)
    }
  }

  private async runNode(
    node: WorkflowNode,
    workspacePath: string,
    previousNodeIds: NodeId[],
    sender: Electron.WebContents
  ): Promise<boolean> {
    this.activeNodes.add(node.id)
    this.sendNodeStatus(sender, node.id, 'running')

    try {
      // 1. Compile context
      const context = await memoryManager.compileContext(workspacePath, this.currentWorkflowId!, previousNodeIds)
      sender.send(IpcChannels.MEMORY_CONTEXT_READY, { nodeId: node.id, compiledContext: context })

      const promptSections = [context.trim()];
      const systemInstruction =
        typeof node.data.systemInstruction === 'string'
          ? node.data.systemInstruction.trim()
          : '';

      if (systemInstruction) {
        promptSections.push(`[SYSTEM INSTRUCTION]\n${systemInstruction}`);
      }

      promptSections.push(`[USER INSTRUCTION]\n${node.data.prompt}`);
      const fullPrompt = promptSections.filter((section) => section.length > 0).join('\n\n');
      
      const adapter = this.adapters[node.data.provider] || this.adapters.mock
      
      // Setup throttled stream dispatcher
      const batches: Record<'stdout' | 'stderr', string[]> = {
        stdout: [],
        stderr: []
      }

      const flushBatch = (): void => {
        for (const sourceType of ['stdout', 'stderr'] as const) {
          if (batches[sourceType].length === 0) {
            continue
          }

          sender.send(IpcChannels.TERMINAL_DATA_BATCH, {
            nodeId: node.id,
            batch: [...batches[sourceType]],
            sourceType
          })
          batches[sourceType] = []
        }
      }
      
      const batchInterval = setInterval(flushBatch, 100)

      // 2. Execute and stream
      let fullOutput = ''
      let result: AgentResult = {
        success: false,
        error: 'Agent execution exited without a result.'
      }
      const iterator = adapter.execute(node.id, node.data, fullPrompt, workspacePath)

      while (true) {
        const next = await iterator.next()
        if (next.done) {
          result = next.value
          break
        }

        if (this.isHalted && this.haltReason === 'aborted') {
          continue
        }

        const chunk = next.value
        if (chunk.type === 'stdout' || chunk.type === 'stderr') {
          batches[chunk.type].push(chunk.content)
          fullOutput += chunk.content
        }
      }

      clearInterval(batchInterval)
      flushBatch() // Ensure final bits are sent
      sender.send(IpcChannels.TERMINAL_EXIT, {
        nodeId: node.id,
        code: result.exitCode ?? null
      })

      if (result.abortReason) {
        this.sendNodeStatus(sender, node.id, 'stopping', result.error, result.exitCode)
        if (!this.haltReason) {
          this.isHalted = true
          this.haltReason = 'aborted'
          this.haltError = result.error ?? 'Workflow aborted.'
        }
        return false
      }

      if (!result.success) {
        const errorMessage =
          result.error ?? `Agent exited with code ${result.exitCode ?? 'unknown'}.`

        sender.send(IpcChannels.TERMINAL_ERROR, { nodeId: node.id, error: errorMessage })
        this.sendNodeStatus(sender, node.id, 'error', errorMessage, result.exitCode)
        this.markWorkflowFailed(errorMessage)
        await this.haltActiveNodes(node.id)
        return false
      }

      if (this.isHalted) {
        this.sendNodeStatus(sender, node.id, 'stopping')
        return false
      }

      // 3. Save output
      await memoryManager.saveNodeOutput(
        workspacePath,
        this.currentWorkflowId!,
        node.id,
        node.data.provider,
        node.data.model,
        fullOutput
      )
      
      this.sendNodeStatus(sender, node.id, 'completed', undefined, result.exitCode)
      sender.send(IpcChannels.WORKFLOW_NODE_OUTPUT, {
        nodeId: node.id,
        status: 'completed',
        outputFilePath: join(workspacePath, '.fluxion', 'memory', 'short-term', this.currentWorkflowId!, `${node.id}.md`)
      })

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown node execution error'
      this.sendNodeStatus(sender, node.id, 'error', errorMessage)
      sender.send(IpcChannels.TERMINAL_ERROR, { nodeId: node.id, error: errorMessage })
      this.markWorkflowFailed(errorMessage)
      await this.haltActiveNodes(node.id)
      return false
    } finally {
      this.activeNodes.delete(node.id)
    }
  }
}

export const workflowEngine = WorkflowEngine.getInstance();
