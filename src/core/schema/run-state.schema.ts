import { z } from 'zod';

export const RunStatusSchema = z.enum([
  'pending',
  'running',
  'awaiting_review',
  'completed',
  'failed',
  'aborted',
  'rejected',
]);

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
});

export const WorkflowRunStateSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  workflowId: z.string().min(1),
  status: RunStatusSchema,
  startedAt: z.string().optional(),
  updatedAt: z.string().min(1),
  completedAt: z.string().optional(),
  currentNodeIds: z.array(z.string().min(1)).default([]),
  nodes: z.record(z.string(), NodeRunStateSchema),
});
