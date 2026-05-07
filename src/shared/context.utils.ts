import {
  ContextSaveMode,
  KickoffIntent,
  PROJECT_CONTEXT_VERSION,
  ProjectContextDraftV2,
  WorkspaceContextStatus,
  WorkspaceContextType,
} from './context.types';

const DEFAULT_OPEN_QUESTION = 'Project context has not been finalized yet.';

function uniqueList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function createEmptyProjectContextDraft(
  workspaceType: WorkspaceContextType,
  projectName: string
): ProjectContextDraftV2 {
  return {
    version: PROJECT_CONTEXT_VERSION,
    workspaceType,
    projectName: projectName.trim(),
    kickoffIntent: workspaceType === 'blank' ? 'not-sure-yet' : undefined,
    projectGoal: '',
    targetUsers: '',
    primaryStack: [],
    architectureSummary: '',
    firstMilestone: '',
    stableRules: [],
    verificationCommands: [],
    importantPaths: [],
    focusAreas: [],
    nonGoals: [],
    openQuestions: [],
    sourceEvidence: [],
    lastReviewedAt: new Date(0).toISOString(),
    contextStatus: 'missing',
  };
}

export function normalizeProjectContextDraft(
  draft: Partial<ProjectContextDraftV2>,
  defaults?: Partial<ProjectContextDraftV2>
): ProjectContextDraftV2 {
  const fallbackWorkspaceType = defaults?.workspaceType ?? 'blank';
  const fallbackProjectName = defaults?.projectName ?? 'Workspace';
  const workspaceType = draft.workspaceType ?? defaults?.workspaceType ?? fallbackWorkspaceType;

  return {
    version: PROJECT_CONTEXT_VERSION,
    workspaceType,
    projectName: (draft.projectName ?? defaults?.projectName ?? fallbackProjectName).trim(),
    kickoffIntent:
      draft.kickoffIntent ?? defaults?.kickoffIntent ?? (workspaceType === 'blank'
        ? 'not-sure-yet'
        : undefined),
    projectGoal: (draft.projectGoal ?? defaults?.projectGoal ?? '').trim(),
    targetUsers: (draft.targetUsers ?? defaults?.targetUsers ?? '').trim(),
    primaryStack: uniqueList(draft.primaryStack ?? defaults?.primaryStack ?? []),
    architectureSummary: (draft.architectureSummary ?? defaults?.architectureSummary ?? '').trim(),
    firstMilestone: (draft.firstMilestone ?? defaults?.firstMilestone ?? '').trim(),
    stableRules: uniqueList(draft.stableRules ?? defaults?.stableRules ?? []),
    verificationCommands: uniqueList(
      draft.verificationCommands ?? defaults?.verificationCommands ?? []
    ),
    importantPaths: uniqueList(draft.importantPaths ?? defaults?.importantPaths ?? []),
    focusAreas: uniqueList(draft.focusAreas ?? defaults?.focusAreas ?? []),
    nonGoals: uniqueList(draft.nonGoals ?? defaults?.nonGoals ?? []),
    openQuestions: uniqueList(draft.openQuestions ?? defaults?.openQuestions ?? []),
    sourceEvidence: draft.sourceEvidence ?? defaults?.sourceEvidence ?? [],
    lastReviewedAt:
      draft.lastReviewedAt ?? defaults?.lastReviewedAt ?? new Date(0).toISOString(),
    contextStatus: draft.contextStatus ?? defaults?.contextStatus ?? 'missing',
  };
}

export function isProjectContextReadyForFinalSave(draft: ProjectContextDraftV2): boolean {
  if (!draft.projectName.trim() || !draft.projectGoal.trim()) {
    return false;
  }

  if (draft.workspaceType === 'blank' && !draft.firstMilestone.trim()) {
    return false;
  }

  return true;
}

export function resolveProjectContextStatus(
  draft: ProjectContextDraftV2,
  mode: ContextSaveMode
): WorkspaceContextStatus {
  if (mode === 'draft' || mode === 'skip') {
    return 'incomplete';
  }

  return isProjectContextReadyForFinalSave(draft) ? 'ready' : 'incomplete';
}

export function buildSkippedProjectContextDraft(
  baseDraft: Partial<ProjectContextDraftV2>,
  workspaceType: WorkspaceContextType,
  projectName: string
): ProjectContextDraftV2 {
  const normalized = normalizeProjectContextDraft(baseDraft, {
    workspaceType,
    projectName,
  });
  const openQuestions = normalized.openQuestions.length > 0
    ? normalized.openQuestions
    : [DEFAULT_OPEN_QUESTION];

  return {
    ...normalized,
    openQuestions,
    contextStatus: 'incomplete',
  };
}

function renderBulletLines(items: string[]): string {
  if (items.length === 0) {
    return '- Unknown';
  }

  return items.map((item) => `- ${item}`).join('\n');
}

export function formatProjectContextMarkdown(draft: ProjectContextDraftV2): string {
  const targetUsers = draft.targetUsers.trim() || 'Unknown';
  const projectGoal = draft.projectGoal.trim() || 'Unknown';
  const architectureSummary = draft.architectureSummary.trim() || 'Unknown';
  const milestone = draft.firstMilestone.trim() || 'Unknown';
  const stack = draft.primaryStack.length > 0 ? draft.primaryStack.join(', ') : 'Unknown';

  return [
    '---',
    'type: global',
    `version: "${PROJECT_CONTEXT_VERSION}"`,
    `workspaceType: ${draft.workspaceType}`,
    `contextStatus: ${draft.contextStatus}`,
    '---',
    '',
    '# Project Brief',
    `- Project: ${draft.projectName}`,
    `- Goal: ${projectGoal}`,
    `- Users: ${targetUsers}`,
    `- Primary stack: ${stack}`,
    `- Architecture: ${architectureSummary}`,
    `- First milestone: ${milestone}`,
    '',
    '# Stable Rules',
    renderBulletLines([...draft.stableRules, ...draft.verificationCommands.map((cmd) => `Verify with \`${cmd}\``)]),
    '',
    '# Current Focus',
    renderBulletLines(draft.focusAreas),
    '',
    '# Important Paths',
    renderBulletLines(draft.importantPaths.map((path) => `\`${path}\``)),
    '',
    '# Open Questions',
    renderBulletLines(draft.openQuestions),
    '',
  ].join('\n');
}

export function formatReadableProjectContext(draft: ProjectContextDraftV2): string {
  return [
    `Project: ${draft.projectName || 'Unknown'}`,
    `Workspace type: ${draft.workspaceType}`,
    `Goal: ${draft.projectGoal || 'Unknown'}`,
    `Users: ${draft.targetUsers || 'Unknown'}`,
    `Stack: ${draft.primaryStack.join(', ') || 'Unknown'}`,
    `Architecture: ${draft.architectureSummary || 'Unknown'}`,
    `Milestone: ${draft.firstMilestone || 'Unknown'}`,
  ].join('\n');
}

export function kickoffIntentLabel(intent: KickoffIntent): string {
  switch (intent) {
    case 'desktop-app':
      return 'Desktop App';
    case 'cli-tool':
      return 'CLI Tool';
    case 'web-app':
      return 'Web App';
    default:
      return 'Not sure yet';
  }
}
