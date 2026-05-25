import { z } from 'zod'

export const GlobalMemoryFrontmatterSchema = z
  .object({
    type: z.literal('global'),
    version: z.string().min(1),
    workspaceType: z.string().min(1).optional(),
    contextStatus: z.string().min(1).optional()
  })
  .passthrough()

export const NodeMemoryFrontmatterV1Schema = z
  .object({
    schemaVersion: z.literal('1.0'),
    nodeId: z.string().min(1),
    provider: z.string().min(1),
    model: z.string().min(1),
    status: z.literal('completed'),
    timestamp: z.number().finite(),
    modelName: z.string().min(1).optional()
  })
  .passthrough()

export const NodeMemoryFrontmatterV2Schema = z
  .object({
    schemaVersion: z.literal('2.0'),
    nodeId: z.string().min(1),
    runId: z.string().min(1),
    attempt: z.number().int().positive().optional(),
    runner: z.string().min(1),
    model: z.string().min(1),
    status: z.literal('completed'),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    exitCode: z.number().int().optional(),
    runnerSessionId: z.string().min(1).optional(),
    provider: z.string().min(1).optional()
  })
  .passthrough()

export const NodeMemoryFrontmatterSchema = z.discriminatedUnion('schemaVersion', [
  NodeMemoryFrontmatterV1Schema,
  NodeMemoryFrontmatterV2Schema
])

export type NodeMemoryFrontmatter = z.infer<typeof NodeMemoryFrontmatterSchema>
