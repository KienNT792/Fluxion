import { z } from 'zod'

const ExecutionModeSchema = z.enum(['auto', 'manual'])
export const RunStatusSchema = z.enum([
  'pending',
  'running',
  'awaiting_review',
  'completed',
  'failed',
  'aborted',
  'rejected'
])

export const ReviewStatusSchema = z.enum(['pending', 'approved', 'rejected'])
export const ReviewSourceSchema = z.enum(['node', 'manual'])

export const NodeRunStateSchema = z.object({
  nodeId: z.string().min(1),
  runner: z.string().min(1),
  status: RunStatusSchema,
  attempts: z.number().int().min(0),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  exitCode: z.number().int().optional(),
  error: z.string().optional(),
  runnerSessionId: z.string().optional(),
  model: z.string().optional(),
  outputArtifactPaths: z.array(z.string()).default([]),
  humanReview: z.boolean().optional(),
  reviewStatus: ReviewStatusSchema.optional(),
  reviewSource: ReviewSourceSchema.optional(),
  reviewRequestedAt: z.string().optional(),
  reviewResolvedAt: z.string().optional(),
  reviewComment: z.string().optional()
})

export const WorkflowRunStateSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  flowContextId: z.string().min(1).optional(),
  workflowId: z.string().min(1),
  executionMode: ExecutionModeSchema.default('auto'),
  status: RunStatusSchema,
  startedAt: z.string().optional(),
  updatedAt: z.string().min(1),
  completedAt: z.string().optional(),
  currentNodeIds: z.array(z.string().min(1)).default([]),
  awaitingReviewNodeIds: z.array(z.string().min(1)).default([]),
  nodes: z.record(z.string(), NodeRunStateSchema)
})
