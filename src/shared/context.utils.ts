import {
  AgentInstructionSource,
  ContextSaveMode,
  KickoffIntent,
  PROJECT_CONTEXT_VERSION,
  ProjectContextCommand,
  ProjectContextComponent,
  ProjectContextDraft,
  ProjectContextReadiness,
  ProjectSecurityPolicy,
  WorkspaceTrustLevel,
  WorkspaceContextStatus,
  WorkspaceContextType,
} from './context.types';

const DEFAULT_OPEN_QUESTION = 'Project context has not been finalized yet.';

function uniqueList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function defaultSecurityPolicy(
  generatedOrIgnoredPaths: string[] = []
): ProjectSecurityPolicy {
  return {
    sensitivePaths: ['.env', '.env.*', '**/*secret*', '**/*credential*'],
    generatedOrIgnoredPaths: uniqueList(generatedOrIgnoredPaths),
    writableRoots: ['.'],
    approvalRequiredFor: ['dependency installation', 'network access', 'destructive file operations'],
    destructiveCommands: ['git reset --hard', 'git clean -fd', 'rm -rf', 'Remove-Item -Recurse'],
    networkPolicy: 'unknown',
  };
}

function defaultReadiness(): ProjectContextReadiness {
  return {
    status: 'incomplete',
    missingItems: [],
    riskFlags: [],
    recommendedFirstActions: [],
  };
}

function normalizeComponents(values: ProjectContextComponent[] | undefined): ProjectContextComponent[] {
  const seen = new Set<string>();
  const normalized: ProjectContextComponent[] = [];

  for (const value of values ?? []) {
    const id = value.id.trim() || value.rootPath.trim() || value.name.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    normalized.push({
      ...value,
      id,
      name: value.name.trim() || id,
      rootPath: value.rootPath.trim() || '.',
      languages: uniqueList(value.languages ?? []),
      frameworks: uniqueList(value.frameworks ?? []),
      entrypoints: uniqueList(value.entrypoints ?? []),
      verificationCommands: uniqueList(value.verificationCommands ?? []),
      evidenceIds: uniqueList(value.evidenceIds ?? []),
    });
  }

  return normalized;
}

function normalizeCommands(values: ProjectContextCommand[] | undefined): ProjectContextCommand[] {
  const seen = new Set<string>();
  const normalized: ProjectContextCommand[] = [];

  for (const value of values ?? []) {
    const id = value.id.trim() || `${value.cwd}:${value.command}`.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    normalized.push({
      ...value,
      id,
      label: value.label.trim() || value.command.trim(),
      command: value.command.trim(),
      cwd: value.cwd.trim() || '.',
      evidenceIds: uniqueList(value.evidenceIds ?? []),
    });
  }

  return normalized;
}

function normalizeAgentInstructionSources(
  values: AgentInstructionSource[] | undefined
): AgentInstructionSource[] {
  const seen = new Set<string>();

  return (values ?? []).filter((value) => {
    const key = `${value.target}:${value.sourcePath}:${value.scope}`;
    if (!value.sourcePath.trim() || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function createEmptyProjectContextDraft(
  workspaceType: WorkspaceContextType,
  projectName: string
): ProjectContextDraft {
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
    languages: [],
    frameworks: [],
    packageManagers: [],
    buildSystems: [],
    testFrameworks: [],
    entrypoints: [],
    moduleBoundaries: [],
    generatedOrIgnoredPaths: [],
    riskFlags: [],
    recommendedFirstActions: [],
    workspaceTrust: 'unknown',
    components: [],
    commandCatalog: [],
    agentInstructionSources: [],
    securityPolicy: defaultSecurityPolicy(),
    readiness: defaultReadiness(),
    sourceEvidence: [],
    lastReviewedAt: new Date(0).toISOString(),
    contextStatus: 'missing',
  };
}

export function normalizeProjectContextDraft(
  draft: Partial<ProjectContextDraft>,
  defaults?: Partial<ProjectContextDraft>
): ProjectContextDraft {
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
    languages: uniqueList(draft.languages ?? defaults?.languages ?? []),
    frameworks: uniqueList(draft.frameworks ?? defaults?.frameworks ?? []),
    packageManagers: uniqueList(draft.packageManagers ?? defaults?.packageManagers ?? []),
    buildSystems: uniqueList(draft.buildSystems ?? defaults?.buildSystems ?? []),
    testFrameworks: uniqueList(draft.testFrameworks ?? defaults?.testFrameworks ?? []),
    entrypoints: uniqueList(draft.entrypoints ?? defaults?.entrypoints ?? []),
    moduleBoundaries: uniqueList(draft.moduleBoundaries ?? defaults?.moduleBoundaries ?? []),
    generatedOrIgnoredPaths: uniqueList(
      draft.generatedOrIgnoredPaths ?? defaults?.generatedOrIgnoredPaths ?? []
    ),
    riskFlags: uniqueList(draft.riskFlags ?? defaults?.riskFlags ?? []),
    recommendedFirstActions: uniqueList(
      draft.recommendedFirstActions ?? defaults?.recommendedFirstActions ?? []
    ),
    workspaceTrust:
      draft.workspaceTrust ?? defaults?.workspaceTrust ?? ('unknown' satisfies WorkspaceTrustLevel),
    components: normalizeComponents(draft.components ?? defaults?.components),
    commandCatalog: normalizeCommands(draft.commandCatalog ?? defaults?.commandCatalog),
    agentInstructionSources: normalizeAgentInstructionSources(
      draft.agentInstructionSources ?? defaults?.agentInstructionSources
    ),
    securityPolicy: {
      ...defaultSecurityPolicy(
        draft.generatedOrIgnoredPaths ?? defaults?.generatedOrIgnoredPaths ?? []
      ),
      ...(defaults?.securityPolicy ?? {}),
      ...(draft.securityPolicy ?? {}),
      sensitivePaths: uniqueList(
        draft.securityPolicy?.sensitivePaths
          ?? defaults?.securityPolicy?.sensitivePaths
          ?? defaultSecurityPolicy().sensitivePaths
      ),
      generatedOrIgnoredPaths: uniqueList(
        draft.securityPolicy?.generatedOrIgnoredPaths
          ?? defaults?.securityPolicy?.generatedOrIgnoredPaths
          ?? draft.generatedOrIgnoredPaths
          ?? defaults?.generatedOrIgnoredPaths
          ?? []
      ),
      writableRoots: uniqueList(
        draft.securityPolicy?.writableRoots
          ?? defaults?.securityPolicy?.writableRoots
          ?? defaultSecurityPolicy().writableRoots
      ),
      approvalRequiredFor: uniqueList(
        draft.securityPolicy?.approvalRequiredFor
          ?? defaults?.securityPolicy?.approvalRequiredFor
          ?? defaultSecurityPolicy().approvalRequiredFor
      ),
      destructiveCommands: uniqueList(
        draft.securityPolicy?.destructiveCommands
          ?? defaults?.securityPolicy?.destructiveCommands
          ?? defaultSecurityPolicy().destructiveCommands
      ),
    },
    readiness: draft.readiness ?? defaults?.readiness ?? defaultReadiness(),
    sourceEvidence: draft.sourceEvidence ?? defaults?.sourceEvidence ?? [],
    lastReviewedAt:
      draft.lastReviewedAt ?? defaults?.lastReviewedAt ?? new Date(0).toISOString(),
    contextStatus: draft.contextStatus ?? defaults?.contextStatus ?? 'missing',
  };
}

export function isProjectContextReadyForFinalSave(draft: ProjectContextDraft): boolean {
  if (!draft.projectName.trim() || !draft.projectGoal.trim()) {
    return false;
  }

  if (draft.workspaceType === 'blank') {
    return Boolean(
      draft.firstMilestone.trim()
      && draft.kickoffIntent
      && (draft.primaryStack.length > 0 || draft.languages.length > 0 || draft.frameworks.length > 0)
    );
  }

  const hasStackSignal =
    draft.primaryStack.length > 0 || draft.languages.length > 0 || draft.frameworks.length > 0;
  const hasStructureSignal =
    draft.architectureSummary.trim().length > 0 || draft.importantPaths.length > 0;
  const hasVerificationSignal =
    draft.verificationCommands.length > 0
    || draft.riskFlags.some((flag) => flag.toLowerCase().includes('verification'));

  return hasStackSignal && hasStructureSignal && hasVerificationSignal;
}

export function resolveProjectContextStatus(
  draft: ProjectContextDraft,
  mode: ContextSaveMode
): WorkspaceContextStatus {
  if (mode === 'draft' || mode === 'skip') {
    return 'incomplete';
  }

  return isProjectContextReadyForFinalSave(draft) ? 'ready' : 'incomplete';
}

export function buildSkippedProjectContextDraft(
  baseDraft: Partial<ProjectContextDraft>,
  workspaceType: WorkspaceContextType,
  projectName: string
): ProjectContextDraft {
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

export function formatProjectContextMarkdown(draft: ProjectContextDraft): string {
  const targetUsers = draft.targetUsers.trim() || 'Unknown';
  const projectGoal = draft.projectGoal.trim() || 'Unknown';
  const architectureSummary = draft.architectureSummary.trim() || 'Unknown';
  const milestone = draft.firstMilestone.trim() || 'Unknown';
  const stack = draft.primaryStack.length > 0 ? draft.primaryStack.join(', ') : 'Unknown';
  const technicalSignals = [
    ...draft.languages.map((item) => `Language: ${item}`),
    ...draft.frameworks.map((item) => `Framework: ${item}`),
    ...draft.packageManagers.map((item) => `Package manager: ${item}`),
    ...draft.buildSystems.map((item) => `Build system: ${item}`),
    ...draft.testFrameworks.map((item) => `Test framework: ${item}`),
  ];
  const componentSignals = draft.components.map((component) => {
    const details = [
      component.type,
      component.languages.join(', '),
      component.frameworks.join(', '),
    ].filter(Boolean);
    return `${component.name} (${component.rootPath})${details.length ? `: ${details.join(' / ')}` : ''}`;
  });
  const commandCatalog = draft.commandCatalog.map((command) => {
    const cwd = command.cwd === '.' ? '' : ` from \`${command.cwd}\``;
    return `${command.category}: \`${command.command}\`${cwd}`;
  });
  const instructionSources = draft.agentInstructionSources.map(
    (source) => `${source.target}: \`${source.sourcePath}\` (${source.activation})`
  );

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
    renderBulletLines(draft.stableRules),
    '',
    '# Verification',
    renderBulletLines(draft.verificationCommands.map((cmd) => `Verify with \`${cmd}\``)),
    '',
    '# Technical Signals',
    renderBulletLines(technicalSignals),
    '',
    '# Components',
    renderBulletLines(componentSignals),
    '',
    '# Command Catalog',
    renderBulletLines(commandCatalog),
    '',
    '# Agent Instruction Sources',
    renderBulletLines(instructionSources),
    '',
    '# Current Focus',
    renderBulletLines(draft.focusAreas),
    '',
    '# Important Paths',
    renderBulletLines(draft.importantPaths.map((path) => `\`${path}\``)),
    '',
    '# Entrypoints',
    renderBulletLines(draft.entrypoints.map((path) => `\`${path}\``)),
    '',
    '# Module Boundaries',
    renderBulletLines(draft.moduleBoundaries),
    '',
    '# Generated or Ignored Paths',
    renderBulletLines(draft.generatedOrIgnoredPaths.map((path) => `\`${path}\``)),
    '',
    '# Risk Flags',
    renderBulletLines(draft.riskFlags),
    '',
    '# Recommended First Actions',
    renderBulletLines(draft.recommendedFirstActions),
    '',
    '# Open Questions',
    renderBulletLines(draft.openQuestions),
    '',
  ].join('\n');
}

export function formatReadableProjectContext(draft: ProjectContextDraft): string {
  return [
    `Project: ${draft.projectName || 'Unknown'}`,
    `Workspace type: ${draft.workspaceType}`,
    `Goal: ${draft.projectGoal || 'Unknown'}`,
    `Users: ${draft.targetUsers || 'Unknown'}`,
    `Stack: ${draft.primaryStack.join(', ') || 'Unknown'}`,
    `Languages: ${draft.languages.join(', ') || 'Unknown'}`,
    `Frameworks: ${draft.frameworks.join(', ') || 'Unknown'}`,
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
