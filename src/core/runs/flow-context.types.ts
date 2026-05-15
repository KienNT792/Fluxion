export interface FlowContextRecord {
  [key: string]: unknown
}

export interface ContextMemorySourceRef {
  path: string
  kind?: string
  label?: string
  nodeId?: string
  attempt?: number
  hash?: string
  metadata?: FlowContextRecord
}

export interface ContextArtifactRef {
  path: string
  required?: boolean
  kind?: string
  nodeId?: string
  attempt?: number
  validated?: boolean
  hash?: string
  metadata?: FlowContextRecord
}

export type ContextProviderState = Record<string, unknown>

export interface ContextSnapshotPayload {
  memorySourceRefs: ContextMemorySourceRef[]
  artifactRefs: ContextArtifactRef[]
  runStateRef: string
  providerState: ContextProviderState
  semanticSummary: string
  hash?: string
}

export interface ContextSnapshot extends ContextSnapshotPayload {
  schemaVersion: 1
  flowContextId: string
  runId: string
  workflowId: string
  version: number
  createdAt: string
  hash: string
}

export interface ContextRunStateUpdates {
  runStateRef?: string
  nodeId?: string
  status?: string
  outputArtifactPaths?: string[]
  [key: string]: unknown
}

export interface ContextRedactionEntry {
  path: string
  reason: string
  redactedRef?: string
  secretRef?: string
  envVar?: string
}

export interface ContextRedactionMetadata {
  policy: string
  redactedAt?: string
  redactedFields: ContextRedactionEntry[]
}

export interface ContextConflictMarker {
  path: string
  reason: string
  kind?: string
  existingRef?: string
  incomingRef?: string
}

export interface ContextDelta {
  schemaVersion: 1
  flowContextId: string
  runId: string
  workflowId: string
  nodeId: string
  attempt: number
  createdAt: string
  idempotencyKey: string
  memoryRefsAdded: ContextMemorySourceRef[]
  artifactRefsAddedOrValidated: ContextArtifactRef[]
  runStateUpdates: ContextRunStateUpdates
  providerStateUpdates: ContextProviderState
  semanticSummaryUpdate: string
  redaction: ContextRedactionMetadata
  conflictMarkers?: ContextConflictMarker[]
}

export interface ContextCommitResult {
  schemaVersion: 1
  flowContextId: string
  version: number
  committed: boolean
  commitState: string
  deltaIdempotencyKey: string
  conflictReason?: string
}

export type FlowContextLatestSnapshot = ContextSnapshotPayload

export interface FlowContextDocument {
  schemaVersion: 1
  flowContextId: string
  runId: string
  workflowId: string
  version: number
  createdAt: string
  updatedAt: string
  latestSnapshot: FlowContextLatestSnapshot
  deltas: ContextDelta[]
}
