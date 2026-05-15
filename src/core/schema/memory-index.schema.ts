import { z } from 'zod'
import {
  isValidRelativeArtifactPath,
  normalizeArtifactPath
} from '../artifacts/artifact.validation'

const RelativeMemoryPathSchema = z
  .string()
  .transform(normalizeArtifactPath)
  .refine(isValidRelativeArtifactPath, {
    message: 'Memory index paths must be workspace-relative and cannot contain .. segments.'
  })

export const MemoryEntryTypeSchema = z.enum([
  'raw_output',
  'summary',
  'decision',
  'fact',
  'procedure',
  'artifact_note'
])

export const RawOutputMemoryIndexEntrySchema = z.object({
  id: z.string().min(1),
  type: z.literal('raw_output'),
  workflowId: z.string().min(1),
  runId: z.string().min(1),
  nodeId: z.string().min(1),
  sourcePath: RelativeMemoryPathSchema,
  latestSourcePath: RelativeMemoryPathSchema.optional(),
  createdAt: z.string().min(1),
  attempt: z.number().int().positive().optional()
})

export const MemoryIndexEntrySchema = z.discriminatedUnion('type', [
  RawOutputMemoryIndexEntrySchema
])

export const MemoryIndexSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.array(MemoryIndexEntrySchema)
})
