import { createHash, randomUUID } from 'crypto'
import * as path from 'path'
import { WorkflowTraceEvent, WorkflowTraceEventType } from '@core'
import {
  AbortReason,
  AgentResult,
  ExecutionMode,
  IpcChannels,
  NodeId,
  NodeStatus,
  CompiledMemoryContext,
  SaveNodeOutputParams,
  Workflow,
  WorkflowReviewActionPayload,
  WorkflowNode
} from '@shared'
import { CodexCliAdapter } from '../adapters/codex-cli.adapter'
import { IAgentAdapter } from '../adapters/base.adapter'
import { artifactGateService, ArtifactGateService, ArtifactSnapshot } from './artifact-gate-service'
import { memoryManager, MemoryManager } from './memory-manager'
import { InitializeRunOptions, runStateStore, RunStateStore } from './run-state-store'
import { workflowTraceStore, WorkflowTraceStore } from './workflow-trace-store'

export interface WorkflowEventSender {
  send(channel: string, payload: unknown): void
}

type WorkflowMemoryManager = Pick<
  MemoryManager,
  'initWorkspace' | 'compileContext' | 'saveNodeOutput' | 'getNodeOutputPath' | 'deleteNodeOutput'
> &
  Partial<Pick<MemoryManager, 'compileContextWithSources' | 'getNodeOutputHistoryPath'>>

interface WorkflowEngineDependencies {
  adapter?: IAgentAdapter
  memoryManager?: WorkflowMemoryManager
  runStateStore?: Pick<
    RunStateStore,
    | 'initializeRun'
    | 'markNodeRunning'
    | 'markNodeCompleted'
    | 'markNodeAwaitingReview'
    | 'markReviewApproved'
    | 'markReviewRejected'
    | 'resetNodeForRerun'
    | 'markNodeFailed'
    | 'markNodeAborted'
    | 'finalizeWorkflow'
  >
  artifactGateService?: Pick<
    ArtifactGateService,
    'validateRequires' | 'snapshotProduces' | 'validateProduces'
  >
  traceStore?: Pick<WorkflowTraceStore, 'append'>
}

interface WorkflowRuntime {
  workflow: Workflow
  workspacePath: string
  sender: WorkflowEventSender
  runId: string
  startTime: number
  executionNodeIds: Set<NodeId>
  nodes: Map<NodeId, WorkflowNode>
  graph: Map<NodeId, NodeId[]>
  inDegree: Map<NodeId, number>
  readyQueue: NodeId[]
  awaitingReviewNodeIds: Set<NodeId>
  executionMode: ExecutionMode
}

type HaltReason = 'aborted' | 'error' | 'rejected' | null

type NodeExecutionResult =
  | { nodeId: NodeId; kind: 'completed' }
  | { nodeId: NodeId; kind: 'awaiting_review' }
  | { nodeId: NodeId; kind: 'failed' }
  | { nodeId: NodeId; kind: 'aborted' }

function buildPrompt(node: WorkflowNode, context: string): string {
  const promptSections = [context.trim()]
  const systemInstruction =
    typeof node.data.systemInstruction === 'string' ? node.data.systemInstruction.trim() : ''

  if (systemInstruction) {
    promptSections.push(`[SYSTEM INSTRUCTION]\n${systemInstruction}`)
  }

  promptSections.push(`[USER INSTRUCTION]\n${node.data.prompt}`)
  return promptSections.filter((section) => section.length > 0).join('\n\n')
}

function createWorkflowCompletedPayload(
  workflowId: string,
  startTime: number,
  status: 'completed' | 'failed' | 'aborted' | 'rejected',
  error?: string
): {
  workflowId: string
  success: boolean
  totalTimeMs: number
  aborted?: boolean
  error?: string
} {
  return {
    workflowId,
    success: status === 'completed',
    totalTimeMs: Date.now() - startTime,
    aborted: status === 'aborted' ? true : undefined,
    error: status === 'completed' ? undefined : error
  }
}

export class WorkflowEngine {
  private static instance: WorkflowEngine

  private isHalted = false
  private haltReason: HaltReason = null
  private haltError: string | null = null
  private readonly activeNodes: Set<NodeId> = new Set()
  private readonly adapter: IAgentAdapter
  private readonly memoryManager: WorkflowMemoryManager
  private readonly runStateStore: Pick<
    RunStateStore,
    | 'initializeRun'
    | 'markNodeRunning'
    | 'markNodeCompleted'
    | 'markNodeAwaitingReview'
    | 'markReviewApproved'
    | 'markReviewRejected'
    | 'resetNodeForRerun'
    | 'markNodeFailed'
    | 'markNodeAborted'
    | 'finalizeWorkflow'
  >
  private readonly artifactGateService: Pick<
    ArtifactGateService,
    'validateRequires' | 'snapshotProduces' | 'validateProduces'
  >
  private readonly traceStore: Pick<WorkflowTraceStore, 'append'>
  private currentRuntime: WorkflowRuntime | null = null
  private continuationPromise: Promise<void> | null = null

  private constructor(dependencies: WorkflowEngineDependencies = {}) {
    this.adapter = dependencies.adapter ?? new CodexCliAdapter()
    this.memoryManager = dependencies.memoryManager ?? memoryManager
    this.runStateStore = dependencies.runStateStore ?? runStateStore
    this.artifactGateService = dependencies.artifactGateService ?? artifactGateService
    this.traceStore = dependencies.traceStore ?? workflowTraceStore
  }

  public static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine()
    }
    return WorkflowEngine.instance
  }

  public static createForTesting(dependencies: WorkflowEngineDependencies): WorkflowEngine {
    return new WorkflowEngine(dependencies)
  }

  public async start(
    workflow: Workflow,
    workspacePath: string,
    sender: WorkflowEventSender,
    resumeFromNodeId?: NodeId
  ): Promise<void> {
    if (this.currentRuntime) {
      throw new Error('A workflow is already running.')
    }

    this.resetRuntimeFlags()
    const runId = randomUUID()
    const startTime = Date.now()
    const executionNodeIds = this.getExecutionNodeIds(workflow, resumeFromNodeId)

    try {
      await this.memoryManager.initWorkspace(workspacePath)
      await this.runStateStore.initializeRun({
        workspacePath,
        workflow,
        executionNodeIds,
        runId,
        executionMode: workflow.executionMode ?? 'auto'
      } satisfies InitializeRunOptions)

      const runtime = this.createRuntime(
        workflow,
        workspacePath,
        sender,
        runId,
        startTime,
        executionNodeIds
      )
      this.currentRuntime = runtime

      await this.trace(runtime, 'workflow.started', undefined, {
        executionMode: runtime.executionMode,
        nodeCount: runtime.nodes.size,
        resumeFromNodeId
      })

      await this.continueCurrentRuntime()
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown workflow execution error'
      console.error('Workflow execution failed:', error)

      if (this.currentRuntime?.runId === runId) {
        this.markWorkflowFailed(errorMessage)
        await this.finalizeRuntime(this.getFinalRunStatus(), errorMessage)
        return
      }

      sender.send(
        IpcChannels.WORKFLOW_COMPLETED,
        createWorkflowCompletedPayload(workflow.id, startTime, 'failed', errorMessage)
      )
    }
  }

  public async approveReview(payload: WorkflowReviewActionPayload): Promise<void> {
    const runtime = this.requireReviewRuntime(payload)
    if (!runtime.awaitingReviewNodeIds.has(payload.nodeId)) {
      throw new Error(`Node ${payload.nodeId} is not awaiting review.`)
    }

    await this.runStateStore.markReviewApproved(
      runtime.workspacePath,
      runtime.runId,
      payload.nodeId,
      {
        comment: payload.comment
      }
    )
    await this.trace(runtime, 'node.review_approved', payload.nodeId, {
      hasComment: Boolean(payload.comment?.trim())
    })
    runtime.awaitingReviewNodeIds.delete(payload.nodeId)
    this.sendNodeStatus(runtime.sender, payload.nodeId, 'completed')
    this.unlockNeighbors(runtime, payload.nodeId)

    if (runtime.awaitingReviewNodeIds.size === 0 && !this.isHalted) {
      await this.continueCurrentRuntime()
    }
  }

  public async rejectReview(payload: WorkflowReviewActionPayload): Promise<void> {
    const runtime = this.requireReviewRuntime(payload)
    if (!runtime.awaitingReviewNodeIds.has(payload.nodeId)) {
      throw new Error(`Node ${payload.nodeId} is not awaiting review.`)
    }

    const errorMessage = payload.comment?.trim()
      ? `Review rejected for node ${payload.nodeId}: ${payload.comment.trim()}`
      : `Review rejected for node ${payload.nodeId}.`

    await this.runStateStore.markReviewRejected(
      runtime.workspacePath,
      runtime.runId,
      payload.nodeId,
      {
        comment: payload.comment
      }
    )
    await this.trace(runtime, 'node.review_rejected', payload.nodeId, {
      error: errorMessage,
      hasComment: Boolean(payload.comment?.trim())
    })
    runtime.awaitingReviewNodeIds.delete(payload.nodeId)
    this.sendNodeStatus(runtime.sender, payload.nodeId, 'error', errorMessage)
    this.isHalted = true
    this.haltReason = 'rejected'
    this.haltError = errorMessage
    await this.finalizeRuntime('rejected', errorMessage)
  }

  public async rerunReviewNode(payload: WorkflowReviewActionPayload): Promise<void> {
    const runtime = this.requireReviewRuntime(payload)
    if (!runtime.awaitingReviewNodeIds.has(payload.nodeId)) {
      throw new Error(`Node ${payload.nodeId} is not awaiting review.`)
    }

    const node = runtime.nodes.get(payload.nodeId)
    if (!node) {
      throw new Error(`Node ${payload.nodeId} is not part of the active workflow run.`)
    }

    runtime.awaitingReviewNodeIds.delete(payload.nodeId)
    await this.trace(runtime, 'node.rerun_requested', payload.nodeId, {
      hasComment: Boolean(payload.comment?.trim())
    })
    await this.runStateStore.resetNodeForRerun(runtime.workspacePath, runtime.runId, payload.nodeId)
    await this.memoryManager.deleteNodeOutput(
      runtime.workspacePath,
      runtime.workflow.id,
      payload.nodeId
    )
    runtime.sender.send(IpcChannels.WORKFLOW_NODE_OUTPUT, {
      nodeId: payload.nodeId,
      status: 'idle',
      outputFilePath: undefined
    })
    this.sendNodeStatus(runtime.sender, payload.nodeId, 'idle')

    const previousNodeIds = this.getPreviousNodeIds(runtime, payload.nodeId)
    const rerunResult = await this.runNode(node, runtime, previousNodeIds)
    await this.handleNodeResult(runtime, rerunResult)

    if (this.isHalted) {
      await this.finalizeRuntime(this.getFinalRunStatus(), this.haltError ?? undefined)
      return
    }

    if (runtime.awaitingReviewNodeIds.size === 0 && runtime.readyQueue.length > 0) {
      await this.continueCurrentRuntime()
      return
    }

    if (runtime.awaitingReviewNodeIds.size === 0) {
      await this.finalizeRuntime('completed')
    }
  }

  public async abort(
    nodeId?: NodeId,
    reason: AbortReason = AbortReason.USER_REQUESTED
  ): Promise<void> {
    if (!this.currentRuntime) {
      throw new Error('No active workflow runtime is available to abort.')
    }

    if (nodeId) {
      this.isHalted = true
      this.haltReason = 'aborted'
      this.haltError = `Execution stopped for node ${nodeId}.`
      this.sendNodeStatus(this.currentRuntime.sender, nodeId, 'stopping', this.haltError)
      await this.abortNode(nodeId, reason)
    } else {
      this.isHalted = true
      this.haltReason = 'aborted'
      this.haltError = 'Workflow aborted by user.'
      for (const id of this.activeNodes) {
        this.sendNodeStatus(this.currentRuntime.sender, id, 'stopping', this.haltError)
      }
      const promises = Array.from(this.activeNodes).map((id) => this.abortNode(id, reason))
      await Promise.all(promises)
    }

    if (this.currentRuntime.awaitingReviewNodeIds.size > 0 && this.activeNodes.size === 0) {
      const runtime = this.currentRuntime
      for (const reviewNodeId of runtime.awaitingReviewNodeIds) {
        this.sendNodeStatus(runtime.sender, reviewNodeId, 'stopping', this.haltError ?? undefined)
        await this.runStateStore.markNodeAborted(
          runtime.workspacePath,
          runtime.runId,
          reviewNodeId,
          this.haltError ?? 'Workflow aborted by user.'
        )
        await this.trace(runtime, 'node.aborted', reviewNodeId, {
          error: this.haltError ?? 'Workflow aborted by user.',
          abortReason: reason,
          awaitingReview: true
        })
      }
      runtime.awaitingReviewNodeIds.clear()
      await this.finalizeRuntime('aborted', this.haltError ?? 'Workflow aborted by user.')
    }
  }

  private async abortNode(nodeId: NodeId, reason: AbortReason): Promise<void> {
    await this.adapter.abort(nodeId, reason)
  }

  private async haltActiveNodes(excludeNodeId?: NodeId): Promise<void> {
    const nodeIds = Array.from(this.activeNodes).filter((nodeId) => nodeId !== excludeNodeId)
    const promises = nodeIds.map((nodeId) => this.abortNode(nodeId, AbortReason.ENGINE_HALTED))
    await Promise.all(promises)
  }

  private sendNodeStatus(
    sender: WorkflowEventSender,
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

  private async trace(
    runtime: WorkflowRuntime,
    type: WorkflowTraceEventType,
    nodeId?: NodeId,
    data: Record<string, unknown> = {}
  ): Promise<void> {
    const event: WorkflowTraceEvent = {
      schemaVersion: 1,
      runId: runtime.runId,
      workflowId: runtime.workflow.id,
      type,
      timestamp: new Date().toISOString()
    }

    if (nodeId) {
      event.nodeId = nodeId
    }
    if (Object.keys(data).length > 0) {
      event.data = data
    }

    await this.traceStore.append(runtime.workspacePath, event)
  }

  private toWorkspaceRelative(workspacePath: string, absolutePath: string): string {
    return path.relative(workspacePath, absolutePath).replaceAll(path.sep, '/')
  }

  private async compileNodeContext(
    workspacePath: string,
    workflowId: string,
    previousNodeIds: NodeId[]
  ): Promise<CompiledMemoryContext> {
    if (this.memoryManager.compileContextWithSources) {
      return this.memoryManager.compileContextWithSources(
        workspacePath,
        workflowId,
        previousNodeIds
      )
    }

    const compiledContext = await this.memoryManager.compileContext(
      workspacePath,
      workflowId,
      previousNodeIds
    )
    return {
      compiledContext,
      sources: [],
      contextHash: createHash('sha256').update(compiledContext, 'utf8').digest('hex'),
      contextBytes: Buffer.byteLength(compiledContext, 'utf8'),
      contextChars: compiledContext.length
    }
  }

  private getFinalRunStatus(): 'completed' | 'failed' | 'aborted' | 'rejected' {
    if (this.haltReason === 'aborted') {
      return 'aborted'
    }

    if (this.haltReason === 'rejected') {
      return 'rejected'
    }

    if (this.isHalted) {
      return 'failed'
    }

    return 'completed'
  }

  private getWorkflowFinalTraceType(
    status: 'completed' | 'failed' | 'aborted' | 'rejected'
  ): WorkflowTraceEventType {
    switch (status) {
      case 'completed':
        return 'workflow.completed'
      case 'aborted':
        return 'workflow.aborted'
      case 'rejected':
        return 'workflow.rejected'
      case 'failed':
      default:
        return 'workflow.failed'
    }
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

  private createRuntime(
    workflow: Workflow,
    workspacePath: string,
    sender: WorkflowEventSender,
    runId: string,
    startTime: number,
    executionNodeIds: Set<NodeId>
  ): WorkflowRuntime {
    const nodes = new Map<NodeId, WorkflowNode>()
    workflow.nodes
      .filter((node) => executionNodeIds.has(node.id))
      .forEach((node) => nodes.set(node.id, node))

    const inDegree = new Map<NodeId, number>()
    const graph = new Map<NodeId, NodeId[]>()

    workflow.nodes
      .filter((node) => executionNodeIds.has(node.id))
      .forEach((node) => {
        inDegree.set(node.id, 0)
        graph.set(node.id, [])
      })

    workflow.edges.forEach((edge) => {
      if (executionNodeIds.has(edge.source) && executionNodeIds.has(edge.target)) {
        graph.get(edge.source)?.push(edge.target)
        inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
      }
    })

    const readyQueue: NodeId[] = []
    inDegree.forEach((degree, id) => {
      if (degree === 0) {
        readyQueue.push(id)
      }
    })

    return {
      workflow,
      workspacePath,
      sender,
      runId,
      startTime,
      executionNodeIds,
      nodes,
      graph,
      inDegree,
      readyQueue,
      awaitingReviewNodeIds: new Set<NodeId>(),
      executionMode: workflow.executionMode ?? 'auto'
    }
  }

  private getReviewSource(runtime: WorkflowRuntime, node: WorkflowNode): 'node' | 'manual' | null {
    if (runtime.executionMode === 'manual') {
      return 'manual'
    }

    return node.data.humanReview ? 'node' : null
  }

  private async continueCurrentRuntime(): Promise<void> {
    if (!this.currentRuntime) {
      return
    }

    if (this.continuationPromise) {
      await this.continuationPromise
      return
    }

    const continuation = this.performContinuation(this.currentRuntime).finally(() => {
      if (this.continuationPromise === continuation) {
        this.continuationPromise = null
      }
    })

    this.continuationPromise = continuation
    await continuation
  }

  private async performContinuation(runtime: WorkflowRuntime): Promise<void> {
    while (runtime.readyQueue.length > 0 && !this.isHalted) {
      const currentBatch = [...runtime.readyQueue]
      runtime.readyQueue = []

      const batchResults = await Promise.all(
        currentBatch.map(async (nodeId) => {
          const node = runtime.nodes.get(nodeId)
          if (!node) {
            throw new Error(`Node ${nodeId} is missing from the runtime graph.`)
          }

          const previousNodeIds = this.getPreviousNodeIds(runtime, nodeId)
          await this.trace(runtime, 'node.ready', nodeId, {
            previousNodeIds
          })
          return this.runNode(node, runtime, previousNodeIds)
        })
      )

      for (const result of batchResults) {
        await this.handleNodeResult(runtime, result)
      }

      if (this.isHalted) {
        await this.finalizeRuntime(this.getFinalRunStatus(), this.haltError ?? undefined)
        return
      }

      if (runtime.awaitingReviewNodeIds.size > 0) {
        return
      }
    }

    if (this.isHalted) {
      await this.finalizeRuntime(this.getFinalRunStatus(), this.haltError ?? undefined)
      return
    }

    if (runtime.awaitingReviewNodeIds.size > 0) {
      return
    }

    await this.finalizeRuntime('completed')
  }

  private async handleNodeResult(
    runtime: WorkflowRuntime,
    result: NodeExecutionResult
  ): Promise<void> {
    if (result.kind === 'completed') {
      this.unlockNeighbors(runtime, result.nodeId)
      return
    }

    if (result.kind === 'awaiting_review') {
      runtime.awaitingReviewNodeIds.add(result.nodeId)
    }
  }

  private async runNode(
    node: WorkflowNode,
    runtime: WorkflowRuntime,
    previousNodeIds: NodeId[]
  ): Promise<NodeExecutionResult> {
    try {
      await this.ensureRequiredArtifacts(runtime.workspacePath, node)
      await this.trace(runtime, 'node.requires_validated', node.id, {
        requiresCount: node.data.requires?.length ?? 0
      })
      const produceSnapshots = await this.artifactGateService.snapshotProduces(
        runtime.workspacePath,
        node.data.produces ?? []
      )
      await this.trace(runtime, 'node.produces_snapshot', node.id, {
        producesCount: node.data.produces?.length ?? 0,
        existingCount: produceSnapshots.filter((snapshot) => snapshot.exists).length
      })
      const runningState = await this.runStateStore.markNodeRunning(
        runtime.workspacePath,
        runtime.runId,
        node.id
      )
      const startedAt = runningState.nodes[node.id]?.startedAt ?? new Date().toISOString()
      const attempt = runningState.nodes[node.id]?.attempts

      this.activeNodes.add(node.id)
      this.sendNodeStatus(runtime.sender, node.id, 'running')
      await this.trace(runtime, 'node.running', node.id, {
        attempt,
        startedAt
      })

      const contextReport = await this.compileNodeContext(
        runtime.workspacePath,
        runtime.workflow.id,
        previousNodeIds
      )
      const context = contextReport.compiledContext
      runtime.sender.send(IpcChannels.MEMORY_CONTEXT_READY, {
        nodeId: node.id,
        compiledContext: context
      })
      await this.trace(runtime, 'node.context_compiled', node.id, {
        previousNodeIds,
        contextBytes: contextReport.contextBytes,
        contextChars: contextReport.contextChars,
        contextHash: contextReport.contextHash,
        sources: contextReport.sources
      })

      const fullPrompt = buildPrompt(node, context)
      await this.trace(runtime, 'node.execution_started', node.id, {
        runner: node.data.runner ?? 'codex',
        provider: node.data.provider,
        model: node.data.model,
        promptBytes: Buffer.byteLength(fullPrompt, 'utf8')
      })
      const result = await this.executeNode(node, fullPrompt, runtime)
      await this.trace(runtime, 'node.execution_completed', node.id, {
        success: result.success,
        exitCode: result.exitCode,
        aborted: Boolean(result.abortReason),
        abortReason: result.abortReason,
        outputBytes: Buffer.byteLength(result.output ?? '', 'utf8')
      })
      if (result.processTelemetry) {
        await this.trace(runtime, 'node.process_exited', node.id, {
          ...result.processTelemetry
        })
      }

      runtime.sender.send(IpcChannels.TERMINAL_EXIT, {
        nodeId: node.id,
        code: result.exitCode ?? null
      })

      if (result.abortReason) {
        const errorMessage = result.error ?? 'Workflow aborted.'
        this.sendNodeStatus(runtime.sender, node.id, 'stopping', errorMessage, result.exitCode)
        await this.runStateStore.markNodeAborted(
          runtime.workspacePath,
          runtime.runId,
          node.id,
          errorMessage,
          result.exitCode
        )
        if (!this.haltReason) {
          this.isHalted = true
          this.haltReason = 'aborted'
          this.haltError = errorMessage
        }
        await this.trace(runtime, 'node.aborted', node.id, {
          error: errorMessage,
          exitCode: result.exitCode,
          abortReason: result.abortReason
        })
        return { nodeId: node.id, kind: 'aborted' }
      }

      if (!result.success) {
        const errorMessage =
          result.error ?? `Agent exited with code ${result.exitCode ?? 'unknown'}.`
        runtime.sender.send(IpcChannels.TERMINAL_ERROR, { nodeId: node.id, error: errorMessage })
        this.sendNodeStatus(runtime.sender, node.id, 'error', errorMessage, result.exitCode)
        await this.runStateStore.markNodeFailed(runtime.workspacePath, runtime.runId, node.id, {
          error: errorMessage,
          exitCode: result.exitCode
        })
        await this.trace(runtime, 'node.failed', node.id, {
          error: errorMessage,
          exitCode: result.exitCode
        })
        this.markWorkflowFailed(errorMessage)
        await this.haltActiveNodes(node.id)
        return { nodeId: node.id, kind: 'failed' }
      }

      if (this.isHalted) {
        const errorMessage = this.haltError ?? 'Workflow halted before node completion.'
        this.sendNodeStatus(runtime.sender, node.id, 'stopping', errorMessage, result.exitCode)
        await this.runStateStore.markNodeAborted(
          runtime.workspacePath,
          runtime.runId,
          node.id,
          errorMessage,
          result.exitCode
        )
        await this.trace(runtime, 'node.aborted', node.id, {
          error: errorMessage,
          exitCode: result.exitCode
        })
        return { nodeId: node.id, kind: 'aborted' }
      }

      const producedPaths = await this.ensureProducedArtifacts(
        runtime.workspacePath,
        node,
        produceSnapshots
      )
      await this.trace(runtime, 'node.produces_validated', node.id, {
        producesCount: node.data.produces?.length ?? 0,
        artifactPaths: producedPaths
      })
      const completedAt = new Date().toISOString()
      const outputFilePath = await this.memoryManager.saveNodeOutput(
        runtime.workspacePath,
        runtime.workflow.id,
        this.createSaveNodeOutputParams(
          node,
          runtime.runId,
          startedAt,
          completedAt,
          result,
          attempt
        )
      )
      const historyOutputFilePath =
        attempt !== undefined && this.memoryManager.getNodeOutputHistoryPath
          ? this.memoryManager.getNodeOutputHistoryPath(
              runtime.workspacePath,
              runtime.workflow.id,
              runtime.runId,
              node.id,
              attempt
            )
          : undefined
      await this.trace(runtime, 'node.output_saved', node.id, {
        outputFilePath: this.toWorkspaceRelative(runtime.workspacePath, outputFilePath),
        historyOutputFilePath: historyOutputFilePath
          ? this.toWorkspaceRelative(runtime.workspacePath, historyOutputFilePath)
          : undefined,
        attempt,
        completedAt
      })

      const reviewSource = this.getReviewSource(runtime, node)
      if (reviewSource) {
        await this.runStateStore.markNodeAwaitingReview(
          runtime.workspacePath,
          runtime.runId,
          node.id,
          {
            completedAt,
            exitCode: result.exitCode,
            runnerSessionId: result.runnerSessionId,
            outputArtifactPaths: producedPaths,
            reviewSource
          }
        )
        runtime.sender.send(IpcChannels.WORKFLOW_NODE_OUTPUT, {
          nodeId: node.id,
          status: 'paused',
          outputFilePath
        })
        this.sendNodeStatus(runtime.sender, node.id, 'paused', undefined, result.exitCode)
        runtime.sender.send(IpcChannels.WORKFLOW_REVIEW_REQUIRED, {
          workflowId: runtime.workflow.id,
          runId: runtime.runId,
          nodeId: node.id,
          outputFilePath,
          status: 'awaiting_review'
        })
        await this.trace(runtime, 'node.review_requested', node.id, {
          reviewSource,
          outputFilePath: this.toWorkspaceRelative(runtime.workspacePath, outputFilePath)
        })
        return { nodeId: node.id, kind: 'awaiting_review' }
      }

      await this.runStateStore.markNodeCompleted(runtime.workspacePath, runtime.runId, node.id, {
        completedAt,
        exitCode: result.exitCode,
        runnerSessionId: result.runnerSessionId,
        outputArtifactPaths: producedPaths
      })

      this.sendNodeStatus(runtime.sender, node.id, 'completed', undefined, result.exitCode)
      runtime.sender.send(IpcChannels.WORKFLOW_NODE_OUTPUT, {
        nodeId: node.id,
        status: 'completed',
        outputFilePath
      })

      return { nodeId: node.id, kind: 'completed' }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown node execution error'
      runtime.sender.send(IpcChannels.TERMINAL_ERROR, { nodeId: node.id, error: errorMessage })
      this.sendNodeStatus(runtime.sender, node.id, 'error', errorMessage)

      try {
        await this.runStateStore.markNodeFailed(runtime.workspacePath, runtime.runId, node.id, {
          error: errorMessage
        })
      } catch {
        // Keep the original node execution error as the primary failure signal.
      }

      await this.trace(runtime, 'node.failed', node.id, {
        error: errorMessage
      })
      this.markWorkflowFailed(errorMessage)
      await this.haltActiveNodes(node.id)
      return { nodeId: node.id, kind: 'failed' }
    } finally {
      this.activeNodes.delete(node.id)
    }
  }

  private async executeNode(
    node: WorkflowNode,
    fullPrompt: string,
    runtime: WorkflowRuntime
  ): Promise<AgentResult> {
    const batches: Record<'stdout' | 'stderr', string[]> = {
      stdout: [],
      stderr: []
    }

    const flushBatch = (): void => {
      for (const sourceType of ['stdout', 'stderr'] as const) {
        if (batches[sourceType].length === 0) {
          continue
        }

        runtime.sender.send(IpcChannels.TERMINAL_DATA_BATCH, {
          nodeId: node.id,
          batch: [...batches[sourceType]],
          sourceType
        })
        batches[sourceType] = []
      }
    }

    const batchInterval = setInterval(flushBatch, 100)

    try {
      let fullOutput = ''
      let result: AgentResult = {
        success: false,
        error: 'Agent execution exited without a result.'
      }
      const iterator = this.adapter.execute(node.id, node.data, fullPrompt, runtime.workspacePath)

      while (true) {
        const next = await iterator.next()
        if (next.done) {
          result = next.value
          break
        }

        const chunk = next.value
        if (chunk.type === 'process-started') {
          await this.trace(runtime, 'node.process_spawned', node.id, {
            pid: chunk.pid,
            displayCommand: chunk.displayCommand,
            startedAt: chunk.startedAt
          })
          continue
        }

        if (this.isHalted && this.haltReason === 'aborted') {
          continue
        }

        if (chunk.type === 'stdout' || chunk.type === 'stderr') {
          batches[chunk.type].push(chunk.content)
          fullOutput += chunk.content
        }
      }

      return {
        ...result,
        output: result.output ?? fullOutput
      }
    } finally {
      clearInterval(batchInterval)
      flushBatch()
    }
  }

  private async ensureRequiredArtifacts(workspacePath: string, node: WorkflowNode): Promise<void> {
    const result = await this.artifactGateService.validateRequires(
      workspacePath,
      node.data.requires ?? []
    )

    if (result.valid) {
      return
    }

    throw new Error(result.error ?? `Required artifact validation failed for node ${node.id}.`)
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
    )

    if (result.valid) {
      return result.artifactPaths
    }

    throw new Error(result.error ?? `Produced artifact validation failed for node ${node.id}.`)
  }

  private createSaveNodeOutputParams(
    node: WorkflowNode,
    runId: string,
    startedAt: string,
    completedAt: string,
    result: AgentResult,
    attempt?: number
  ): SaveNodeOutputParams {
    return {
      runId,
      nodeId: node.id,
      attempt,
      runner: node.data.runner ?? 'codex',
      model: node.data.model,
      status: 'completed',
      startedAt,
      completedAt,
      exitCode: result.exitCode,
      runnerSessionId: result.runnerSessionId,
      provider: node.data.provider,
      content: result.output ?? ''
    }
  }

  private unlockNeighbors(runtime: WorkflowRuntime, nodeId: NodeId): void {
    const neighbors = runtime.graph.get(nodeId) ?? []
    for (const neighbor of neighbors) {
      const nextDegree = (runtime.inDegree.get(neighbor) ?? 0) - 1
      runtime.inDegree.set(neighbor, nextDegree)
      if (nextDegree === 0) {
        runtime.readyQueue.push(neighbor)
      }
    }
  }

  private getPreviousNodeIds(runtime: WorkflowRuntime, nodeId: NodeId): NodeId[] {
    return runtime.workflow.edges
      .filter(
        (edge) =>
          edge.target === nodeId &&
          runtime.executionNodeIds.has(edge.source) &&
          runtime.executionNodeIds.has(edge.target)
      )
      .map((edge) => edge.source)
  }

  private requireReviewRuntime(payload: WorkflowReviewActionPayload): WorkflowRuntime {
    if (!this.currentRuntime) {
      throw new Error(
        'No active workflow runtime is available. Review recovery after app restart is not implemented in P3.'
      )
    }

    if (this.currentRuntime.workflow.id !== payload.workflowId) {
      throw new Error(`Workflow ${payload.workflowId} is not the active runtime.`)
    }

    if (this.currentRuntime.runId !== payload.runId) {
      throw new Error(`Run ${payload.runId} is not the active runtime.`)
    }

    if (!this.currentRuntime.executionNodeIds.has(payload.nodeId)) {
      throw new Error(`Node ${payload.nodeId} is not part of the active workflow run.`)
    }

    return this.currentRuntime
  }

  private async finalizeRuntime(
    status: 'completed' | 'failed' | 'aborted' | 'rejected',
    error?: string
  ): Promise<void> {
    const runtime = this.currentRuntime
    if (!runtime) {
      return
    }

    await this.runStateStore.finalizeWorkflow(runtime.workspacePath, runtime.runId, status)
    await this.trace(runtime, this.getWorkflowFinalTraceType(status), undefined, {
      status,
      success: status === 'completed',
      totalTimeMs: Date.now() - runtime.startTime,
      error
    })
    runtime.sender.send(
      IpcChannels.WORKFLOW_COMPLETED,
      createWorkflowCompletedPayload(runtime.workflow.id, runtime.startTime, status, error)
    )
    this.cleanupRuntime(runtime.runId)
  }

  private cleanupRuntime(runId: string): void {
    if (this.currentRuntime?.runId === runId) {
      this.currentRuntime = null
    }
    this.activeNodes.clear()
    this.resetRuntimeFlags()
  }

  private resetRuntimeFlags(): void {
    this.isHalted = false
    this.haltReason = null
    this.haltError = null
  }
}

export const workflowEngine = WorkflowEngine.getInstance()
