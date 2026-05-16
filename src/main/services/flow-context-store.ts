import { createHash } from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  ContextCommitResult,
  ContextCommitResultSchema,
  ContextDelta,
  ContextDeltaSchema,
  FlowContextDocument,
  FlowContextDocumentSchema,
  FlowContextLatestSnapshot
} from '@core'

export interface InitializeRunContextOptions {
  workspacePath: string
  runId: string
  workflowId: string
  flowContextId: string
  createdAt?: string
}

export interface CommitDeltaOptions {
  workspacePath: string
  runId: string
  delta: ContextDelta
  commitState: string
}

export interface CommitDeltaResult {
  commitResult: ContextCommitResult
  idempotentReplay: boolean
}

type WriteOperation<T> = () => Promise<T>

function nowIso(): string {
  return new Date().toISOString()
}

function runStateRef(runId: string): string {
  return `.fluxion/runs/${runId}.json`
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item))
  }

  if (typeof value !== 'object' || value === null) {
    return value
  }

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = sortJsonValue((value as Record<string, unknown>)[key])
      return result
    }, {})
}

function hashLatestSnapshot(snapshot: Omit<FlowContextLatestSnapshot, 'hash'>): string {
  return createHash('sha256')
    .update(JSON.stringify(sortJsonValue(snapshot)), 'utf8')
    .digest('hex')
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

function upsertRefsByPath<T extends { path: string }>(existing: T[], incoming: T[]): T[] {
  const merged = existing.map((item) => structuredClone(item))
  const indexes = new Map(merged.map((item, index) => [item.path, index]))

  for (const item of incoming) {
    const existingIndex = indexes.get(item.path)
    if (existingIndex === undefined) {
      indexes.set(item.path, merged.length)
      merged.push(structuredClone(item))
      continue
    }

    merged[existingIndex] = {
      ...merged[existingIndex],
      ...structuredClone(item)
    }
  }

  return merged
}

export class FlowContextStore {
  private readonly writeQueues = new Map<string, Promise<unknown>>()

  public getContextPath(workspacePath: string, runId: string): string {
    return path.join(workspacePath, '.fluxion', 'runs', `${runId}.context.json`)
  }

  public async initializeRunContext(
    options: InitializeRunContextOptions
  ): Promise<FlowContextDocument> {
    try {
      const existing = await this.readRunContext(options.workspacePath, options.runId)
      if (
        existing.runId !== options.runId ||
        existing.flowContextId !== options.flowContextId ||
        existing.workflowId !== options.workflowId
      ) {
        throw new Error(
          `Flow context file for run ${options.runId} does not match the requested run identity.`
        )
      }
      return existing
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error
      }
    }

    const createdAt = options.createdAt ?? nowIso()
    const latestSnapshot = {
      memorySourceRefs: [],
      artifactRefs: [],
      runStateRef: runStateRef(options.runId),
      providerState: {},
      semanticSummary: ''
    }
    const document = FlowContextDocumentSchema.parse({
      schemaVersion: 1,
      flowContextId: options.flowContextId,
      runId: options.runId,
      workflowId: options.workflowId,
      version: 1,
      createdAt,
      updatedAt: createdAt,
      latestSnapshot: {
        ...latestSnapshot,
        hash: hashLatestSnapshot(latestSnapshot)
      },
      deltas: []
    })

    return this.writeRunContext(options.workspacePath, document)
  }

  public async readRunContext(workspacePath: string, runId: string): Promise<FlowContextDocument> {
    const contextPath = this.getContextPath(workspacePath, runId)
    const content = await fs.readFile(contextPath, 'utf8')
    return structuredClone(
      FlowContextDocumentSchema.parse(JSON.parse(content) as unknown)
    ) as FlowContextDocument
  }

  public async commitDelta(options: CommitDeltaOptions): Promise<CommitDeltaResult> {
    const delta = ContextDeltaSchema.parse(options.delta)
    const contextPath = this.getContextPath(options.workspacePath, options.runId)

    return this.enqueue(contextPath, async () => {
      const current = await this.readRunContext(options.workspacePath, options.runId)
      if (
        current.runId !== delta.runId ||
        current.flowContextId !== delta.flowContextId ||
        current.workflowId !== delta.workflowId
      ) {
        throw new Error(
          `Flow context delta ${delta.idempotencyKey} does not match the current run context identity.`
        )
      }
      const duplicateIndex = current.deltas.findIndex(
        (existingDelta) => existingDelta.idempotencyKey === delta.idempotencyKey
      )

      if (duplicateIndex !== -1) {
        return {
          commitResult: ContextCommitResultSchema.parse({
            schemaVersion: 1,
            flowContextId: current.flowContextId,
            version: duplicateIndex + 2,
            committed: true,
            commitState: options.commitState,
            deltaIdempotencyKey: delta.idempotencyKey
          }),
          idempotentReplay: true
        }
      }

      const nextRunStateRef =
        typeof delta.runStateUpdates.runStateRef === 'string'
          ? delta.runStateUpdates.runStateRef
          : current.latestSnapshot.runStateRef
      const snapshotWithoutHash: Omit<FlowContextLatestSnapshot, 'hash'> = {
        memorySourceRefs: upsertRefsByPath(
          current.latestSnapshot.memorySourceRefs,
          delta.memoryRefsAdded
        ),
        artifactRefs: upsertRefsByPath(
          current.latestSnapshot.artifactRefs,
          delta.artifactRefsAddedOrValidated
        ),
        runStateRef: nextRunStateRef,
        providerState: {
          ...structuredClone(current.latestSnapshot.providerState),
          ...structuredClone(delta.providerStateUpdates)
        },
        semanticSummary:
          (options.commitState === 'completed' || options.commitState === 'review_approved') &&
          delta.semanticSummaryUpdate.trim().length > 0
            ? delta.semanticSummaryUpdate
            : current.latestSnapshot.semanticSummary
      }

      const updated = FlowContextDocumentSchema.parse({
        ...current,
        version: current.version + 1,
        updatedAt: nowIso(),
        latestSnapshot: {
          ...snapshotWithoutHash,
          hash: hashLatestSnapshot(snapshotWithoutHash)
        },
        deltas: [...current.deltas, delta]
      })

      await this.writeDocument(contextPath, updated)

      return {
        commitResult: ContextCommitResultSchema.parse({
          schemaVersion: 1,
          flowContextId: updated.flowContextId,
          version: updated.version,
          committed: true,
          commitState: options.commitState,
          deltaIdempotencyKey: delta.idempotencyKey
        }),
        idempotentReplay: false
      }
    })
  }

  private async writeDocument(contextPath: string, document: FlowContextDocument): Promise<void> {
    const directory = path.dirname(contextPath)
    const tempPath = `${contextPath}.tmp`
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(tempPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')

    try {
      await fs.rename(tempPath, contextPath)
    } catch {
      await fs.rm(contextPath, { force: true })
      await fs.rename(tempPath, contextPath)
    }
  }

  private enqueue<T>(contextPath: string, operation: WriteOperation<T>): Promise<T> {
    const queueKey = path.resolve(contextPath)
    const previous = this.writeQueues.get(queueKey) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(operation)
    this.writeQueues.set(
      queueKey,
      next.catch(() => undefined)
    )
    return next
  }

  private async writeRunContext(
    workspacePath: string,
    document: FlowContextDocument
  ): Promise<FlowContextDocument> {
    const parsed = FlowContextDocumentSchema.parse(document)
    const contextPath = this.getContextPath(workspacePath, parsed.runId)

    return this.enqueue(contextPath, async () => {
      await this.writeDocument(contextPath, parsed)
      return structuredClone(parsed) as FlowContextDocument
    })
  }
}

export const flowContextStore = new FlowContextStore()
