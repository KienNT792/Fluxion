import { randomUUID } from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import matter from 'gray-matter'
import { ulid } from 'ulid'
import { z } from 'zod'
import { RunnerContext, RunnerEvent, RunnerResult, WorkflowNodeSchema, WorkflowSchema } from '@core'
import {
  AgentConfigFileOperation,
  CODEX_DEFAULT_MODEL,
  ContextScanResult,
  CreateOnboardingWorkflowRequest,
  CreateOnboardingWorkflowResult,
  GenerateOnboardingPacketRequest,
  OnboardingArtifactRecommendation,
  OnboardingCommandItem,
  OnboardingEvidenceSource,
  OnboardingGenerationMode,
  OnboardingPacket,
  OnboardingPacketSchema,
  OnboardingSuggestedContextPatch,
  ONBOARDING_PACKET_VERSION,
  ProjectContextDraft,
  RepoOnboardingSkillPreview,
  RepoOnboardingSkillPreviewRequest,
  SaveOnboardingPacketRequest,
  SaveOnboardingPacketResult,
  WorkflowNode,
  normalizeProjectContextDraft
} from '@shared'
import { CodexCliRunner } from '../runners/codex-cli-runner'
import { scanWorkspaceContext as scanWorkspaceContextService } from './context-scout.service'
import {
  createWorkspaceSnapshot,
  WorkspaceSnapshot,
  WorkspaceSnapshotFile
} from './context/workspace-snapshot'
import { readExistingFile } from './agent-config/agent-config-merge.service'
import { memoryManager } from './memory-manager'

const MAX_EVIDENCE_FILES = 16
const MAX_FILE_BYTES = 14 * 1024
const MAX_TOTAL_TEXT_BYTES = 80 * 1024

const PRIORITY_SIGNAL_FILES = [
  'README.md',
  'AGENTS.md',
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  'nx.json',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'settings.gradle',
  'settings.gradle.kts',
  'composer.json',
  'Gemfile',
  'pubspec.yaml',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.github/copilot-instructions.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.cursorrules'
] as const

interface OnboardingRunner {
  run(ctx: RunnerContext): AsyncGenerator<RunnerEvent, RunnerResult, void>
}

interface OnboardingEvidenceFile {
  relativePath: string
  content: string
  truncated: boolean
  size: number
}

interface OnboardingEvidencePack {
  files: OnboardingEvidenceFile[]
  truncatedFiles: string[]
}

interface OnboardingServiceDependencies {
  runner?: OnboardingRunner
  now?: () => Date
  scanWorkspaceContext?: (workspacePath: string) => Promise<ContextScanResult>
  createSnapshot?: (workspacePath: string) => Promise<WorkspaceSnapshot>
}

const codexOnboardingOutputSchema = OnboardingPacketSchema

function cleanString(value: string | undefined): string {
  return value?.trim().replace(/\r\n/g, '\n') ?? ''
}

function uniqueList(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => cleanString(value)).filter(Boolean))]
}

function normalizeRelativePath(value: string): string | null {
  const normalized = value.trim().replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+$/, '')
  if (!normalized || path.isAbsolute(value) || normalized === '.' || normalized.startsWith('../')) {
    return null
  }
  if (normalized.includes('/../')) {
    return null
  }

  return normalized
}

function shouldSkipSensitivePath(relativePath: string): boolean {
  const normalized = relativePath.toLowerCase()
  const segments = normalized.split('/')
  const name = segments[segments.length - 1] ?? normalized

  return (
    name === '.env' ||
    name.startsWith('.env.') ||
    normalized.includes('secret') ||
    normalized.includes('credential') ||
    normalized.includes('private-key') ||
    normalized.endsWith('.pem') ||
    normalized.endsWith('.key') ||
    normalized.endsWith('id_rsa') ||
    normalized.includes('/vendor/') ||
    normalized.includes('/node_modules/') ||
    normalized.includes('/dist/') ||
    normalized.includes('/build/') ||
    normalized.includes('/coverage/')
  )
}

function findSnapshotFile(
  snapshot: WorkspaceSnapshot,
  relativePath: string
): WorkspaceSnapshotFile | undefined {
  const normalized = relativePath.toLowerCase()
  return snapshot.files.find((file) => file.relativePath.toLowerCase() === normalized)
}

function collectCandidatePaths(
  draft: ProjectContextDraft,
  scanResult: ContextScanResult
): string[] {
  return uniqueList([
    ...PRIORITY_SIGNAL_FILES,
    ...scanResult.scannedFiles,
    ...scanResult.discoveredPaths,
    ...draft.importantPaths,
    ...draft.entrypoints,
    ...draft.moduleBoundaries,
    ...draft.agentInstructionSources.map((source) => source.sourcePath)
  ])
    .map((candidate) => normalizeRelativePath(candidate))
    .filter((candidate): candidate is string => Boolean(candidate))
    .filter((candidate) => !shouldSkipSensitivePath(candidate))
}

async function buildEvidencePack(
  workspacePath: string,
  draft: ProjectContextDraft,
  scanResult: ContextScanResult,
  createSnapshot: (workspacePath: string) => Promise<WorkspaceSnapshot>
): Promise<OnboardingEvidencePack> {
  const snapshot = await createSnapshot(workspacePath)
  const files: OnboardingEvidenceFile[] = []
  const truncatedFiles: string[] = []
  let totalBytes = 0

  for (const relativePath of collectCandidatePaths(draft, scanResult)) {
    if (files.length >= MAX_EVIDENCE_FILES || totalBytes >= MAX_TOTAL_TEXT_BYTES) {
      break
    }
    if (!snapshot.hasFile(relativePath)) {
      continue
    }

    const file = findSnapshotFile(snapshot, relativePath)
    if (!file) {
      continue
    }

    const remainingBytes = MAX_TOTAL_TEXT_BYTES - totalBytes
    const maxBytes = Math.min(MAX_FILE_BYTES, remainingBytes)
    const content = await snapshot.readText(relativePath, maxBytes)
    if (!content?.trim()) {
      continue
    }

    const truncated = file.size > maxBytes
    if (truncated) {
      truncatedFiles.push(relativePath)
    }

    files.push({
      relativePath,
      content,
      truncated,
      size: file.size
    })
    totalBytes += Buffer.byteLength(content, 'utf8')
  }

  return { files, truncatedFiles }
}

function draftFromRequest(
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

function buildDeterministicPacket(options: {
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

function buildCodexOnboardingPrompt(options: {
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

function extractJsonCandidate(rawOutput: string): string {
  const trimmed = rawOutput.trim()
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fencedMatch?.[1]?.trim()) {
    return fencedMatch[1].trim()
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  return trimmed
}

const COMMAND_CATEGORY_VALUES = [
  'setup',
  'dev',
  'typecheck',
  'lint',
  'test',
  'build',
  'e2e',
  'db',
  'other'
] as const satisfies readonly OnboardingCommandItem['category'][]
const COMMAND_RISK_VALUES = [
  'safe',
  'needs-approval',
  'destructive'
] as const satisfies readonly OnboardingCommandItem['risk'][]
const COMMAND_CATEGORY_SET = new Set<string>(COMMAND_CATEGORY_VALUES)
const COMMAND_RISK_SET = new Set<string>(COMMAND_RISK_VALUES)

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeEnumInput(value: unknown): string {
  return textValue(value).toLowerCase().replace(/[_\s]+/g, '-')
}

function inferOnboardingCommandCategory(
  value: unknown,
  commandValue: unknown
): OnboardingCommandItem['category'] {
  const normalized = normalizeEnumInput(value)
  if (COMMAND_CATEGORY_SET.has(normalized)) {
    return normalized as OnboardingCommandItem['category']
  }

  const command = textValue(commandValue).toLowerCase()
  const combined = `${normalized} ${command}`
  if (/\b(install|bootstrap|restore|dependency|dependencies)\b/.test(combined)) return 'setup'
  if (/\b(dev|develop|serve|start|watch)\b/.test(combined)) return 'dev'
  if (/\b(typecheck|type-check|typechecking|tsc)\b/.test(combined)) return 'typecheck'
  if (/\b(lint|eslint|ruff|checkstyle|format)\b/.test(combined)) return 'lint'
  if (/\b(test|tests|testing|verify|verification|vitest|jest|pytest|rspec)\b/.test(combined)) {
    return 'test'
  }
  if (/\b(build|compile|package)\b/.test(combined)) return 'build'
  if (/\b(e2e|end-to-end|playwright|cypress)\b/.test(combined)) return 'e2e'
  if (/\b(db|database|migrate|migration|prisma)\b/.test(combined)) return 'db'
  return 'other'
}

function inferOnboardingCommandRisk(
  value: unknown,
  commandValue: unknown
): OnboardingCommandItem['risk'] {
  const normalized = normalizeEnumInput(value)
  if (COMMAND_RISK_SET.has(normalized)) {
    return normalized as OnboardingCommandItem['risk']
  }
  if (['low', 'readonly', 'read-only', 'no-write'].includes(normalized)) {
    return 'safe'
  }
  if (
    ['medium', 'approval', 'approval-required', 'requires-approval', 'needsapproval'].includes(
      normalized
    )
  ) {
    return 'needs-approval'
  }
  if (['high', 'danger', 'dangerous'].includes(normalized)) {
    return 'destructive'
  }

  const command = textValue(commandValue).toLowerCase()
  if (
    command.includes(' reset ') ||
    command.includes(' clean ') ||
    command.includes('remove-item') ||
    command.includes('rm -rf') ||
    command.includes('drop database')
  ) {
    return 'destructive'
  }
  if (
    command.includes('install') ||
    command.includes('migrate') ||
    command.includes('deploy') ||
    command.includes('publish')
  ) {
    return 'needs-approval'
  }
  return 'safe'
}

function normalizeCodexOnboardingJson(value: unknown): { value: unknown; warnings: string[] } {
  const root = asRecord(value)
  if (!root || !Array.isArray(root.commands)) {
    return { value, warnings: [] }
  }

  const warnings: string[] = []
  const commands = root.commands.map((commandValue, index) => {
    const command = asRecord(commandValue)
    if (!command) {
      return commandValue
    }

    const category = inferOnboardingCommandCategory(command.category, command.command)
    const risk = inferOnboardingCommandRisk(command.risk, command.command)
    const rawCategory = normalizeEnumInput(command.category)
    const rawRisk = normalizeEnumInput(command.risk)
    if (rawCategory && !COMMAND_CATEGORY_SET.has(rawCategory)) {
      warnings.push(
        `Normalized invalid onboarding command category "${textValue(command.category)}" at commands[${index}].`
      )
    }
    if (rawRisk && !COMMAND_RISK_SET.has(rawRisk)) {
      warnings.push(
        `Normalized invalid onboarding command risk "${textValue(command.risk)}" at commands[${index}].`
      )
    }

    return {
      ...command,
      category,
      risk
    }
  })
  const diagnostics = asRecord(root.diagnostics)
  const diagnosticsWarnings = Array.isArray(diagnostics?.warnings)
    ? diagnostics.warnings.filter((warning): warning is string => typeof warning === 'string')
    : []

  return {
    value: {
      ...root,
      commands,
      diagnostics: diagnostics
        ? {
            ...diagnostics,
            warnings: uniqueList([...diagnosticsWarnings, ...warnings])
          }
        : diagnostics
    },
    warnings
  }
}

function parseCodexOnboardingOutput(
  rawOutput: string,
  fallbackPacket: OnboardingPacket,
  diagnostics: OnboardingPacket['diagnostics']
): OnboardingPacket {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(extractJsonCandidate(rawOutput))
  } catch (error) {
    throw new Error(
      `Codex onboarding returned non-JSON output: ${
        error instanceof Error ? error.message : 'unknown parse error'
      }`
    )
  }

  try {
    const normalized = normalizeCodexOnboardingJson(parsedJson)
    const parsed = codexOnboardingOutputSchema.parse(normalized.value)
    return OnboardingPacketSchema.parse({
      ...fallbackPacket,
      ...parsed,
      version: ONBOARDING_PACKET_VERSION,
      generatedAt: diagnostics.generatedAt,
      generationMode: 'codex-assisted',
      diagnostics: {
        ...diagnostics,
        warnings: uniqueList([
          ...fallbackPacket.diagnostics.warnings,
          ...diagnostics.warnings,
          ...parsed.diagnostics.warnings
        ])
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Codex onboarding JSON did not match the expected packet shape: ${error.message}`
      )
    }
    throw error
  }
}

async function runRunnerToCompletion(
  runner: OnboardingRunner,
  ctx: RunnerContext
): Promise<RunnerResult> {
  const iterator = runner.run(ctx)
  let stderrOutput = ''

  while (true) {
    const next = await iterator.next()
    if (next.done) {
      const result = next.value
      if (!result.success && !result.error && stderrOutput.trim()) {
        return { ...result, error: stderrOutput.trim() }
      }
      return result
    }

    if (next.value.type === 'stderr') {
      stderrOutput += next.value.content
    }
  }
}

function renderBulletLines(items: string[], fallback = '- Unknown'): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : fallback
}

function renderCommandLines(commands: OnboardingCommandItem[]): string {
  if (commands.length === 0) {
    return '- Unknown'
  }

  return commands
    .map((command) => {
      const cwd = command.cwd === '.' ? '' : ` from \`${command.cwd}\``
      return `- ${command.label}: \`${command.command}\`${cwd} (${command.category}, ${command.risk})`
    })
    .join('\n')
}

export function formatOnboardingPacketMarkdown(packet: OnboardingPacket): string {
  const body = [
    '# Fluxion Onboarding Packet',
    '',
    `Project: ${packet.projectName}`,
    `Generated: ${packet.generatedAt}`,
    `Mode: ${packet.generationMode}`,
    '',
    '## Summary',
    packet.projectSummary || 'Unknown',
    '',
    '## Stack',
    renderBulletLines(packet.stack),
    '',
    '## Architecture',
    renderBulletLines(packet.architectureMap),
    '',
    '## Components',
    renderBulletLines(packet.components.map((component) => `${component.name}: ${component.role}`)),
    '',
    '## Commands',
    renderCommandLines(packet.commands),
    '',
    '## Risks',
    renderBulletLines(packet.risks, '- No known risks.'),
    '',
    '## Open Questions',
    renderBulletLines(packet.openQuestions, '- No open questions captured.'),
    '',
    '## Suggested Stable Rules',
    renderBulletLines(packet.suggestedStableRules, '- No stable rules suggested.'),
    '',
    '## Artifact Recommendations',
    renderBulletLines(
      packet.artifactRecommendations.map(
        (artifact) => `${artifact.label}: \`${artifact.relativePath}\` - ${artifact.rationale}`
      )
    ),
    '',
    '## Source Evidence',
    renderBulletLines(
      packet.sourceEvidence.map(
        (evidence) => `\`${evidence.sourcePath}\` (${evidence.confidence}) - ${evidence.note}`
      )
    ),
    '',
    '## Diagnostics',
    `- Files read: ${packet.diagnostics.filesRead}`,
    `- Truncated files: ${packet.diagnostics.truncatedFiles.join(', ') || 'None'}`,
    `- Warnings: ${packet.diagnostics.warnings.join('; ') || 'None'}`,
    '',
    '## Suggested Context Patch',
    '```json',
    JSON.stringify(packet.suggestedContextPatch, null, 2),
    '```',
    ''
  ].join('\n')

  return matter.stringify(body, {
    type: 'long-term',
    artifact: 'onboarding-packet',
    version: packet.version,
    generatedAt: packet.generatedAt,
    generationMode: packet.generationMode
  })
}

function createWorkflowNode(
  id: string,
  label: string,
  prompt: string,
  position: { x: number; y: number },
  humanReview = false
): WorkflowNode {
  const node: WorkflowNode = {
    id,
    type: 'agentNode',
    label,
    position,
    data: {
      provider: 'codex',
      runner: 'codex',
      model: CODEX_DEFAULT_MODEL,
      label,
      prompt,
      reasoningLevel: 'medium',
      humanReview,
      codex: {
        json: false,
        sandboxMode: 'read-only',
        approvalPolicy: 'never'
      }
    }
  }

  WorkflowNodeSchema.parse(node)
  return node
}

function createOnboardingWorkflowDocument(
  workspacePath: string,
  packet: OnboardingPacket | null,
  now: Date
): CreateOnboardingWorkflowResult['workflow'] {
  const workspaceName = path.basename(workspacePath) || 'Workspace'
  const projectName = packet?.projectName || workspaceName
  const packetPath = '.fluxion/memory/long-term/onboarding.md'
  const nodeA = createWorkflowNode(
    'onboarding-detect',
    'Detect repository signals',
    [
      'Inspect the repository in read-only mode.',
      'Summarize stack signals, manifests, existing instruction files, and important paths.',
      `Use ${packetPath} if it exists, but verify claims against source evidence.`
    ].join('\n'),
    { x: 80, y: 160 }
  )
  const nodeB = createWorkflowNode(
    'onboarding-architecture',
    'Map architecture',
    'Use the detected repository signals to map major components, boundaries, entrypoints, and ownership areas. Keep uncertainty explicit.',
    { x: 400, y: 160 }
  )
  const nodeC = createWorkflowNode(
    'onboarding-commands-risks',
    'Identify commands and risks',
    'Identify safe setup, build, lint, typecheck, and test commands. Flag commands needing approval and any missing verification path.',
    { x: 720, y: 160 }
  )
  const nodeD = createWorkflowNode(
    'onboarding-review',
    'Review onboarding packet',
    [
      'Review the upstream onboarding findings.',
      'Produce a concise final packet with Summary, Architecture, Commands, Risks, Evidence, and Open Questions.',
      'Do not modify source files.'
    ].join('\n'),
    { x: 1040, y: 160 },
    true
  )

  const workflow: CreateOnboardingWorkflowResult['workflow'] = {
    id: ulid(),
    name: `${projectName} - Codex Onboarding`,
    description:
      'Read-only onboarding DAG for mapping repository signals, architecture, commands, risks, and review notes.',
    tags: ['onboarding', 'codex'],
    executionMode: 'manual',
    fluxionVersion: '1.0',
    nodes: [nodeA, nodeB, nodeC, nodeD],
    edges: [
      { id: 'onboarding-edge-detect-architecture', source: nodeA.id, target: nodeB.id },
      { id: 'onboarding-edge-architecture-commands', source: nodeB.id, target: nodeC.id },
      { id: 'onboarding-edge-commands-review', source: nodeC.id, target: nodeD.id }
    ],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }

  WorkflowSchema.parse(workflow)
  return workflow
}

async function uniqueWorkflowFilePath(workspacePath: string): Promise<string> {
  const workflowsDir = path.join(workspacePath, '.fluxion', 'workflows')
  let filePath = path.join(workflowsDir, 'codex-onboarding.fluxion.json')
  let counter = 1

  while (true) {
    try {
      await fs.access(filePath)
      filePath = path.join(workflowsDir, `codex-onboarding-${counter}.fluxion.json`)
      counter += 1
    } catch {
      return filePath
    }
  }
}

function createPreviewOperation(
  workspacePath: string,
  relativePath: string,
  description: string,
  content: string,
  existingContent: string | null
): AgentConfigFileOperation {
  return {
    action: existingContent === null ? 'create' : 'update',
    relativePath,
    absolutePath: path.join(workspacePath, ...relativePath.split('/')),
    description,
    content,
    existingContent: existingContent ?? undefined
  }
}

function renderRepoSkillMarkdown(packet: OnboardingPacket): string {
  return [
    '---',
    'name: fluxion-onboarding',
    'description: Use when initializing project context or when the user explicitly asks to run Fluxion onboarding for this repository.',
    '---',
    '',
    '# Fluxion Onboarding',
    '',
    'Use this skill only during context initialization or when the user asks for onboarding.',
    '',
    '## Workflow',
    '',
    '1. Read repository evidence first: manifests, README, existing agent instructions, important source roots, and Fluxion context.',
    '2. Produce a compact onboarding packet with Summary, Architecture, Commands, Risks, Evidence, and Open Questions.',
    '3. Keep durable rules short. Put detailed findings in long-term memory instead of expanding AGENTS.md.',
    '4. Do not install global skills, edit source files, or run write-capable commands unless the user asks.',
    '',
    '## Output',
    '',
    '- Summary: what the project does and who it serves.',
    '- Architecture: components, boundaries, entrypoints, and important paths.',
    '- Commands: setup, dev, typecheck, lint, test, and build commands with risk levels.',
    '- Risks: approval needs, generated paths, missing verification, and uncertainty.',
    '- Evidence: source paths that support the packet.',
    '',
    '## References',
    '',
    '- `references/onboarding-packet.md` is the latest Fluxion-generated packet.',
    '- `.fluxion/context.json` is the compact runtime context.',
    '- `.fluxion/memory/global-context.md` is the global context passed to workflows.',
    '',
    '## Current Packet Snapshot',
    '',
    `Project: ${packet.projectName}`,
    `Mode: ${packet.generationMode}`,
    `Generated: ${packet.generatedAt}`,
    ''
  ].join('\n')
}

function renderContextReference(context: ProjectContextDraft | null | undefined): string {
  if (!context) {
    return '# Fluxion Context Reference\n\nNo Fluxion context was provided when this skill was exported.\n'
  }

  return [
    '# Fluxion Context Reference',
    '',
    `Project: ${context.projectName}`,
    `Status: ${context.contextStatus}`,
    '',
    '## Goal',
    context.projectGoal || 'Unknown',
    '',
    '## Architecture',
    context.architectureSummary || 'Unknown',
    '',
    '## Durable Rules',
    renderBulletLines(context.stableRules, '- Unknown'),
    '',
    '## Important Paths',
    renderBulletLines(
      context.importantPaths.map((item) => `\`${item}\``),
      '- Unknown'
    ),
    ''
  ].join('\n')
}

function assertWorkspaceBound(workspacePath: string, absolutePath: string): void {
  const workspaceRoot = path.resolve(workspacePath)
  const targetPath = path.resolve(absolutePath)
  const relativePath = path.relative(workspaceRoot, targetPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to write outside the workspace: ${absolutePath}`)
  }
}

export class OnboardingService {
  private readonly runner: OnboardingRunner
  private readonly now: () => Date
  private readonly scanWorkspaceContext: (workspacePath: string) => Promise<ContextScanResult>
  private readonly createSnapshot: (workspacePath: string) => Promise<WorkspaceSnapshot>

  public constructor(dependencies: OnboardingServiceDependencies = {}) {
    this.runner = dependencies.runner ?? new CodexCliRunner()
    this.now = dependencies.now ?? (() => new Date())
    this.scanWorkspaceContext = dependencies.scanWorkspaceContext ?? scanWorkspaceContextService
    this.createSnapshot = dependencies.createSnapshot ?? createWorkspaceSnapshot
  }

  public async generatePacket(request: GenerateOnboardingPacketRequest): Promise<OnboardingPacket> {
    const workspacePath = path.resolve(request.workspacePath)
    const scanResult = request.scanResult ?? (await this.scanWorkspaceContext(workspacePath))
    const draft = draftFromRequest(workspacePath, scanResult, request.draft)
    const evidencePack = await buildEvidencePack(
      workspacePath,
      draft,
      scanResult,
      this.createSnapshot
    )
    const mode = request.mode ?? 'deterministic'
    const model = cleanString(request.model) || CODEX_DEFAULT_MODEL
    const deterministicPacket = buildDeterministicPacket({
      draft,
      scanResult,
      evidencePack,
      now: this.now(),
      mode: mode === 'codex-assisted' ? 'deterministic' : mode
    })

    if (mode !== 'codex-assisted') {
      return deterministicPacket
    }
    if (evidencePack.files.length === 0) {
      throw new Error('No readable project evidence was found for Codex onboarding.')
    }

    const generatedAt = this.now().toISOString()
    const prompt = buildCodexOnboardingPrompt({
      draft,
      scanResult,
      evidencePack,
      deterministicPacket
    })
    const node = WorkflowNodeSchema.parse({
      id: 'onboarding-packet',
      type: 'agentNode',
      label: 'Fluxion Onboarding Packet',
      position: { x: 0, y: 0 },
      data: {
        provider: 'codex',
        runner: 'codex',
        model,
        prompt,
        reasoningLevel: 'medium',
        codex: {
          json: true,
          sandboxMode: 'read-only',
          approvalPolicy: 'never'
        }
      }
    })
    const result = await runRunnerToCompletion(this.runner, {
      runId: `onboarding-packet-${randomUUID()}`,
      workflowId: 'onboarding-packet',
      node,
      prompt,
      workspacePath
    })

    if (!result.success) {
      throw new Error(result.error ?? 'Codex onboarding failed.')
    }
    if (!result.output?.trim()) {
      throw new Error('Codex onboarding completed without a final response.')
    }

    return parseCodexOnboardingOutput(result.output, deterministicPacket, {
      generatedAt,
      mode: 'codex-assisted',
      model,
      filesRead: evidencePack.files.length,
      truncatedFiles: evidencePack.truncatedFiles,
      warnings: []
    })
  }

  public async savePacket(
    request: SaveOnboardingPacketRequest
  ): Promise<SaveOnboardingPacketResult> {
    const workspacePath = path.resolve(request.workspacePath)
    await memoryManager.initWorkspace(workspacePath)
    const filePath = path.join(workspacePath, '.fluxion', 'memory', 'long-term', 'onboarding.md')
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, formatOnboardingPacketMarkdown(request.packet), 'utf-8')

    return {
      filePath,
      savedAt: new Date().toISOString()
    }
  }

  public async createWorkflow(
    request: CreateOnboardingWorkflowRequest
  ): Promise<CreateOnboardingWorkflowResult> {
    const workspacePath = path.resolve(request.workspacePath)
    const workflow = createOnboardingWorkflowDocument(
      workspacePath,
      request.packet ?? null,
      this.now()
    )
    const workflowFilePath = await uniqueWorkflowFilePath(workspacePath)

    await fs.mkdir(path.dirname(workflowFilePath), { recursive: true })
    await fs.writeFile(workflowFilePath, JSON.stringify(workflow, null, 2), 'utf-8')

    return {
      workflow,
      workflowFilePath
    }
  }

  public async createRepoSkillPreview(
    request: RepoOnboardingSkillPreviewRequest
  ): Promise<RepoOnboardingSkillPreview> {
    const workspacePath = path.resolve(request.workspacePath)
    const skillPath = '.agents/skills/fluxion-onboarding/SKILL.md'
    const packetPath = '.agents/skills/fluxion-onboarding/references/onboarding-packet.md'
    const contextPath = '.agents/skills/fluxion-onboarding/references/fluxion-context.md'
    const operations = await Promise.all([
      readExistingFile(path.join(workspacePath, ...skillPath.split('/'))).then((existing) =>
        createPreviewOperation(
          workspacePath,
          skillPath,
          'Repo-local Fluxion onboarding skill definition.',
          renderRepoSkillMarkdown(request.packet),
          existing
        )
      ),
      readExistingFile(path.join(workspacePath, ...packetPath.split('/'))).then((existing) =>
        createPreviewOperation(
          workspacePath,
          packetPath,
          'Latest Fluxion onboarding packet reference.',
          formatOnboardingPacketMarkdown(request.packet),
          existing
        )
      ),
      readExistingFile(path.join(workspacePath, ...contextPath.split('/'))).then((existing) =>
        createPreviewOperation(
          workspacePath,
          contextPath,
          'Compact Fluxion context reference for the onboarding skill.',
          renderContextReference(request.context),
          existing
        )
      )
    ])

    return {
      label: 'Fluxion Onboarding Skill',
      workspacePath,
      createdAt: new Date().toISOString(),
      operations,
      warnings: [
        'This preview writes a repo-local skill only. It does not install a global Codex skill.'
      ]
    }
  }

  public async applyRepoSkillPreview(preview: RepoOnboardingSkillPreview): Promise<{
    applied: AgentConfigFileOperation[]
    skipped: AgentConfigFileOperation[]
  }> {
    const applied: AgentConfigFileOperation[] = []
    const skipped: AgentConfigFileOperation[] = []

    for (const operation of preview.operations) {
      assertWorkspaceBound(preview.workspacePath, operation.absolutePath)
      if (operation.action === 'skip' || operation.action === 'conflict') {
        skipped.push(operation)
        continue
      }

      await fs.mkdir(path.dirname(operation.absolutePath), { recursive: true })
      await fs.writeFile(operation.absolutePath, operation.content, 'utf-8')
      applied.push(operation)
    }

    return { applied, skipped }
  }
}

export const onboardingService = new OnboardingService()

export const onboardingServiceInternals = {
  buildDeterministicPacket,
  buildEvidencePack,
  buildCodexOnboardingPrompt,
  parseCodexOnboardingOutput
}
