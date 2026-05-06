export type RunStatus =
  | 'pending'
  | 'running'
  | 'awaiting_review'
  | 'completed'
  | 'failed'
  | 'aborted'
  | 'rejected';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface NodeRunState {
  nodeId: string;
  runner: 'codex' | 'custom' | string;
  status: RunStatus;
  attempts: number;
  startedAt?: string;
  completedAt?: string;
  exitCode?: number;
  error?: string;
  runnerSessionId?: string;
  model?: string;
  outputArtifactPaths: string[];
  humanReview?: boolean;
  reviewStatus?: ReviewStatus;
  reviewRequestedAt?: string;
  reviewResolvedAt?: string;
  reviewComment?: string;
}

export interface WorkflowRunState {
  schemaVersion: 1;
  runId: string;
  workflowId: string;
  status: RunStatus;
  startedAt?: string;
  updatedAt: string;
  completedAt?: string;
  currentNodeIds: string[];
  awaitingReviewNodeIds: string[];
  nodes: Record<string, NodeRunState>;
}
