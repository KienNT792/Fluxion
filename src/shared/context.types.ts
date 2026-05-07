export const PROJECT_CONTEXT_VERSION = '2.0' as const;

export type WorkspaceContextType = 'blank' | 'existing' | 'existing_with_instructions';

export type WorkspaceContextStatus = 'missing' | 'incomplete' | 'ready' | 'legacy';

export type KickoffIntent = 'desktop-app' | 'cli-tool' | 'web-app' | 'not-sure-yet';

export type ContextEvidenceConfidence = 'high' | 'medium' | 'low';

export type ProjectContextField =
  | 'workspaceType'
  | 'projectName'
  | 'kickoffIntent'
  | 'projectGoal'
  | 'targetUsers'
  | 'primaryStack'
  | 'architectureSummary'
  | 'firstMilestone'
  | 'stableRules'
  | 'verificationCommands'
  | 'importantPaths'
  | 'focusAreas'
  | 'nonGoals'
  | 'openQuestions';

export interface ContextSourceEvidence {
  field: ProjectContextField;
  sourcePath: string;
  confidence: ContextEvidenceConfidence;
  note?: string;
}

export interface ProjectContextDraftV2 {
  version: typeof PROJECT_CONTEXT_VERSION;
  workspaceType: WorkspaceContextType;
  projectName: string;
  kickoffIntent?: KickoffIntent;
  projectGoal: string;
  targetUsers: string;
  primaryStack: string[];
  architectureSummary: string;
  firstMilestone: string;
  stableRules: string[];
  verificationCommands: string[];
  importantPaths: string[];
  focusAreas: string[];
  nonGoals: string[];
  openQuestions: string[];
  sourceEvidence: ContextSourceEvidence[];
  lastReviewedAt: string;
  contextStatus: WorkspaceContextStatus;
}

export interface ContextScanResult {
  workspaceType: WorkspaceContextType;
  projectName: string;
  detectedFields: Partial<
    Omit<ProjectContextDraftV2, 'version' | 'sourceEvidence' | 'lastReviewedAt' | 'contextStatus'>
  >;
  sourceEvidence: ContextSourceEvidence[];
  unresolvedFields: ProjectContextField[];
  scannedFiles: string[];
  discoveredPaths: string[];
}

export type ContextSaveMode = 'draft' | 'skip' | 'final';

export interface WorkspaceContextSavePayload {
  workspacePath: string;
  draft: ProjectContextDraftV2;
  mode?: ContextSaveMode;
}

export interface WorkspaceContextSavedPayload {
  contextStatus: WorkspaceContextStatus;
  context: ProjectContextDraftV2;
}
