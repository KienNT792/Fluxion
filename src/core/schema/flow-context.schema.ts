import { z } from 'zod'

const ISO_UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

const IsoUtcTimestampSchema = z
  .string()
  .regex(ISO_UTC_TIMESTAMP_PATTERN, 'Expected an ISO-8601 UTC timestamp.')

const FlowContextRecordSchema = z.record(z.string(), z.unknown())

export const FlowContextLatestSnapshotSchema = z.object({
  memorySourceRefs: z.array(FlowContextRecordSchema).default([]),
  artifactRefs: z.array(FlowContextRecordSchema).default([]),
  runStateRef: z.string().min(1),
  providerState: z.record(z.string(), z.unknown()).default({}),
  semanticSummary: z.string()
})

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
    deltas: z.array(FlowContextRecordSchema).default([])
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
