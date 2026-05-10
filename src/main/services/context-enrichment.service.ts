import { randomUUID } from 'crypto'
import * as path from 'path'
import { z } from 'zod'
import { RunnerContext, RunnerEvent, RunnerResult, WorkflowNodeSchema } from '@core'
import {
  CODEX_DEFAULT_MODEL,
  ContextEnrichmentDiagnostics,
  ContextEnrichmentField,
  ContextEnrichmentRequest,
  ContextEnrichmentResult,
  ContextEnrichmentSuggestedFields,
  ContextScanResult,
  ContextSourceEvidence,
  ProjectContextDraft
} from '@shared'
import { CodexCliRunner } from '../runners/codex-cli-runner'
import { scanWorkspaceContext as scanWorkspaceContextService } from './context-scout.service'
import {
  createWorkspaceSnapshot,
  WorkspaceSnapshot,
  WorkspaceSnapshotFile
} from './context/workspace-snapshot'

const MAX_EVIDENCE_FILES = 14
const MAX_FILE_BYTES = 12 * 1024
const MAX_TOTAL_TEXT_BYTES = 70 * 1024

const ENRICHMENT_FIELDS = [
  'projectGoal',
  'targetUsers',
  'architectureSummary',
  'stableRules',
  'focusAreas',
  'openQuestions',
  'recommendedFirstActions'
] as const satisfies readonly ContextEnrichmentField[]

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
  'composer.json',
  'Gemfile',
  '.cursorrules',
  '.github/copilot-instructions.md',
  'CLAUDE.md',
  'GEMINI.md'
] as const

interface ContextEnrichmentRunner {
  run(ctx: RunnerContext): AsyncGenerator<RunnerEvent, RunnerResult, void>
}

interface ContextEvidenceFile {
  relativePath: string
  content: string
  truncated: boolean
  size: number
}

interface ContextEvidencePack {
  files: ContextEvidenceFile[]
  truncatedFiles: string[]
}

interface ContextEnrichmentServiceDependencies {
  runner?: ContextEnrichmentRunner
  now?: () => Date
  scanWorkspaceContext?: (workspacePath: string) => Promise<ContextScanResult>
  createSnapshot?: (workspacePath: string) => Promise<WorkspaceSnapshot>
}

const enrichmentFieldSchema = z.enum(ENRICHMENT_FIELDS)

const enrichmentFieldsSchema = z.object({
  projectGoal: z.string().optional(),
  targetUsers: z.string().optional(),
  architectureSummary: z.string().optional(),
  stableRules: z.array(z.string()).optional(),
  focusAreas: z.array(z.string()).optional(),
  openQuestions: z.array(z.string()).optional(),
  recommendedFirstActions: z.array(z.string()).optional()
})

const enrichmentOutputSchema = enrichmentFieldsSchema.extend({
  fields: enrichmentFieldsSchema.optional(),
  evidence: z
    .array(
      z.object({
        field: enrichmentFieldSchema,
        sourcePath: z.string(),
        confidence: z.enum(['high', 'medium', 'low']).optional(),
        note: z.string().optional(),
        matchedSignals: z.array(z.string()).optional()
      })
    )
    .optional(),
  warnings: z.array(z.string()).optional()
})

function cleanString(value: string | undefined): string {
  return value?.trim().replace(/\r\n/g, '\n') ?? ''
}

function uniqueList(values: string[]): string[] {
  return [...new Set(values.map((value) => cleanString(value)).filter(Boolean))]
}

function hasSuggestedFields(fields: ContextEnrichmentSuggestedFields): boolean {
  return Object.values(fields).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0
    }

    return typeof value === 'string' && value.trim().length > 0
  })
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
  const name = normalized.split('/').pop() ?? normalized

  return (
    name === '.env' ||
    name.startsWith('.env.') ||
    normalized.includes('secret') ||
    normalized.includes('credential') ||
    normalized.includes('private-key') ||
    normalized.endsWith('.pem') ||
    normalized.endsWith('.key') ||
    normalized.endsWith('id_rsa')
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
  const candidates = [
    ...PRIORITY_SIGNAL_FILES,
    ...scanResult.scannedFiles,
    ...scanResult.discoveredPaths,
    ...draft.importantPaths,
    ...draft.entrypoints,
    ...draft.moduleBoundaries,
    ...draft.agentInstructionSources.map((source) => source.sourcePath)
  ]
  const normalizedCandidates = candidates
    .map((candidate) => normalizeRelativePath(candidate))
    .filter((candidate): candidate is string => Boolean(candidate))
    .filter((candidate) => !shouldSkipSensitivePath(candidate))

  return uniqueList(normalizedCandidates)
}

async function buildEvidencePack(
  workspacePath: string,
  draft: ProjectContextDraft,
  scanResult: ContextScanResult,
  createSnapshot: (workspacePath: string) => Promise<WorkspaceSnapshot>
): Promise<ContextEvidencePack> {
  const snapshot = await createSnapshot(workspacePath)
  const files: ContextEvidenceFile[] = []
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

  return {
    files,
    truncatedFiles
  }
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
    recommendedFirstActions: draft.recommendedFirstActions
  }
}

function pickScanForPrompt(scanResult: ContextScanResult): Record<string, unknown> {
  const detectedFields = scanResult.detectedFields

  return {
    workspaceType: scanResult.workspaceType,
    projectName: scanResult.projectName,
    unresolvedFields: scanResult.unresolvedFields,
    scannedFiles: scanResult.scannedFiles.slice(0, 40),
    discoveredPaths: scanResult.discoveredPaths.slice(0, 40),
    detectedFields: {
      projectGoal: detectedFields.projectGoal,
      targetUsers: detectedFields.targetUsers,
      primaryStack: detectedFields.primaryStack,
      languages: detectedFields.languages,
      frameworks: detectedFields.frameworks,
      architectureSummary: detectedFields.architectureSummary,
      verificationCommands: detectedFields.verificationCommands,
      importantPaths: detectedFields.importantPaths,
      entrypoints: detectedFields.entrypoints,
      moduleBoundaries: detectedFields.moduleBoundaries,
      riskFlags: detectedFields.riskFlags,
      recommendedFirstActions: detectedFields.recommendedFirstActions
    }
  }
}

export function buildContextEnrichmentPrompt(options: {
  draft: ProjectContextDraft
  scanResult: ContextScanResult
  evidencePack: ContextEvidencePack
}): string {
  const payload = {
    currentDraft: pickDraftForPrompt(options.draft),
    scanSummary: pickScanForPrompt(options.scanResult),
    evidenceFiles: options.evidencePack.files.map((file) => ({
      sourcePath: file.relativePath,
      truncated: file.truncated,
      size: file.size,
      content: file.content
    }))
  }

  return [
    'You are enriching Fluxion Project Context for a local Codex CLI workflow tool.',
    '',
    'Task:',
    '- Improve only these fields: projectGoal, targetUsers, architectureSummary, stableRules, focusAreas, openQuestions, recommendedFirstActions.',
    '- Use only the provided current draft, scan summary, and evidence files.',
    '- Preserve user-authored intent. Do not remove specific user constraints.',
    '- Do not invent APIs, commands, product plans, providers, or runtime behavior.',
    '- Put uncertainty in openQuestions instead of guessing.',
    '- Cite sourcePath values from evidenceFiles whenever possible.',
    '- Do not edit files or ask to run commands.',
    '',
    'Return strict JSON only. No markdown fences, no prose.',
    'Shape:',
    JSON.stringify(
      {
        fields: {
          projectGoal: 'short concrete description',
          targetUsers: 'who uses or reviews this project',
          architectureSummary: 'high-level architecture grounded in evidence',
          stableRules: ['durable project rule'],
          focusAreas: ['area agents should prioritize'],
          openQuestions: ['unknown that needs human review'],
          recommendedFirstActions: ['safe next action']
        },
        evidence: [
          {
            field: 'architectureSummary',
            sourcePath: 'README.md',
            confidence: 'medium',
            note: 'Why this source supports the suggestion',
            matchedSignals: ['optional matched phrase']
          }
        ],
        warnings: ['optional parsing or confidence warning']
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

function normalizeSuggestedFields(
  value: z.infer<typeof enrichmentFieldsSchema>
): ContextEnrichmentSuggestedFields {
  const fields: ContextEnrichmentSuggestedFields = {}
  const projectGoal = cleanString(value.projectGoal)
  const targetUsers = cleanString(value.targetUsers)
  const architectureSummary = cleanString(value.architectureSummary)
  const stableRules = uniqueList(value.stableRules ?? [])
  const focusAreas = uniqueList(value.focusAreas ?? [])
  const openQuestions = uniqueList(value.openQuestions ?? [])
  const recommendedFirstActions = uniqueList(value.recommendedFirstActions ?? [])

  if (projectGoal) fields.projectGoal = projectGoal
  if (targetUsers) fields.targetUsers = targetUsers
  if (architectureSummary) fields.architectureSummary = architectureSummary
  if (stableRules.length > 0) fields.stableRules = stableRules
  if (focusAreas.length > 0) fields.focusAreas = focusAreas
  if (openQuestions.length > 0) fields.openQuestions = openQuestions
  if (recommendedFirstActions.length > 0) {
    fields.recommendedFirstActions = recommendedFirstActions
  }

  return fields
}

function normalizeSourceEvidence(
  evidence: z.infer<typeof enrichmentOutputSchema>['evidence'] = [],
  suggestedFields: ContextEnrichmentSuggestedFields
): ContextSourceEvidence[] {
  const suggestedFieldSet = new Set(Object.keys(suggestedFields))

  return evidence
    .filter((item) => suggestedFieldSet.has(item.field))
    .map((item, index) => {
      const note = cleanString(item.note) || 'Suggested by Codex context enrichment.'
      return {
        id: `codex-enrichment-${item.field}-${index + 1}`,
        field: item.field,
        sourcePath: cleanString(item.sourcePath) || 'codex-enrichment',
        confidence: item.confidence ?? 'medium',
        detectorId: 'codex-context-enrichment',
        note,
        confidenceReason: note,
        matchedSignals: uniqueList(item.matchedSignals ?? [])
      }
    })
}

export function parseContextEnrichmentOutput(
  rawOutput: string,
  diagnostics: ContextEnrichmentDiagnostics
): ContextEnrichmentResult {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(extractJsonCandidate(rawOutput))
  } catch (error) {
    throw new Error(
      `Codex enrichment returned non-JSON output: ${
        error instanceof Error ? error.message : 'unknown parse error'
      }`
    )
  }

  const parsed = enrichmentOutputSchema.parse(parsedJson)
  const fields = normalizeSuggestedFields(parsed.fields ?? parsed)

  if (!hasSuggestedFields(fields)) {
    throw new Error('Codex enrichment did not return any usable context fields.')
  }

  return {
    suggestedFields: fields,
    sourceEvidence: normalizeSourceEvidence(parsed.evidence, fields),
    diagnostics: {
      ...diagnostics,
      warnings: uniqueList([...(diagnostics.warnings ?? []), ...(parsed.warnings ?? [])])
    }
  }
}

async function runRunnerToCompletion(
  runner: ContextEnrichmentRunner,
  ctx: RunnerContext
): Promise<RunnerResult> {
  const iterator = runner.run(ctx)
  let stderrOutput = ''

  while (true) {
    const next = await iterator.next()
    if (next.done) {
      const result = next.value
      if (!result.success && !result.error && stderrOutput.trim()) {
        return {
          ...result,
          error: stderrOutput.trim()
        }
      }

      return result
    }

    if (next.value.type === 'stderr') {
      stderrOutput += next.value.content
    }
  }
}

export class ContextEnrichmentService {
  private readonly runner: ContextEnrichmentRunner
  private readonly now: () => Date
  private readonly scanWorkspaceContext: (workspacePath: string) => Promise<ContextScanResult>
  private readonly createSnapshot: (workspacePath: string) => Promise<WorkspaceSnapshot>

  public constructor(dependencies: ContextEnrichmentServiceDependencies = {}) {
    this.runner = dependencies.runner ?? new CodexCliRunner()
    this.now = dependencies.now ?? (() => new Date())
    this.scanWorkspaceContext = dependencies.scanWorkspaceContext ?? scanWorkspaceContextService
    this.createSnapshot = dependencies.createSnapshot ?? createWorkspaceSnapshot
  }

  public async enrich(request: ContextEnrichmentRequest): Promise<ContextEnrichmentResult> {
    const workspacePath = path.resolve(request.workspacePath)
    const scanResult = request.scanResult ?? (await this.scanWorkspaceContext(workspacePath))
    const evidencePack = await buildEvidencePack(
      workspacePath,
      request.draft,
      scanResult,
      this.createSnapshot
    )

    if (evidencePack.files.length === 0) {
      throw new Error('No readable project evidence was found for Codex enrichment.')
    }

    const model = cleanString(request.model) || CODEX_DEFAULT_MODEL
    const prompt = buildContextEnrichmentPrompt({
      draft: request.draft,
      scanResult,
      evidencePack
    })
    const node = WorkflowNodeSchema.parse({
      id: 'context-enrichment',
      type: 'agentNode',
      label: 'Context Enrichment',
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
      runId: `context-enrichment-${randomUUID()}`,
      workflowId: 'context-enrichment',
      node,
      prompt,
      workspacePath
    })

    if (!result.success) {
      throw new Error(result.error ?? 'Codex enrichment failed.')
    }
    if (!result.output?.trim()) {
      throw new Error('Codex enrichment completed without a final response.')
    }

    return parseContextEnrichmentOutput(result.output, {
      generatedAt: this.now().toISOString(),
      model,
      filesRead: evidencePack.files.length,
      truncatedFiles: evidencePack.truncatedFiles,
      warnings: []
    })
  }
}

export const contextEnrichmentService = new ContextEnrichmentService()
