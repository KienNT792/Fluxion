import { Dirent } from 'fs'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  NodeRunState,
  ReviewSource,
  RunStatus,
  WorkflowRunState,
  WorkflowRunStateSchema
} from '@core'
import { ExecutionMode, NodeId, Workflow } from '@shared'

export interface InitializeRunOptions {
  workspacePath: string
  workflow: Workflow
  executionNodeIds: Set<NodeId>
  runId: string
  executionMode?: ExecutionMode
  startedAt?: string
}

export interface NodeCompletionUpdate {
  exitCode?: number
  runnerSessionId?: string
  outputArtifactPaths?: string[]
  completedAt?: string
  reviewSource?: ReviewSource
}

export interface NodeFailureUpdate {
  error: string
  exitCode?: number
  completedAt?: string
}

export interface ReviewResolutionUpdate {
  comment?: string
  resolvedAt?: string
}

type RunMutation<T> = (state: WorkflowRunState) => T | Promise<T>

function nowIso(): string {
  return new Date().toISOString()
}

function runFilePath(workspacePath: string, runId: string): string {
  return path.join(workspacePath, '.fluxion', 'runs', `${runId}.json`)
}

function runsDirectoryPath(workspacePath: string): string {
  return path.join(workspacePath, '.fluxion', 'runs')
}

function sortNodeIds(nodeIds: string[]): string[] {
  return [...new Set(nodeIds)].sort((a, b) => a.localeCompare(b))
}

function removeNodeId(nodeIds: string[], nodeId: string): string[] {
  return sortNodeIds(nodeIds.filter((id) => id !== nodeId))
}

function isWorkflowPendingReview(state: WorkflowRunState): boolean {
  return state.awaitingReviewNodeIds.length > 0
}

function resolveFlowContextId(state: WorkflowRunState): string {
  return state.flowContextId ?? state.runId
}

function withFlowContextFallback(state: WorkflowRunState): WorkflowRunState {
  return {
    ...state,
    flowContextId: resolveFlowContextId(state)
  }
}

export class RunStateStore {
  private readonly writeQueues = new Map<string, Promise<unknown>>()
  private readonly states = new Map<string, WorkflowRunState>()

  public async initializeRun(options: InitializeRunOptions): Promise<WorkflowRunState> {
    const startedAt = options.startedAt ?? nowIso()
    const nodes: Record<string, NodeRunState> = {}

    for (const node of options.workflow.nodes) {
      if (!options.executionNodeIds.has(node.id)) {
        continue
      }

      nodes[node.id] = {
        nodeId: node.id,
        runner: node.data.runner ?? 'codex',
        status: 'pending',
        attempts: 0,
        model: node.data.model,
        outputArtifactPaths: [],
        humanReview: node.data.humanReview ?? false
      }
    }

    const state = WorkflowRunStateSchema.parse({
      schemaVersion: 1,
      runId: options.runId,
      flowContextId: options.runId,
      workflowId: options.workflow.id,
      executionMode: options.executionMode ?? options.workflow.executionMode ?? 'auto',
      status: 'running',
      startedAt,
      updatedAt: startedAt,
      completedAt: undefined,
      currentNodeIds: [],
      awaitingReviewNodeIds: [],
      nodes
    })

    const normalizedState = withFlowContextFallback(state)
    this.states.set(this.key(options.workspacePath, options.runId), normalizedState)
    await this.writeState(options.workspacePath, normalizedState)
    return normalizedState
  }

  public async readRun(workspacePath: string, runId: string): Promise<WorkflowRunState> {
    const existing = this.states.get(this.key(workspacePath, runId))
    if (existing) {
      return structuredClone(existing)
    }

    const content = await fs.readFile(runFilePath(workspacePath, runId), 'utf8')
    const state = withFlowContextFallback(
      WorkflowRunStateSchema.parse(JSON.parse(content) as unknown)
    )
    this.states.set(this.key(workspacePath, runId), state)
    return structuredClone(state)
  }

  public async listAwaitingReviewRuns(workspacePath: string): Promise<WorkflowRunState[]> {
    const resolvedWorkspacePath = path.resolve(workspacePath)
    const directory = runsDirectoryPath(resolvedWorkspacePath)

    let entries: Dirent[]
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch (error) {
      const errorCode =
        typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
      if (errorCode === 'ENOENT') {
        return []
      }
      throw error
    }

    const states: WorkflowRunState[] = []
    for (const entry of entries) {
      if (
        !entry.isFile() ||
        !entry.name.endsWith('.json') ||
        entry.name.endsWith('.context.json')
      ) {
        continue
      }

      const filePath = path.join(directory, entry.name)
      try {
        const content = await fs.readFile(filePath, 'utf8')
        const state = withFlowContextFallback(
          WorkflowRunStateSchema.parse(JSON.parse(content) as unknown)
        )
        this.states.set(this.key(resolvedWorkspacePath, state.runId), state)

        if (state.status === 'awaiting_review' && state.awaitingReviewNodeIds.length > 0) {
          states.push(state)
        }
      } catch (error) {
        console.warn(`Skipping invalid run state file: ${filePath}`, error)
      }
    }

    states.sort((left, right) => {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    })
    return states.map((state) => structuredClone(state))
  }

  public async markNodeRunning(
    workspacePath: string,
    runId: string,
    nodeId: NodeId,
    startedAt = nowIso()
  ): Promise<WorkflowRunState> {
    return this.updateRun(workspacePath, runId, (state) => {
      const node = this.requireNode(state, nodeId)
      node.status = 'running'
      node.startedAt = node.startedAt ?? startedAt
      node.completedAt = undefined
      node.exitCode = undefined
      node.error = undefined
      node.runnerSessionId = undefined
      node.outputArtifactPaths = []
      node.reviewStatus = undefined
      node.reviewSource = undefined
      node.reviewRequestedAt = undefined
      node.reviewResolvedAt = undefined
      node.reviewComment = undefined
      node.attempts += 1
      state.status = 'running'
      state.awaitingReviewNodeIds = removeNodeId(state.awaitingReviewNodeIds, nodeId)
      state.currentNodeIds = sortNodeIds([...state.currentNodeIds, nodeId])
      return state
    })
  }

  public async markNodeCompleted(
    workspacePath: string,
    runId: string,
    nodeId: NodeId,
    update: NodeCompletionUpdate = {}
  ): Promise<WorkflowRunState> {
    return this.updateRun(workspacePath, runId, (state) => {
      const node = this.requireNode(state, nodeId)
      node.status = 'completed'
      node.completedAt = update.completedAt ?? nowIso()
      node.exitCode = update.exitCode
      node.error = undefined
      node.runnerSessionId = update.runnerSessionId
      node.outputArtifactPaths = sortNodeIds(update.outputArtifactPaths ?? [])
      state.currentNodeIds = removeNodeId(state.currentNodeIds, nodeId)
      state.awaitingReviewNodeIds = removeNodeId(state.awaitingReviewNodeIds, nodeId)
      if (!isWorkflowPendingReview(state)) {
        state.status = 'running'
      }
      return state
    })
  }

  public async markNodeAwaitingReview(
    workspacePath: string,
    runId: string,
    nodeId: NodeId,
    update: NodeCompletionUpdate = {}
  ): Promise<WorkflowRunState> {
    return this.updateRun(workspacePath, runId, (state) => {
      const node = this.requireNode(state, nodeId)
      node.status = 'awaiting_review'
      node.completedAt = update.completedAt ?? nowIso()
      node.exitCode = update.exitCode
      node.error = undefined
      node.runnerSessionId = update.runnerSessionId
      node.outputArtifactPaths = sortNodeIds(update.outputArtifactPaths ?? [])
      node.reviewSource = update.reviewSource ?? 'node'
      node.reviewStatus = 'pending'
      node.reviewRequestedAt = node.completedAt
      node.reviewResolvedAt = undefined
      node.reviewComment = undefined
      state.currentNodeIds = removeNodeId(state.currentNodeIds, nodeId)
      state.awaitingReviewNodeIds = sortNodeIds([...state.awaitingReviewNodeIds, nodeId])
      state.status = 'awaiting_review'
      return state
    })
  }

  public async markReviewApproved(
    workspacePath: string,
    runId: string,
    nodeId: NodeId,
    update: ReviewResolutionUpdate = {}
  ): Promise<WorkflowRunState> {
    return this.updateRun(workspacePath, runId, (state) => {
      const node = this.requireNode(state, nodeId)
      node.status = 'completed'
      node.reviewStatus = 'approved'
      node.reviewResolvedAt = update.resolvedAt ?? nowIso()
      node.reviewComment = update.comment
      state.awaitingReviewNodeIds = removeNodeId(state.awaitingReviewNodeIds, nodeId)
      state.status = isWorkflowPendingReview(state) ? 'awaiting_review' : 'running'
      return state
    })
  }

  public async markReviewRejected(
    workspacePath: string,
    runId: string,
    nodeId: NodeId,
    update: ReviewResolutionUpdate = {}
  ): Promise<WorkflowRunState> {
    return this.updateRun(workspacePath, runId, (state) => {
      const node = this.requireNode(state, nodeId)
      node.status = 'rejected'
      node.reviewStatus = 'rejected'
      node.reviewResolvedAt = update.resolvedAt ?? nowIso()
      node.reviewComment = update.comment
      state.awaitingReviewNodeIds = removeNodeId(state.awaitingReviewNodeIds, nodeId)
      state.status = 'rejected'
      state.currentNodeIds = removeNodeId(state.currentNodeIds, nodeId)
      return state
    })
  }

  public async resetNodeForRerun(
    workspacePath: string,
    runId: string,
    nodeId: NodeId
  ): Promise<WorkflowRunState> {
    return this.updateRun(workspacePath, runId, (state) => {
      const node = this.requireNode(state, nodeId)
      node.status = 'pending'
      node.completedAt = undefined
      node.exitCode = undefined
      node.error = undefined
      node.runnerSessionId = undefined
      node.outputArtifactPaths = []
      node.reviewStatus = undefined
      node.reviewSource = undefined
      node.reviewRequestedAt = undefined
      node.reviewResolvedAt = undefined
      node.reviewComment = undefined
      state.awaitingReviewNodeIds = removeNodeId(state.awaitingReviewNodeIds, nodeId)
      state.currentNodeIds = removeNodeId(state.currentNodeIds, nodeId)
      state.status = isWorkflowPendingReview(state) ? 'awaiting_review' : 'running'
      return state
    })
  }

  public async markNodeFailed(
    workspacePath: string,
    runId: string,
    nodeId: NodeId,
    update: NodeFailureUpdate
  ): Promise<WorkflowRunState> {
    return this.updateRun(workspacePath, runId, (state) => {
      const node = this.requireNode(state, nodeId)
      node.status = 'failed'
      node.completedAt = update.completedAt ?? nowIso()
      node.exitCode = update.exitCode
      node.error = update.error
      state.status = 'failed'
      state.currentNodeIds = removeNodeId(state.currentNodeIds, nodeId)
      state.awaitingReviewNodeIds = removeNodeId(state.awaitingReviewNodeIds, nodeId)
      return state
    })
  }

  public async markNodeAborted(
    workspacePath: string,
    runId: string,
    nodeId: NodeId,
    error: string,
    exitCode?: number
  ): Promise<WorkflowRunState> {
    return this.updateRun(workspacePath, runId, (state) => {
      const node = this.requireNode(state, nodeId)
      node.status = 'aborted'
      node.completedAt = nowIso()
      node.exitCode = exitCode
      node.error = error
      state.status = 'aborted'
      state.currentNodeIds = removeNodeId(state.currentNodeIds, nodeId)
      state.awaitingReviewNodeIds = removeNodeId(state.awaitingReviewNodeIds, nodeId)
      return state
    })
  }

  public async finalizeWorkflow(
    workspacePath: string,
    runId: string,
    status: Extract<RunStatus, 'completed' | 'failed' | 'aborted' | 'rejected'>,
    completedAt = nowIso()
  ): Promise<WorkflowRunState> {
    return this.updateRun(workspacePath, runId, (state) => {
      state.status = status
      state.completedAt = completedAt
      state.currentNodeIds = []
      return state
    })
  }

  private async updateRun(
    workspacePath: string,
    runId: string,
    mutation: RunMutation<WorkflowRunState>
  ): Promise<WorkflowRunState> {
    return this.enqueue(workspacePath, runId, async () => {
      const mapKey = this.key(workspacePath, runId)
      const state = this.states.get(mapKey) ?? (await this.readRun(workspacePath, runId))
      const updated = await mutation(structuredClone(state))
      updated.currentNodeIds = sortNodeIds(updated.currentNodeIds)
      updated.awaitingReviewNodeIds = sortNodeIds(updated.awaitingReviewNodeIds)
      updated.updatedAt = nowIso()
      const parsed = withFlowContextFallback(WorkflowRunStateSchema.parse(updated))
      this.states.set(mapKey, parsed)
      await this.writeState(workspacePath, parsed)
      return structuredClone(parsed)
    })
  }

  private enqueue<T>(
    workspacePath: string,
    runId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const queueKey = this.key(workspacePath, runId)
    const previous = this.writeQueues.get(queueKey) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(operation)
    this.writeQueues.set(
      queueKey,
      next.catch(() => undefined)
    )
    return next
  }

  private async writeState(workspacePath: string, state: WorkflowRunState): Promise<void> {
    const parsed = withFlowContextFallback(WorkflowRunStateSchema.parse(state))
    const filePath = runFilePath(workspacePath, parsed.runId)
    const directory = path.dirname(filePath)
    const tempPath = `${filePath}.tmp`
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(tempPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')

    try {
      await fs.rename(tempPath, filePath)
    } catch {
      await fs.rm(filePath, { force: true })
      await fs.rename(tempPath, filePath)
    }
  }

  private requireNode(state: WorkflowRunState, nodeId: NodeId): NodeRunState {
    const node = state.nodes[nodeId]
    if (!node) {
      throw new Error(`Node ${nodeId} is not part of run ${state.runId}.`)
    }
    return node
  }

  private key(workspacePath: string, runId: string): string {
    return `${path.resolve(workspacePath)}:${runId}`
  }
}

export const runStateStore = new RunStateStore()
