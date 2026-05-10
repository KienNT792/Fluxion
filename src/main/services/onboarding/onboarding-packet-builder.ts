import * as path from 'path'
import {
  ContextScanResult,
  OnboardingArtifactRecommendation,
  OnboardingCommandItem,
  OnboardingEvidenceSource,
  OnboardingGenerationMode,
  OnboardingPacket,
  OnboardingPacketSchema,
  OnboardingSuggestedContextPatch,
  ONBOARDING_PACKET_VERSION,
  ProjectContextDraft,
  normalizeProjectContextDraft
} from '@shared'
import type { OnboardingEvidencePack } from './onboarding-evidence-collector'
import { cleanString, uniqueList } from './onboarding-utils'

export function draftFromRequest(
  workspacePath: string,
  scanResult: ContextScanResult,
  draft?: ProjectContextDraft | null
): ProjectContextDraft {
  const workspaceName = path.basename(workspacePath) || 'Workspace'

  return normalizeProjectContextDraft(
    draft ?? {
      ...scanResult.detectedFields,
      workspaceType: scanResult.workspaceType,
      projectName: scanResult.projectName || workspaceName,
      sourceEvidence: scanResult.sourceEvidence,
      contextStatus: 'incomplete'
    },
    {
      workspaceType: scanResult.workspaceType,
      projectName: scanResult.projectName || workspaceName
    }
  )
}

function evidenceFromScanAndPack(
  scanResult: ContextScanResult,
  evidencePack: OnboardingEvidencePack
): OnboardingEvidenceSource[] {
  const sourceEvidence = scanResult.sourceEvidence.map((evidence, index) => ({
    id: evidence.id ?? `scan-evidence-${index + 1}`,
    sourcePath: evidence.sourcePath,
    confidence: evidence.confidence,
    note: evidence.note ?? evidence.confidenceReason ?? 'Detected by Fluxion workspace scan.',
    matchedSignals: uniqueList(evidence.matchedSignals ?? [])
  }))
  const fileEvidence = evidencePack.files.map((file, index) => ({
    id: `evidence-file-${index + 1}`,
    sourcePath: file.relativePath,
    confidence: 'medium' as const,
    note: file.truncated
      ? 'Readable project evidence included with truncation.'
      : 'Readable project evidence included in onboarding packet generation.',
    matchedSignals: [],
    truncated: file.truncated,
    size: file.size
  }))
  const seen = new Set<string>()

  return [...sourceEvidence, ...fileEvidence].filter((evidence) => {
    const key = `${evidence.sourcePath}:${evidence.note}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function summarizeComponent(component: ProjectContextDraft['components'][number]): string {
  const signals = uniqueList([
    component.type,
    ...component.languages,
    ...component.frameworks
  ]).join(' / ')

  return signals
    ? `${component.name} at ${component.rootPath}: ${signals}`
    : `${component.name} at ${component.rootPath}`
}

function buildSuggestedStableRules(draft: ProjectContextDraft): string[] {
  const inferred: string[] = []

  if (draft.verificationCommands.length > 0) {
    inferred.push(
      'Run the relevant verification command before claiming implementation work is done.'
    )
  }
  if (draft.generatedOrIgnoredPaths.length > 0) {
    inferred.push(
      'Do not edit generated, vendor, build, or ignored output directories unless asked.'
    )
  }
  if (draft.securityPolicy.sensitivePaths.length > 0) {
    inferred.push('Do not read, print, or modify secrets and credential files.')
  }

  return uniqueList([...draft.stableRules, ...inferred]).slice(0, 10)
}

function buildSuggestedContextPatch(draft: ProjectContextDraft): OnboardingSuggestedContextPatch {
  const patch: OnboardingSuggestedContextPatch = {}
  const scalarFields = [
    'projectGoal',
    'targetUsers',
    'architectureSummary',
    'firstMilestone'
  ] as const
  const listFields = [
    'stableRules',
    'verificationCommands',
    'importantPaths',
    'focusAreas',
    'nonGoals',
    'openQuestions',
    'primaryStack',
    'languages',
    'frameworks',
    'packageManagers',
    'buildSystems',
    'testFrameworks',
    'entrypoints',
    'moduleBoundaries',
    'generatedOrIgnoredPaths',
    'riskFlags',
    'recommendedFirstActions'
  ] as const

  for (const field of scalarFields) {
    const value = cleanString(draft[field])
    if (value) {
      patch[field] = value
    }
  }
  for (const field of listFields) {
    const values = uniqueList(draft[field])
    if (values.length > 0) {
      patch[field] = values
    }
  }

  const stableRules = buildSuggestedStableRules(draft)
  if (stableRules.length > 0) {
    patch.stableRules = stableRules
  }

  return patch
}

function buildCommands(draft: ProjectContextDraft): OnboardingCommandItem[] {
  if (draft.commandCatalog.length > 0) {
    return draft.commandCatalog.map((command) => ({
      id: command.id,
      label: command.label,
      command: command.command,
      cwd: command.cwd,
      category: command.category,
      risk: command.risk,
      confidence: command.confidence,
      evidenceIds: command.evidenceIds
    }))
  }

  return draft.verificationCommands.map((command, index) => ({
    id: `verification-${index + 1}`,
    label: command,
    command,
    cwd: '.',
    category: 'test',
    risk: 'safe',
    confidence: 'medium',
    evidenceIds: []
  }))
}

function buildArtifactRecommendations(): OnboardingArtifactRecommendation[] {
  return [
    {
      kind: 'context',
      label: 'Save Fluxion project context',
      relativePath: '.fluxion/context.json',
      rationale: 'Keep short durable context as Fluxion runtime input.'
    },
    {
      kind: 'memory',
      label: 'Save onboarding packet',
      relativePath: '.fluxion/memory/long-term/onboarding.md',
      rationale: 'Store detailed evidence and reasoning outside the compact context file.'
    },
    {
      kind: 'agents',
      label: 'Export Codex project instructions',
      relativePath: 'AGENTS.md',
      rationale: 'Give Codex a small repository-scoped guidance layer.'
    },
    {
      kind: 'workflow',
      label: 'Create onboarding workflow',
      relativePath: '.fluxion/workflows/codex-onboarding.fluxion.json',
      rationale: 'Make future repository onboarding repeatable and reviewable.'
    },
    {
      kind: 'repo-skill',
      label: 'Export repo-local onboarding skill',
      relativePath: '.agents/skills/fluxion-onboarding/SKILL.md',
      rationale: 'Optional artifact for repositories that want an explicit Codex skill trigger.'
    }
  ]
}

export function buildDeterministicPacket(options: {
  draft: ProjectContextDraft
  scanResult: ContextScanResult
  evidencePack: OnboardingEvidencePack
  now: Date
  mode: OnboardingGenerationMode
  model?: string
}): OnboardingPacket {
  const { draft, evidencePack, mode, model, now, scanResult } = options
  const stack = uniqueList([
    ...draft.primaryStack,
    ...draft.languages,
    ...draft.frameworks,
    ...draft.packageManagers,
    ...draft.buildSystems,
    ...draft.testFrameworks
  ])
  const commands = buildCommands(draft)
  const suggestedStableRules = buildSuggestedStableRules(draft)
  const warnings = uniqueList([
    ...(scanResult.detectedFields.riskFlags ?? []),
    ...(evidencePack.truncatedFiles.length > 0
      ? ['Some evidence files were truncated before packet generation.']
      : []),
    ...(commands.length === 0 && draft.workspaceType !== 'blank'
      ? ['No verification command was detected for this workspace.']
      : [])
  ])
  const packet: OnboardingPacket = {
    version: ONBOARDING_PACKET_VERSION,
    projectName: draft.projectName || scanResult.projectName || 'Workspace',
    generatedAt: now.toISOString(),
    generationMode: mode,
    projectSummary:
      draft.projectGoal ||
      scanResult.detectedFields.projectGoal ||
      `${draft.projectName || scanResult.projectName || 'Workspace'} needs project context review.`,
    stack,
    components: draft.components.map((component) => ({
      id: component.id,
      name: component.name,
      role: summarizeComponent(component),
      type: component.type,
      rootPath: component.rootPath,
      technologies: uniqueList([...component.languages, ...component.frameworks]),
      evidenceIds: component.evidenceIds
    })),
    architectureMap: uniqueList([
      draft.architectureSummary,
      ...draft.components.map(summarizeComponent),
      ...draft.moduleBoundaries,
      ...draft.entrypoints.map((entrypoint) => `Entrypoint: ${entrypoint}`)
    ]),
    commands,
    risks: uniqueList([
      ...draft.riskFlags,
      ...draft.securityPolicy.approvalRequiredFor.map((item) => `Approval required for ${item}.`)
    ]),
    openQuestions: uniqueList([
      ...draft.openQuestions,
      ...scanResult.unresolvedFields.map((field) => `Review unresolved context field: ${field}.`)
    ]),
    suggestedContextPatch: buildSuggestedContextPatch(draft),
    suggestedStableRules,
    artifactRecommendations: buildArtifactRecommendations(),
    sourceEvidence: evidenceFromScanAndPack(scanResult, evidencePack),
    diagnostics: {
      generatedAt: now.toISOString(),
      mode,
      model,
      filesRead: evidencePack.files.length,
      truncatedFiles: evidencePack.truncatedFiles,
      warnings
    }
  }

  return OnboardingPacketSchema.parse(packet)
}

function pickDraftForPrompt(draft: ProjectContextDraft): Record<string, unknown> {
  return {
    workspaceType: draft.workspaceType,
    projectName: draft.projectName,
    projectGoal: draft.projectGoal,
    targetUsers: draft.targetUsers,
    primaryStack: draft.primaryStack,
    languages: draft.languages,
    frameworks: draft.frameworks,
    architectureSummary: draft.architectureSummary,
    firstMilestone: draft.firstMilestone,
    stableRules: draft.stableRules,
    verificationCommands: draft.verificationCommands,
    importantPaths: draft.importantPaths,
    focusAreas: draft.focusAreas,
    nonGoals: draft.nonGoals,
    openQuestions: draft.openQuestions,
    riskFlags: draft.riskFlags,
    recommendedFirstActions: draft.recommendedFirstActions
  }
}

export function buildCodexOnboardingPrompt(options: {
  draft: ProjectContextDraft
  scanResult: ContextScanResult
  evidencePack: OnboardingEvidencePack
  deterministicPacket: OnboardingPacket
}): string {
  const payload = {
    currentDraft: pickDraftForPrompt(options.draft),
    scanSummary: {
      workspaceType: options.scanResult.workspaceType,
      projectName: options.scanResult.projectName,
      unresolvedFields: options.scanResult.unresolvedFields,
      scannedFiles: options.scanResult.scannedFiles,
      discoveredPaths: options.scanResult.discoveredPaths,
      detectedFields: options.scanResult.detectedFields
    },
    deterministicPacket: options.deterministicPacket,
    evidenceFiles: options.evidencePack.files.map((file) => ({
      sourcePath: file.relativePath,
      truncated: file.truncated,
      size: file.size,
      content: file.content
    }))
  }

  return [
    'You are creating a Fluxion Onboarding Packet for a local Codex CLI workflow project.',
    '',
    'Rules:',
    '- Use only the current draft, scan summary, deterministic packet, and evidence files.',
    '- Do not invent commands, product plans, APIs, providers, or source files.',
    '- Put uncertainty in openQuestions instead of guessing.',
    '- Keep suggestedStableRules short and durable.',
    '- Preserve Windows-first behavior when evidence indicates a Windows desktop workflow.',
    '- Treat Codex CLI as the primary runtime unless evidence explicitly says otherwise.',
    '- Do not ask to edit files or run commands.',
    '',
    'Return strict JSON only. No markdown fences, no prose.',
    'The JSON must match this shape exactly:',
    JSON.stringify(
      {
        version: ONBOARDING_PACKET_VERSION,
        projectName: 'Project name',
        generatedAt: 'ISO timestamp',
        generationMode: 'codex-assisted',
        projectSummary: 'grounded summary',
        stack: ['stack signal'],
        components: [
          {
            id: 'component-id',
            name: 'component name',
            role: 'what this component owns',
            type: 'frontend|backend|desktop|mobile|worker|library|cli|infra|unknown',
            rootPath: '.',
            technologies: ['TypeScript'],
            evidenceIds: ['optional evidence id']
          }
        ],
        architectureMap: ['architecture boundary or relationship'],
        commands: [
          {
            id: 'command-1',
            label: 'Typecheck',
            command: 'npm run typecheck',
            cwd: '.',
            category: 'typecheck',
            risk: 'safe',
            confidence: 'high',
            evidenceIds: ['optional evidence id']
          }
        ],
        risks: ['risk or constraint'],
        openQuestions: ['unknown to review'],
        suggestedContextPatch: {
          projectGoal: 'short goal',
          targetUsers: 'users or reviewers',
          architectureSummary: 'high level architecture',
          stableRules: ['durable rule'],
          verificationCommands: ['safe command'],
          importantPaths: ['src'],
          focusAreas: ['area'],
          openQuestions: ['question']
        },
        suggestedStableRules: ['durable rule'],
        artifactRecommendations: [
          {
            kind: 'memory',
            label: 'Save onboarding packet',
            relativePath: '.fluxion/memory/long-term/onboarding.md',
            rationale: 'why'
          }
        ],
        sourceEvidence: [
          {
            id: 'evidence-file-1',
            sourcePath: 'README.md',
            confidence: 'high',
            note: 'why this supports the packet',
            matchedSignals: ['optional signal']
          }
        ],
        diagnostics: {
          generatedAt: 'ISO timestamp',
          mode: 'codex-assisted',
          model: 'model id',
          filesRead: 1,
          truncatedFiles: [],
          warnings: []
        }
      },
      null,
      2
    ),
    '',
    'Input:',
    JSON.stringify(payload, null, 2)
  ].join('\n')
}
