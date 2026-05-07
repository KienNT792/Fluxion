export const PROJECT_CONTEXT_VERSION = '2.0' as const;

export type WorkspaceContextType = 'blank' | 'existing' | 'existing_with_instructions';

export type WorkspaceContextStatus = 'missing' | 'incomplete' | 'ready' | 'legacy';

export type KickoffIntent = 'desktop-app' | 'cli-tool' | 'web-app' | 'not-sure-yet';

export type ContextEvidenceConfidence = 'high' | 'medium' | 'low';

export type WorkspaceTrustLevel = 'unknown' | 'trusted' | 'untrusted';

export type ProjectComponentType =
  | 'frontend'
  | 'backend'
  | 'desktop'
  | 'mobile'
  | 'worker'
  | 'library'
  | 'cli'
  | 'infra'
  | 'unknown';

export type ProjectCommandCategory =
  | 'setup'
  | 'dev'
  | 'typecheck'
  | 'lint'
  | 'test'
  | 'build'
  | 'e2e'
  | 'db'
  | 'other';

export type ProjectCommandRisk = 'safe' | 'needs-approval' | 'destructive';

export type AgentInstructionTarget = 'codex' | 'claude' | 'gemini' | 'cursor' | 'cline' | 'windsurf' | 'copilot' | 'generic';

export type AgentInstructionActivation = 'always' | 'path' | 'manual' | 'agent-requested' | 'unknown';

export interface ProjectContextSignal {
  value: string;
  sourcePath?: string;
}

export interface ProjectContextComponent {
  id: string;
  name: string;
  type: ProjectComponentType;
  rootPath: string;
  languages: string[];
  frameworks: string[];
  entrypoints: string[];
  verificationCommands: string[];
  evidenceIds: string[];
}

export interface ProjectContextCommand {
  id: string;
  label: string;
  command: string;
  cwd: string;
  category: ProjectCommandCategory;
  risk: ProjectCommandRisk;
  confidence: ContextEvidenceConfidence;
  evidenceIds: string[];
}

export interface AgentInstructionSource {
  target: AgentInstructionTarget;
  sourcePath: string;
  scope: string;
  activation: AgentInstructionActivation;
  priority: number;
  trusted: boolean;
}

export interface ProjectSecurityPolicy {
  sensitivePaths: string[];
  generatedOrIgnoredPaths: string[];
  writableRoots: string[];
  approvalRequiredFor: string[];
  destructiveCommands: string[];
  networkPolicy: 'unknown' | 'disabled' | 'limited' | 'full';
}

export interface ProjectContextReadiness {
  status: Exclude<WorkspaceContextStatus, 'missing' | 'legacy'>;
  missingItems: string[];
  riskFlags: string[];
  recommendedFirstActions: string[];
}

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
  | 'openQuestions'
  | 'languages'
  | 'frameworks'
  | 'packageManagers'
  | 'buildSystems'
  | 'testFrameworks'
  | 'entrypoints'
  | 'moduleBoundaries'
  | 'generatedOrIgnoredPaths'
  | 'riskFlags'
  | 'recommendedFirstActions'
  | 'workspaceTrust'
  | 'components'
  | 'commandCatalog'
  | 'agentInstructionSources'
  | 'securityPolicy'
  | 'readiness';

export interface ContextSourceEvidence {
  id?: string;
  field: ProjectContextField;
  sourcePath: string;
  confidence: ContextEvidenceConfidence;
  note?: string;
  detectorId?: string;
  matchedSignals?: string[];
  rawValue?: string;
  confidenceReason?: string;
}

export interface ProjectContextDraft {
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
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
  buildSystems: string[];
  testFrameworks: string[];
  entrypoints: string[];
  moduleBoundaries: string[];
  generatedOrIgnoredPaths: string[];
  riskFlags: string[];
  recommendedFirstActions: string[];
  workspaceTrust: WorkspaceTrustLevel;
  components: ProjectContextComponent[];
  commandCatalog: ProjectContextCommand[];
  agentInstructionSources: AgentInstructionSource[];
  securityPolicy: ProjectSecurityPolicy;
  readiness: ProjectContextReadiness;
  sourceEvidence: ContextSourceEvidence[];
  lastReviewedAt: string;
  contextStatus: WorkspaceContextStatus;
}

export interface ContextScanResult {
  workspaceType: WorkspaceContextType;
  projectName: string;
  detectedFields: Partial<
    Omit<ProjectContextDraft, 'version' | 'sourceEvidence' | 'lastReviewedAt' | 'contextStatus'>
  >;
  sourceEvidence: ContextSourceEvidence[];
  unresolvedFields: ProjectContextField[];
  scannedFiles: string[];
  discoveredPaths: string[];
}

export type ContextSaveMode = 'draft' | 'skip' | 'final';

export interface WorkspaceContextSavePayload {
  workspacePath: string;
  draft: ProjectContextDraft;
  mode?: ContextSaveMode;
}

export interface WorkspaceContextSavedPayload {
  contextStatus: WorkspaceContextStatus;
  context: ProjectContextDraft;
}
