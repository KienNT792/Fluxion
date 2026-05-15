import { z } from 'zod'
import { WORKFLOW_TRACE_EVENT_TYPES } from '../runs/workflow-trace.types'

export const WorkflowTraceEventTypeSchema = z.enum(WORKFLOW_TRACE_EVENT_TYPES)

export const WorkflowTraceEventSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  flowContextId: z.string().min(1).optional(),
  workflowId: z.string().min(1),
  nodeId: z.string().min(1).optional(),
  type: WorkflowTraceEventTypeSchema,
  timestamp: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional()
})
