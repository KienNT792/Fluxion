import { z } from 'zod'
import { ArtifactRefSchema } from './artifact.schema'
import { CodexExecutionOptionsSchema } from './codex.schema'

export const RunnerIdSchema = z.enum(['codex', 'custom'])
export const ExecutionModeSchema = z.enum(['auto', 'manual'])

export const RetryPolicySchema = z
  .object({
    maxAttempts: z.number().int().min(1).optional()
  })
  .passthrough()

export const AgentNodeDataSchema = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
    runner: RunnerIdSchema.default('codex'),
    codex: CodexExecutionOptionsSchema,
    label: z.string().optional(),
    prompt: z.string(),
    systemInstruction: z.string().optional(),
    requires: z.array(ArtifactRefSchema).default([]),
    produces: z.array(ArtifactRefSchema).default([]),
    humanReview: z.boolean().default(false),
    retryPolicy: RetryPolicySchema.optional(),
    contextWriter: z.boolean().optional(),
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
    reasoningLevel: z.enum(['low', 'medium', 'high', 'xhigh']).optional()
  })
  .passthrough()

export const WorkflowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().default('agentNode'),
  label: z.string().default(''),
  data: AgentNodeDataSchema,
  position: z.object({
    x: z.number(),
    y: z.number()
  })
})

export const WorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().optional()
})

export const WorkflowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  executionMode: ExecutionModeSchema.default('auto'),
  reviewModel: z.string().min(1).optional(),
  serviceTier: z.string().min(1).optional(),
  modelVerbosity: z.enum(['low', 'medium', 'high']).optional(),
  modelReasoningSummary: z.enum(['auto', 'concise', 'detailed', 'none']).optional(),
  hideAgentReasoning: z.boolean().optional(),
  showRawAgentReasoning: z.boolean().optional(),
  modelAutoCompactTokenLimit: z.number().int().positive().optional(),
  modelContextWindow: z.number().int().positive().optional(),
  fluxionVersion: z.string().optional(),
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

export type RunnerId = z.infer<typeof RunnerIdSchema>
export type AgentNodeData = z.infer<typeof AgentNodeDataSchema>
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>
export type Workflow = z.infer<typeof WorkflowSchema>
