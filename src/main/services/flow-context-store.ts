import { createHash } from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  ContextArtifactRef,
  ContextCommitResult,
  ContextCommitResultSchema,
  ContextDelta,
  ContextDeltaSchema,
  ContextMemorySourceRef,
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
type ContextRef = ContextMemorySourceRef | ContextArtifactRef

interface MergeConflict {
  path: string
  kind: string
  reason: string
}

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

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value)) ?? 'undefined'
}

function isDeepEqual(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right)
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function sortRefsByPath<T extends ContextRef>(refs: T[]): T[] {
  return refs
    .map((ref) => structuredClone(ref))
    .sort((left, right) => {
      const pathCompare = left.path.localeCompare(right.path)
      return pathCompare === 0
        ? stableStringify(left).localeCompare(stableStringify(right))
        : pathCompare
    })
}

function findRefConflict<T extends ContextRef>(
  committedAfterBase: T[],
  incoming: T[],
  kind: 'memory_ref' | 'artifact_ref'
): MergeConflict | undefined {
  const incomingByPath = new Map<string, T>()
  const committedByPath = new Map<string, T[]>()

  for (const item of committedAfterBase) {
    const existingItems = committedByPath.get(item.path) ?? []
    existingItems.push(item)
    committedByPath.set(item.path, existingItems)
  }

  for (const item of incoming) {
    const existingIncoming = incomingByPath.get(item.path)
    if (existingIncoming && !isDeepEqual(existingIncoming, item)) {
      return {
        kind,
        path: item.path,
        reason: `Conflicting ${kind} payload for path ${item.path}.`
      }
    }
    incomingByPath.set(item.path, item)

    const committedItems = committedByPath.get(item.path) ?? []
    if (committedItems.some((committedItem) => !isDeepEqual(committedItem, item))) {
      return {
        kind,
        path: item.path,
        reason: `Conflicting ${kind} payload for path ${item.path}.`
      }
    }
  }

  return undefined
}

function upsertRefsByPath<T extends ContextRef>(existing: T[], incoming: T[]): T[] {
  const merged = sortRefsByPath(existing)
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
    } as T
  }

  return sortRefsByPath(merged)
}

function flattenLeafPaths(
  value: unknown,
  prefix: string,
  result: Map<string, unknown> = new Map()
): Map<string, unknown> {
  if (!isPlainRecord(value)) {
    result.set(prefix, value)
    return result
  }

  const entries = Object.entries(value)
  if (entries.length === 0) {
    if (prefix !== 'providerState') {
      result.set(prefix, value)
    }
    return result
  }

  for (const [key, childValue] of entries) {
    flattenLeafPaths(childValue, `${prefix}.${key}`, result)
  }

  return result
}

function pathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}.`) || right.startsWith(`${left}.`)
}

function setNestedValue(target: Record<string, unknown>, segments: string[], value: unknown): void {
  const [head, ...tail] = segments
  if (!head) {
    return
  }

  if (tail.length === 0) {
    target[head] = structuredClone(value)
    return
  }

  const child = target[head]
  if (!isPlainRecord(child)) {
    target[head] = {}
  }

  setNestedValue(target[head] as Record<string, unknown>, tail, value)
}

function findProviderStateConflict(
  committedAfterBase: Array<Record<string, unknown>>,
  incoming: Record<string, unknown>
): MergeConflict | undefined {
  const incomingLeafPaths = flattenLeafPaths(incoming, 'providerState')

  for (const [incomingPath, incomingValue] of incomingLeafPaths) {
    for (const committedUpdate of committedAfterBase) {
      const committedLeafPaths = flattenLeafPaths(committedUpdate, 'providerState')
      for (const [committedPath, committedValue] of committedLeafPaths) {
        if (!pathsOverlap(committedPath, incomingPath)) {
          continue
        }
        if (committedPath === incomingPath && isDeepEqual(committedValue, incomingValue)) {
          continue
        }

        return {
          kind: 'provider_state',
          path: incomingPath,
          reason: `Conflicting provider state update at ${incomingPath}.`
        }
      }
    }
  }

  return undefined
}

function mergeProviderState(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const merged = structuredClone(existing)
  const incomingLeafPaths = flattenLeafPaths(incoming, 'providerState')

  for (const [incomingPath, incomingValue] of incomingLeafPaths) {
    setNestedValue(merged, incomingPath.replace(/^providerState\./, '').split('.'), incomingValue)
  }

  return merged
}

function postBaseDeltas(current: FlowContextDocument, baseSnapshotVersion: number): ContextDelta[] {
  return current.deltas.filter((_, index) => index + 2 > baseSnapshotVersion)
}

function buildCommitResult(
  current: FlowContextDocument,
  delta: ContextDelta,
  commitState: string,
  committed: boolean,
  conflict?: MergeConflict
): ContextCommitResult {
  return ContextCommitResultSchema.parse({
    schemaVersion: 1,
    flowContextId: current.flowContextId,
    version: current.version,
    committed,
    commitState,
    deltaIdempotencyKey: delta.idempotencyKey,
    conflictPath: conflict?.path,
    conflictKind: conflict?.kind,
    conflictReason: conflict?.reason
  })
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

      if (delta.baseSnapshotVersion > current.version) {
        return {
          commitResult: buildCommitResult(current, delta, options.commitState, false, {
            kind: 'invalid_base_version',
            path: 'baseSnapshotVersion',
            reason: `Delta base version ${delta.baseSnapshotVersion} is newer than current context version ${current.version}.`
          }),
          idempotentReplay: false
        }
      }

      const deltasAfterBase = postBaseDeltas(current, delta.baseSnapshotVersion)
      const memoryRefConflict = findRefConflict(
        deltasAfterBase.flatMap((existingDelta) => existingDelta.memoryRefsAdded),
        delta.memoryRefsAdded,
        'memory_ref'
      )
      if (memoryRefConflict) {
        return {
          commitResult: buildCommitResult(
            current,
            delta,
            options.commitState,
            false,
            memoryRefConflict
          ),
          idempotentReplay: false
        }
      }

      const artifactRefConflict = findRefConflict(
        deltasAfterBase.flatMap((existingDelta) => existingDelta.artifactRefsAddedOrValidated),
        delta.artifactRefsAddedOrValidated,
        'artifact_ref'
      )
      if (artifactRefConflict) {
        return {
          commitResult: buildCommitResult(
            current,
            delta,
            options.commitState,
            false,
            artifactRefConflict
          ),
          idempotentReplay: false
        }
      }

      const providerStateConflict = findProviderStateConflict(
        deltasAfterBase.map((existingDelta) => existingDelta.providerStateUpdates),
        delta.providerStateUpdates
      )
      if (providerStateConflict) {
        return {
          commitResult: buildCommitResult(
            current,
            delta,
            options.commitState,
            false,
            providerStateConflict
          ),
          idempotentReplay: false
        }
      }

      if (
        delta.semanticSummaryUpdate.trim().length > 0 &&
        deltasAfterBase.some(
          (existingDelta) => existingDelta.semanticSummaryUpdate.trim().length > 0
        )
      ) {
        return {
          commitResult: buildCommitResult(current, delta, options.commitState, false, {
            kind: 'semantic_summary',
            path: 'semanticSummary',
            reason: 'Parallel semantic summary updates are not mergeable in flow context v1.'
          }),
          idempotentReplay: false
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
        providerState: mergeProviderState(
          current.latestSnapshot.providerState,
          delta.providerStateUpdates
        ),
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
