import { z } from 'zod'
import type {
  ContextEvidenceConfidence,
  ContextScanResult,
  ProjectCommandCategory,
  ProjectCommandRisk,
  ProjectComponentType,
  ProjectContextDraft
} from './context.types'
import type { AgentConfigFileOperation } from './agent-config.types'
import type { Workflow } from './workflow.types'

export const ONBOARDING_PACKET_VERSION = '1.0' as const

export type OnboardingGenerationMode = 'deterministic' | 'codex-assisted'

export type OnboardingArtifactKind = 'context' | 'agents' | 'memory' | 'workflow' | 'repo-skill'

export interface OnboardingArchitectureItem {
  id: string
  name: string
  role: string
  type: ProjectComponentType
  rootPath: string
  technologies: string[]
  evidenceIds: string[]
}

export interface OnboardingCommandItem {
  id: string
  label: string
  command: string
  cwd: string
  category: ProjectCommandCategory
  risk: ProjectCommandRisk
  confidence: ContextEvidenceConfidence
  evidenceIds: string[]
}

export interface OnboardingEvidenceSource {
  id: string
  sourcePath: string
  confidence: ContextEvidenceConfidence
  note: string
  matchedSignals: string[]
  truncated?: boolean
  size?: number
}

export type OnboardingSuggestedContextPatch = Partial<
  Pick<
    ProjectContextDraft,
    | 'projectGoal'
    | 'targetUsers'
    | 'architectureSummary'
    | 'firstMilestone'
    | 'stableRules'
    | 'verificationCommands'
    | 'importantPaths'
    | 'focusAreas'
    | 'nonGoals'
    | 'openQuestions'
    | 'primaryStack'
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
  >
>

export interface OnboardingArtifactRecommendation {
  kind: OnboardingArtifactKind
  label: string
  relativePath: string
  rationale: string
}

export interface OnboardingSkillAsset {
  id: string
  relativePath: string
  title: string
  description: string
}

export interface OnboardingDiagnostics {
  generatedAt: string
  mode: OnboardingGenerationMode
  model?: string
  filesRead: number
  truncatedFiles: string[]
  warnings: string[]
}

export interface OnboardingPacket {
  version: typeof ONBOARDING_PACKET_VERSION
  projectName: string
  generatedAt: string
  generationMode: OnboardingGenerationMode
  projectSummary: string
  stack: string[]
  components: OnboardingArchitectureItem[]
  architectureMap: string[]
  commands: OnboardingCommandItem[]
  risks: string[]
  openQuestions: string[]
  suggestedContextPatch: OnboardingSuggestedContextPatch
  suggestedStableRules: string[]
  artifactRecommendations: OnboardingArtifactRecommendation[]
  skillAssets: OnboardingSkillAsset[]
  sourceEvidence: OnboardingEvidenceSource[]
  diagnostics: OnboardingDiagnostics
}

export interface GenerateOnboardingPacketRequest {
  workspacePath: string
  draft?: ProjectContextDraft | null
  scanResult?: ContextScanResult | null
  mode?: OnboardingGenerationMode
  model?: string
}

export interface SaveOnboardingPacketRequest {
  workspacePath: string
  packet: OnboardingPacket
}

export interface SaveOnboardingPacketResult {
  filePath: string
  savedAt: string
}

export interface CreateOnboardingWorkflowRequest {
  workspacePath: string
  packet?: OnboardingPacket | null
}

export interface CreateOnboardingWorkflowResult {
  workflow: Workflow
  workflowFilePath: string
}

export interface RepoOnboardingSkillPreviewRequest {
  workspacePath: string
  packet: OnboardingPacket
  context?: ProjectContextDraft | null
}

export interface RepoOnboardingSkillPreview {
  label: string
  workspacePath: string
  createdAt: string
  operations: AgentConfigFileOperation[]
  warnings: string[]
}

export interface ApplyRepoOnboardingSkillPreviewRequest {
  preview: RepoOnboardingSkillPreview
}

export interface ApplyRepoOnboardingSkillPreviewResult {
  applied: AgentConfigFileOperation[]
  skipped: AgentConfigFileOperation[]
}

const contextEvidenceConfidenceSchema = z.enum(['high', 'medium', 'low'])
const projectComponentTypeSchema = z.enum([
  'frontend',
  'backend',
  'desktop',
  'mobile',
  'worker',
  'library',
  'cli',
  'infra',
  'unknown'
])
const projectCommandCategorySchema = z.enum([
  'setup',
  'dev',
  'typecheck',
  'lint',
  'test',
  'build',
  'e2e',
  'db',
  'other'
])
const projectCommandRiskSchema = z.enum(['safe', 'needs-approval', 'destructive'])

export const OnboardingArchitectureItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string(),
  type: projectComponentTypeSchema,
  rootPath: z.string().min(1),
  technologies: z.array(z.string()),
  evidenceIds: z.array(z.string())
})

export const OnboardingCommandItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  command: z.string().min(1),
  cwd: z.string().min(1),
  category: projectCommandCategorySchema,
  risk: projectCommandRiskSchema,
  confidence: contextEvidenceConfidenceSchema,
  evidenceIds: z.array(z.string())
})

export const OnboardingEvidenceSourceSchema = z.object({
  id: z.string().min(1),
  sourcePath: z.string().min(1),
  confidence: contextEvidenceConfidenceSchema,
  note: z.string(),
  matchedSignals: z.array(z.string()),
  truncated: z.boolean().optional(),
  size: z.number().int().nonnegative().optional()
})

export const OnboardingSuggestedContextPatchSchema = z
  .object({
    projectGoal: z.string().optional(),
    targetUsers: z.string().optional(),
    architectureSummary: z.string().optional(),
    firstMilestone: z.string().optional(),
    stableRules: z.array(z.string()).optional(),
    verificationCommands: z.array(z.string()).optional(),
    importantPaths: z.array(z.string()).optional(),
    focusAreas: z.array(z.string()).optional(),
    nonGoals: z.array(z.string()).optional(),
    openQuestions: z.array(z.string()).optional(),
    primaryStack: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    frameworks: z.array(z.string()).optional(),
    packageManagers: z.array(z.string()).optional(),
    buildSystems: z.array(z.string()).optional(),
    testFrameworks: z.array(z.string()).optional(),
    entrypoints: z.array(z.string()).optional(),
    moduleBoundaries: z.array(z.string()).optional(),
    generatedOrIgnoredPaths: z.array(z.string()).optional(),
    riskFlags: z.array(z.string()).optional(),
    recommendedFirstActions: z.array(z.string()).optional()
  })
  .strict()

export const OnboardingArtifactRecommendationSchema = z.object({
  kind: z.enum(['context', 'agents', 'memory', 'workflow', 'repo-skill']),
  label: z.string().min(1),
  relativePath: z.string().min(1),
  rationale: z.string()
})

export const OnboardingSkillAssetSchema = z.object({
  id: z.string().min(1),
  relativePath: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1)
})

export const OnboardingDiagnosticsSchema = z.object({
  generatedAt: z.string().min(1),
  mode: z.enum(['deterministic', 'codex-assisted']),
  model: z.string().optional(),
  filesRead: z.number().int().nonnegative(),
  truncatedFiles: z.array(z.string()),
  warnings: z.array(z.string())
})

export const OnboardingPacketSchema = z.object({
  version: z.literal(ONBOARDING_PACKET_VERSION),
  projectName: z.string().min(1),
  generatedAt: z.string().min(1),
  generationMode: z.enum(['deterministic', 'codex-assisted']),
  projectSummary: z.string(),
  stack: z.array(z.string()),
  components: z.array(OnboardingArchitectureItemSchema),
  architectureMap: z.array(z.string()),
  commands: z.array(OnboardingCommandItemSchema),
  risks: z.array(z.string()),
  openQuestions: z.array(z.string()),
  suggestedContextPatch: OnboardingSuggestedContextPatchSchema,
  suggestedStableRules: z.array(z.string()),
  artifactRecommendations: z.array(OnboardingArtifactRecommendationSchema),
  skillAssets: z.array(OnboardingSkillAssetSchema).default([]),
  sourceEvidence: z.array(OnboardingEvidenceSourceSchema),
  diagnostics: OnboardingDiagnosticsSchema
}) satisfies z.ZodType<OnboardingPacket>
