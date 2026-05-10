import {
  ContextScanResult,
  normalizeProjectContextDraft,
  ProjectContextDraft,
  ProjectContextField,
  WorkspaceContextStatus
} from '@shared'
import type { StatusChipTone } from '@renderer/components/ui/StatusChip'

export type ContextStepId = 'detect' | 'onboarding' | 'rules' | 'brief' | 'focus' | 'review'
export type PreviewTab = 'readable' | 'markdown' | 'json'

export const STEPS: { id: ContextStepId; label: string; description: string }[] = [
  {
    id: 'detect',
    label: 'Detect Workspace',
    description: 'Read workspace signals and choose kickoff mode if needed.'
  },
  {
    id: 'onboarding',
    label: 'Onboarding Packet',
    description: 'Generate evidence-backed packet and optional repository artifacts.'
  },
  {
    id: 'rules',
    label: 'Stable Rules',
    description: 'Capture stack, verification commands, and non-negotiable rules.'
  },
  {
    id: 'brief',
    label: 'Project Brief',
    description: 'Describe the product goal, users, and first milestone.'
  },
  {
    id: 'focus',
    label: 'Agent Focus',
    description: 'Tell agents where to work, what matters, and what is still unknown.'
  },
  {
    id: 'review',
    label: 'Review & Export',
    description: 'Preview context and export workspace-local agent artifacts.'
  }
] as const

export const KICKOFF_INTENTS: Array<{
  value: NonNullable<ProjectContextDraft['kickoffIntent']>
  description: string
}> = [
  {
    value: 'desktop-app',
    description: 'Local-first apps with desktop UX, filesystem, and process orchestration.'
  },
  {
    value: 'cli-tool',
    description: 'Terminal-first utilities, runners, and automation flows.'
  },
  {
    value: 'web-app',
    description: 'Browser-based product surfaces, APIs, and deployment-oriented flows.'
  },
  {
    value: 'not-sure-yet',
    description: 'Keep the brief broad and let the first milestone narrow the direction.'
  }
] as const

export const STEP_STATE_TONE: Record<'pending' | 'active' | 'done', StatusChipTone> = {
  pending: 'idle',
  active: 'running',
  done: 'success'
}

export function getWorkspaceName(workspacePath: string): string {
  return workspacePath.split(/[\\/]/).filter(Boolean).pop() || 'Workspace'
}

function mergeDetectedList(existing: string[], detected: string[] | undefined): string[] {
  return normalizeProjectContextDraft({
    workspaceType: 'blank',
    projectName: 'Workspace',
    primaryStack: [...existing, ...(detected ?? [])]
  }).primaryStack
}

export function mergeScanIntoDraft(
  workspacePath: string,
  scan: ContextScanResult | null,
  existingContext: ProjectContextDraft | null,
  initialStatus: WorkspaceContextStatus
): ProjectContextDraft {
  const workspaceName = getWorkspaceName(workspacePath)
  const scanFields = scan?.detectedFields ?? {}
  const merged = normalizeProjectContextDraft(
    {
      version: existingContext?.version,
      workspaceType: existingContext?.workspaceType ?? scan?.workspaceType ?? 'blank',
      projectName: existingContext?.projectName || scan?.projectName || workspaceName,
      kickoffIntent: existingContext?.kickoffIntent,
      projectGoal: existingContext?.projectGoal || scanFields.projectGoal || '',
      targetUsers: existingContext?.targetUsers || scanFields.targetUsers || '',
      primaryStack: mergeDetectedList(existingContext?.primaryStack ?? [], scanFields.primaryStack),
      architectureSummary:
        existingContext?.architectureSummary || scanFields.architectureSummary || '',
      firstMilestone: existingContext?.firstMilestone || '',
      stableRules: existingContext?.stableRules ?? [],
      verificationCommands: mergeDetectedList(
        existingContext?.verificationCommands ?? [],
        scanFields.verificationCommands
      ),
      importantPaths: mergeDetectedList(
        existingContext?.importantPaths ?? [],
        scanFields.importantPaths
      ),
      focusAreas: existingContext?.focusAreas ?? [],
      nonGoals: existingContext?.nonGoals ?? [],
      openQuestions: existingContext?.openQuestions ?? [],
      languages: mergeDetectedList(existingContext?.languages ?? [], scanFields.languages),
      frameworks: mergeDetectedList(existingContext?.frameworks ?? [], scanFields.frameworks),
      packageManagers: mergeDetectedList(
        existingContext?.packageManagers ?? [],
        scanFields.packageManagers
      ),
      buildSystems: mergeDetectedList(existingContext?.buildSystems ?? [], scanFields.buildSystems),
      testFrameworks: mergeDetectedList(
        existingContext?.testFrameworks ?? [],
        scanFields.testFrameworks
      ),
      entrypoints: mergeDetectedList(existingContext?.entrypoints ?? [], scanFields.entrypoints),
      moduleBoundaries: mergeDetectedList(
        existingContext?.moduleBoundaries ?? [],
        scanFields.moduleBoundaries
      ),
      generatedOrIgnoredPaths: mergeDetectedList(
        existingContext?.generatedOrIgnoredPaths ?? [],
        scanFields.generatedOrIgnoredPaths
      ),
      riskFlags: mergeDetectedList(existingContext?.riskFlags ?? [], scanFields.riskFlags),
      recommendedFirstActions: mergeDetectedList(
        existingContext?.recommendedFirstActions ?? [],
        scanFields.recommendedFirstActions
      ),
      workspaceTrust: existingContext?.workspaceTrust ?? scanFields.workspaceTrust ?? 'unknown',
      components: existingContext?.components ?? scanFields.components ?? [],
      commandCatalog: existingContext?.commandCatalog ?? scanFields.commandCatalog ?? [],
      agentInstructionSources:
        existingContext?.agentInstructionSources ?? scanFields.agentInstructionSources ?? [],
      securityPolicy: existingContext?.securityPolicy ?? scanFields.securityPolicy,
      readiness: existingContext?.readiness ?? scanFields.readiness,
      contextOnboarding: existingContext?.contextOnboarding,
      sourceEvidence: scan?.sourceEvidence ?? existingContext?.sourceEvidence ?? [],
      lastReviewedAt: existingContext?.lastReviewedAt,
      contextStatus: existingContext?.contextStatus ?? initialStatus
    },
    {
      workspaceType: scan?.workspaceType ?? existingContext?.workspaceType ?? 'blank',
      projectName: scan?.projectName || existingContext?.projectName || workspaceName
    }
  )

  if (merged.contextStatus === 'missing' && initialStatus !== 'missing') {
    return {
      ...merged,
      contextStatus: initialStatus
    }
  }

  return merged
}

export function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function fieldLabel(field: ProjectContextField): string {
  switch (field) {
    case 'projectName':
      return 'Project name'
    case 'projectGoal':
      return 'Project goal'
    case 'targetUsers':
      return 'Target users'
    case 'primaryStack':
      return 'Primary stack'
    case 'architectureSummary':
      return 'Architecture summary'
    case 'firstMilestone':
      return 'First milestone'
    case 'stableRules':
      return 'Stable rules'
    case 'verificationCommands':
      return 'Verification commands'
    case 'importantPaths':
      return 'Important paths'
    case 'focusAreas':
      return 'Focus areas'
    case 'nonGoals':
      return 'Non-goals'
    case 'openQuestions':
      return 'Open questions'
    case 'languages':
      return 'Languages'
    case 'frameworks':
      return 'Frameworks'
    case 'packageManagers':
      return 'Package managers'
    case 'buildSystems':
      return 'Build systems'
    case 'testFrameworks':
      return 'Test frameworks'
    case 'entrypoints':
      return 'Entrypoints'
    case 'moduleBoundaries':
      return 'Module boundaries'
    case 'generatedOrIgnoredPaths':
      return 'Generated or ignored paths'
    case 'riskFlags':
      return 'Risk flags'
    case 'recommendedFirstActions':
      return 'Recommended first actions'
    case 'kickoffIntent':
      return 'Kickoff intent'
    case 'workspaceType':
      return 'Workspace type'
    case 'workspaceTrust':
      return 'Workspace trust'
    case 'components':
      return 'Components'
    case 'commandCatalog':
      return 'Command catalog'
    case 'agentInstructionSources':
      return 'Agent instruction sources'
    case 'securityPolicy':
      return 'Security policy'
    case 'readiness':
      return 'Readiness'
    default:
      return field
  }
}

export function getContextStatusState(contextStatus: WorkspaceContextStatus): {
  label: string
  tone: StatusChipTone
  detail: string
} {
  switch (contextStatus) {
    case 'ready':
      return {
        label: 'Ready',
        tone: 'success',
        detail: 'This project context is ready for runtime use.'
      }
    case 'legacy':
      return {
        label: 'Legacy',
        tone: 'warning',
        detail: 'This workspace still uses an older context shape and should be resaved.'
      }
    case 'incomplete':
      return {
        label: 'Incomplete',
        tone: 'warning',
        detail: 'A draft context exists, but it still needs review.'
      }
    default:
      return {
        label: 'Missing',
        tone: 'error',
        detail: 'No project context has been saved for this workspace yet.'
      }
  }
}

export function getWorkspaceTypeLabel(workspaceType: ProjectContextDraft['workspaceType']): string {
  switch (workspaceType) {
    case 'existing_with_instructions':
      return 'Repo With Instructions'
    case 'existing':
      return 'Detected Repo'
    default:
      return 'Blank Project'
  }
}

export function getWorkspaceTypeDescription(
  workspaceType: ProjectContextDraft['workspaceType']
): string {
  switch (workspaceType) {
    case 'existing_with_instructions':
      return 'Fluxion found repository signals plus an existing instructions layer.'
    case 'existing':
      return 'Fluxion found repository files and can draft context from source evidence.'
    default:
      return 'No strong repository structure was detected, so Fluxion will use kickoff mode.'
  }
}

export function getMissingRequirements(draft: ProjectContextDraft): string[] {
  const missing: string[] = []

  if (!draft.projectGoal.trim()) {
    missing.push('Project goal')
  }

  if (draft.workspaceType === 'blank') {
    const hasTargetStack =
      draft.primaryStack.length > 0 || draft.languages.length > 0 || draft.frameworks.length > 0
    if (!draft.firstMilestone.trim()) {
      missing.push('First milestone')
    }
    if (!draft.kickoffIntent) {
      missing.push('Kickoff intent')
    }
    if (!hasTargetStack) {
      missing.push('Target stack')
    }
  } else {
    const hasStackSignal =
      draft.primaryStack.length > 0 || draft.languages.length > 0 || draft.frameworks.length > 0
    const hasStructureSignal =
      draft.architectureSummary.trim().length > 0 || draft.importantPaths.length > 0
    const hasVerificationSignal =
      draft.verificationCommands.length > 0 ||
      draft.riskFlags.some((flag) => flag.toLowerCase().includes('verification'))
    if (!hasStackSignal) {
      missing.push('Stack or language')
    }
    if (!hasStructureSignal) {
      missing.push('Architecture or important paths')
    }
    if (!hasVerificationSignal) {
      missing.push('Verification command or risk flag')
    }
  }

  return missing
}

export function getStepState(
  stepId: ContextStepId,
  currentStepId: ContextStepId
): 'pending' | 'active' | 'done' {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStepId)
  const stepIndex = STEPS.findIndex((step) => step.id === stepId)

  if (stepIndex === currentIndex) {
    return 'active'
  }

  return stepIndex < currentIndex ? 'done' : 'pending'
}
