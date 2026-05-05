export interface WorkflowValidationError {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: WorkflowValidationError[];
}

export interface WorkflowGraphValidationOptions {
  resumeFromNodeId?: string;
  requireRunnableWorkflow?: boolean;
}

