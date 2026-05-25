import { z } from 'zod'
import { ArtifactRefSchema } from './artifact.schema'

const ISO_UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
const RAW_SECRET_KEY_NAMES = new Set([
  'secret',
  'token',
  'apikey',
  'authorization',
  'password',
  'credential',
  'credentials'
])
const SAFE_REFERENCE_KEY_NAMES = new Set(['secretref', 'redactedref', 'envvar'])
const RAW_SECRET_VALUE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/i,
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\bOPENAI_API_KEY\s*=\s*\S+/i
]

const IsoUtcTimestampSchema = z
  .string()
  .regex(ISO_UTC_TIMESTAMP_PATTERN, 'Expected an ISO-8601 UTC timestamp.')

const FlowContextRecordSchema = z.record(z.string(), z.unknown())

function normalizeSecretKey(key: string): string {
  return key.replace(/[\s_-]/g, '').toLowerCase()
}

function isRawSecretKey(key: string): boolean {
  return RAW_SECRET_KEY_NAMES.has(normalizeSecretKey(key))
}

function isSafeReferenceKey(key: string): boolean {
  return SAFE_REFERENCE_KEY_NAMES.has(normalizeSecretKey(key))
}

function looksLikeRawSecretValue(value: string): boolean {
  return RAW_SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))
}

function addRawSecretKeyIssues(
  value: unknown,
  context: z.RefinementCtx,
  path: Array<string | number> = []
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => addRawSecretKeyIssues(item, context, [...path, index]))
    return
  }

  if (typeof value !== 'object' || value === null) {
    return
  }

  for (const [key, childValue] of Object.entries(value)) {
    const childPath = [...path, key]
    const isSafeReference = isSafeReferenceKey(key)
    if (isRawSecretKey(key)) {
      context.addIssue({
        code: 'custom',
        path: childPath,
        message:
          'Raw secret-like fields are not allowed in flow context payloads. Store secretRef, redactedRef, or envVar references instead.'
      })
    }
    if (
      isSafeReference &&
      (typeof childValue !== 'string' || childValue.trim().length === 0)
    ) {
      context.addIssue({
        code: 'custom',
        path: childPath,
        message: 'Safe secret reference fields must be non-empty strings.'
      })
    }
    if (
      !isSafeReference &&
      typeof childValue === 'string' &&
      looksLikeRawSecretValue(childValue)
    ) {
      context.addIssue({
        code: 'custom',
        path: childPath,
        message:
          'Raw secret-like values are not allowed in flow context payloads. Store secretRef, redactedRef, or envVar references instead.'
      })
    }
    addRawSecretKeyIssues(childValue, context, childPath)
  }
}

const SecretGuardedRecordSchema = FlowContextRecordSchema.superRefine(addRawSecretKeyIssues)

export const ContextMemorySourceRefSchema = z
  .object({
    path: z.string().min(1),
    kind: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
    nodeId: z.string().min(1).optional(),
    attempt: z.number().int().min(1).optional(),
    hash: z.string().min(1).optional(),
    metadata: SecretGuardedRecordSchema.optional()
  })
  .strict()

export const ContextArtifactRefSchema = ArtifactRefSchema.extend({
  kind: z.string().min(1).optional(),
  nodeId: z.string().min(1).optional(),
  attempt: z.number().int().min(1).optional(),
  validated: z.boolean().optional(),
  hash: z.string().min(1).optional(),
  metadata: SecretGuardedRecordSchema.optional()
}).strict()

export const ContextProviderStateSchema = SecretGuardedRecordSchema

export const ContextSnapshotPayloadSchema = z.object({
  memorySourceRefs: z.array(ContextMemorySourceRefSchema).default([]),
  artifactRefs: z.array(ContextArtifactRefSchema).default([]),
  runStateRef: z.string().min(1),
  providerState: ContextProviderStateSchema.default({}),
  semanticSummary: z.string(),
  hash: z.string().min(1).optional()
})

export const FlowContextLatestSnapshotSchema = ContextSnapshotPayloadSchema

export const ContextSnapshotSchema = ContextSnapshotPayloadSchema.extend({
  schemaVersion: z.literal(1),
  flowContextId: z.string().min(1),
  runId: z.string().min(1),
  workflowId: z.string().min(1),
  version: z.number().int().min(1),
  createdAt: IsoUtcTimestampSchema,
  hash: z.string().min(1)
})

export const ContextRunStateUpdatesSchema = SecretGuardedRecordSchema

export const ContextRedactionEntrySchema = z
  .object({
    path: z.string().min(1),
    reason: z.string().min(1),
    redactedRef: z.string().min(1).optional(),
    secretRef: z.string().min(1).optional(),
    envVar: z.string().min(1).optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.redactedRef && !value.secretRef && !value.envVar) {
      context.addIssue({
        code: 'custom',
        path: ['redactedRef'],
        message:
          'Redaction entries must include a redactedRef, secretRef, or envVar replacement reference.'
      })
    }
  })

export const ContextRedactionMetadataSchema = z
  .object({
    policy: z.string().min(1),
    redactedAt: IsoUtcTimestampSchema.optional(),
    redactedFields: z.array(ContextRedactionEntrySchema).default([])
  })
  .strict()
  .superRefine((value, context) => {
    if (value.redactedFields.length > 0 && !value.redactedAt) {
      context.addIssue({
        code: 'custom',
        path: ['redactedAt'],
        message: 'Redaction metadata with redacted fields must include redactedAt.'
      })
    }
  })

export const ContextConflictMarkerSchema = z
  .object({
    path: z.string().min(1),
    reason: z.string().min(1),
    kind: z.string().min(1).optional(),
    existingRef: z.string().min(1).optional(),
    incomingRef: z.string().min(1).optional()
  })
  .strict()

export const ContextDeltaSchema = z
  .object({
    schemaVersion: z.literal(1),
    flowContextId: z.string().min(1),
    runId: z.string().min(1),
    workflowId: z.string().min(1),
    nodeId: z.string().min(1),
    attempt: z.number().int().min(1),
    createdAt: IsoUtcTimestampSchema,
    baseSnapshotVersion: z.number().int().min(1).default(1),
    baseSnapshotHash: z.string().min(1).default('legacy:unknown'),
    idempotencyKey: z.string().min(1),
    memoryRefsAdded: z.array(ContextMemorySourceRefSchema),
    artifactRefsAddedOrValidated: z.array(ContextArtifactRefSchema),
    runStateUpdates: ContextRunStateUpdatesSchema,
    providerStateUpdates: ContextProviderStateSchema,
    semanticSummaryUpdate: z.string(),
    redaction: ContextRedactionMetadataSchema,
    conflictMarkers: z.array(ContextConflictMarkerSchema).optional()
  })
  .strict()

export const ContextCommitResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    flowContextId: z.string().min(1),
    version: z.number().int().min(1),
    committed: z.boolean(),
    commitState: z.string().min(1),
    deltaIdempotencyKey: z.string().min(1),
    conflictPath: z.string().min(1).optional(),
    conflictKind: z.string().min(1).optional(),
    conflictReason: z.string().min(1).optional()
  })
  .strict()

export const FlowContextDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    flowContextId: z.string().min(1),
    runId: z.string().min(1),
    workflowId: z.string().min(1),
    version: z.number().int().min(1),
    createdAt: IsoUtcTimestampSchema,
    updatedAt: IsoUtcTimestampSchema,
    latestSnapshot: FlowContextLatestSnapshotSchema,
    deltas: z.array(ContextDeltaSchema).default([])
  })
  .superRefine((value, context) => {
    if (Date.parse(value.updatedAt) < Date.parse(value.createdAt)) {
      context.addIssue({
        code: 'custom',
        path: ['updatedAt'],
        message: 'updatedAt must be the same as or later than createdAt.'
      })
    }
  })
