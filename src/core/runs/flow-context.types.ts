export interface FlowContextRecord {
  [key: string]: unknown
}

export interface FlowContextLatestSnapshot {
  memorySourceRefs: FlowContextRecord[]
  artifactRefs: FlowContextRecord[]
  runStateRef: string
  providerState: Record<string, unknown>
  semanticSummary: string
}

export interface FlowContextDocument {
  schemaVersion: 1
  flowContextId: string
  runId: string
  workflowId: string
  version: number
  createdAt: string
  updatedAt: string
  latestSnapshot: FlowContextLatestSnapshot
  deltas: FlowContextRecord[]
}
