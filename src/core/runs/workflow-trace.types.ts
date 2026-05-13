export const WORKFLOW_TRACE_EVENT_TYPES = [
  'workflow.started',
  'workflow.completed',
  'workflow.failed',
  'workflow.aborted',
  'workflow.rejected',
  'node.ready',
  'node.requires_validated',
  'node.produces_snapshot',
  'node.running',
  'node.context_compiled',
  'node.execution_started',
  'node.execution_completed',
  'node.process_spawned',
  'node.process_exited',
  'node.produces_validated',
  'node.output_saved',
  'node.review_requested',
  'node.review_approved',
  'node.review_rejected',
  'node.rerun_requested',
  'node.failed',
  'node.aborted',
] as const;

export type WorkflowTraceEventType = (typeof WORKFLOW_TRACE_EVENT_TYPES)[number];

export interface WorkflowTraceEvent<
  TData extends Record<string, unknown> = Record<string, unknown>,
> {
  schemaVersion: 1;
  runId: string;
  workflowId: string;
  nodeId?: string;
  type: WorkflowTraceEventType;
  timestamp: string;
  data?: TData;
}
