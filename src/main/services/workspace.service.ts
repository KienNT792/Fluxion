import * as fs from 'fs/promises'
import * as path from 'path'
import { type FSWatcher, watch } from 'chokidar'
import { z } from 'zod'
import { ulid } from 'ulid'
import {
  buildSkippedProjectContextDraft,
  CODEX_DEFAULT_MODEL,
  ContextScanResult,
  ContextSaveMode,
  createEmptyProjectContextDraft,
  ExecutionMode,
  IpcChannels,
  formatProjectContextMarkdown,
  normalizeProjectContextDraft,
  NodeId,
  PROJECT_CONTEXT_VERSION,
  ProjectContextDraft,
  ProjectContextOnboarding,
  RecoveredReviewPayload,
  resolveProjectContextStatus,
  Workflow,
  WorkflowNode,
  WorkspaceLoadingStep,
  WorkspaceOpenedPayload,
  WorkspaceContextSavedPayload,
  WorkspaceFileChangedPayload,
  WorkflowSavedPayload,
  WorkflowMetadata,
  FluxionSchemaVersion
} from '@shared'
import { scanWorkspaceContext } from './context-scout.service'
import { memoryManager } from './memory-manager'
import { runStateStore } from './run-state-store'

const workflowNodeDataSchema = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
    label: z.string().optional(),
    prompt: z.string(),
    systemInstruction: z.string().optional(),
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
    reasoningLevel: z.enum(['low', 'medium', 'high', 'xhigh']).optional()
  })
  .passthrough()

const workflowFileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  executionMode: z.enum(['auto', 'manual']).optional(),
  fluxionVersion: z.string().optional(),
  nodes: z.array(
    z.object({
      id: z.string().min(1),
      type: z.string().optional(),
      label: z.string().optional(),
      data: workflowNodeDataSchema,
      position: z.object({
        x: z.number(),
        y: z.number()
      })
    })
  ),
  edges: z.array(
    z.object({
      id: z.string().min(1),
      source: z.string().min(1),
      target: z.string().min(1),
      label: z.string().optional()
    })
  ),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

type WorkflowFile = z.infer<typeof workflowFileSchema>
type SupportedChangeType = 'add' | 'change' | 'unlink'
const projectContextFieldEnum = z.enum([
  'workspaceType',
  'projectName',
  'kickoffIntent',
  'projectGoal',
  'targetUsers',
  'primaryStack',
  'architectureSummary',
  'firstMilestone',
  'stableRules',
  'verificationCommands',
  'importantPaths',
  'focusAreas',
  'nonGoals',
  'openQuestions',
  'languages',
  'frameworks',
  'packageManagers',
  'buildSystems',
  'testFrameworks',
  'entrypoints',
  'moduleBoundaries',
  'generatedOrIgnoredPaths',
  'riskFlags',
  'recommendedFirstActions',
  'workspaceTrust',
  'components',
  'commandCatalog',
  'agentInstructionSources',
  'securityPolicy',
  'readiness'
])

const contextSourceEvidenceSchema = z.object({
  id: z.string().optional(),
  field: projectContextFieldEnum,
  sourcePath: z.string().min(1),
  confidence: z.enum(['high', 'medium', 'low']),
  note: z.string().optional(),
  detectorId: z.string().optional(),
  matchedSignals: z.array(z.string()).optional(),
  rawValue: z.string().optional(),
  confidenceReason: z.string().optional()
})

const projectContextComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum([
    'frontend',
    'backend',
    'desktop',
    'mobile',
    'worker',
    'library',
    'cli',
    'infra',
    'unknown'
  ]),
  rootPath: z.string(),
  languages: z.array(z.string()),
  frameworks: z.array(z.string()),
  entrypoints: z.array(z.string()),
  verificationCommands: z.array(z.string()),
  evidenceIds: z.array(z.string())
})

const projectContextCommandSchema = z.object({
  id: z.string(),
  label: z.string(),
  command: z.string(),
  cwd: z.string(),
  category: z.enum(['setup', 'dev', 'typecheck', 'lint', 'test', 'build', 'e2e', 'db', 'other']),
  risk: z.enum(['safe', 'needs-approval', 'destructive']),
  confidence: z.enum(['high', 'medium', 'low']),
  evidenceIds: z.array(z.string())
})

const agentInstructionSourceSchema = z.object({
  target: z.enum([
    'codex',
    'claude',
    'gemini',
    'cursor',
    'cline',
    'windsurf',
    'copilot',
    'generic'
  ]),
  sourcePath: z.string(),
  scope: z.string(),
  activation: z.enum(['always', 'path', 'manual', 'agent-requested', 'unknown']),
  priority: z.number(),
  trusted: z.boolean()
})

const projectSecurityPolicySchema = z.object({
  sensitivePaths: z.array(z.string()),
  generatedOrIgnoredPaths: z.array(z.string()),
  writableRoots: z.array(z.string()),
  approvalRequiredFor: z.array(z.string()),
  destructiveCommands: z.array(z.string()),
  networkPolicy: z.enum(['unknown', 'disabled', 'limited', 'full'])
})

const projectContextReadinessSchema = z.object({
  status: z.enum(['incomplete', 'ready']),
  missingItems: z.array(z.string()),
  riskFlags: z.array(z.string()),
  recommendedFirstActions: z.array(z.string())
})

const projectContextOnboardingSchema = z.object({
  initialPromptDismissedAt: z.string().optional(),
  incompleteBannerDismissedAt: z.string().optional(),
  legacyWorkflowDecision: z.enum(['keep', 'migrated']).optional(),
  legacyWorkflowDecisionAt: z.string().optional()
})

const projectContextDraftSchema = z.object({
  version: z.literal(PROJECT_CONTEXT_VERSION),
  workspaceType: z.enum(['blank', 'existing', 'existing_with_instructions']),
  projectName: z.string().min(1),
  kickoffIntent: z.enum(['desktop-app', 'cli-tool', 'web-app', 'not-sure-yet']).optional(),
  projectGoal: z.string(),
  targetUsers: z.string(),
  primaryStack: z.array(z.string()),
  architectureSummary: z.string(),
  firstMilestone: z.string(),
  stableRules: z.array(z.string()),
  verificationCommands: z.array(z.string()),
  importantPaths: z.array(z.string()),
  focusAreas: z.array(z.string()),
  nonGoals: z.array(z.string()),
  openQuestions: z.array(z.string()),
  languages: z.array(z.string()).optional(),
  frameworks: z.array(z.string()).optional(),
  packageManagers: z.array(z.string()).optional(),
  buildSystems: z.array(z.string()).optional(),
  testFrameworks: z.array(z.string()).optional(),
  entrypoints: z.array(z.string()).optional(),
  moduleBoundaries: z.array(z.string()).optional(),
  generatedOrIgnoredPaths: z.array(z.string()).optional(),
  riskFlags: z.array(z.string()).optional(),
  recommendedFirstActions: z.array(z.string()).optional(),
  workspaceTrust: z.enum(['unknown', 'trusted', 'untrusted']).optional(),
  components: z.array(projectContextComponentSchema).optional(),
  commandCatalog: z.array(projectContextCommandSchema).optional(),
  agentInstructionSources: z.array(agentInstructionSourceSchema).optional(),
  securityPolicy: projectSecurityPolicySchema.optional(),
  readiness: projectContextReadinessSchema.optional(),
  contextOnboarding: projectContextOnboardingSchema.optional(),
  sourceEvidence: z.array(contextSourceEvidenceSchema),
  lastReviewedAt: z.string(),
  contextStatus: z.enum(['missing', 'incomplete', 'ready', 'legacy'])
})

const legacyContextSchema = z
  .object({
    objective: z.string().optional(),
    language: z.string().optional(),
    architecture: z.string().optional(),
    styleGuide: z.string().optional(),
    focusAreas: z.string().optional(),
    createdAt: z.string().optional()
  })
  .passthrough()

function splitLegacyList(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(/[\r\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function mapLegacyContextToDraft(
  value: z.infer<typeof legacyContextSchema>,
  workspacePath: string
): ProjectContextDraft {
  const projectName = path.basename(workspacePath) || 'Workspace'

  return normalizeProjectContextDraft({
    version: PROJECT_CONTEXT_VERSION,
    workspaceType: 'existing',
    projectName,
    projectGoal: value.objective ?? '',
    primaryStack: splitLegacyList(value.language),
    architectureSummary: value.architecture ?? '',
    stableRules: splitLegacyList(value.styleGuide),
    focusAreas: splitLegacyList(value.focusAreas),
    openQuestions: ['Legacy workspace context needs review and resave.'],
    lastReviewedAt: value.createdAt ?? new Date(0).toISOString(),
    contextStatus: 'legacy'
  })
}

function getContextValidationError(draft: ProjectContextDraft): string | null {
  if (!draft.projectName.trim()) {
    return 'Project name is required before saving project context.'
  }

  if (!draft.projectGoal.trim()) {
    return 'Project goal is required before saving project context.'
  }

  if (draft.workspaceType === 'blank') {
    const hasTargetStack =
      draft.primaryStack.length > 0 || draft.languages.length > 0 || draft.frameworks.length > 0
    if (!draft.firstMilestone.trim() || !draft.kickoffIntent || !hasTargetStack) {
      return 'First milestone, kickoff intent, and target stack are required before saving a blank-project context.'
    }
  }

  return null
}

function sanitizeWorkflowNodeData(
  data: WorkflowFile['nodes'][number]['data']
): WorkflowNode['data'] {
  const model =
    typeof data.model === 'string' && data.model.trim().length > 0
      ? data.model.trim()
      : CODEX_DEFAULT_MODEL

  return {
    ...data,
    provider: 'codex',
    model
  }
}

function normalizePathForCompare(value: string): string {
  return path.resolve(value).replaceAll('\\', '/').toLowerCase()
}

/**
 * Windows-safe slugify function for generating filenames.
 */
function slugify(text: string): string {
  let slug = text
    .toString()
    .toLowerCase()
    .normalize('NFD') // separate accents
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/\s+/g, '-') // replace spaces with -
    .replace(/[^\w-]+/g, '') // remove all non-word chars
    .replace(/--+/g, '-') // replace multiple - with single -
    .replace(/^-+/, '') // trim - from start
    .replace(/-+$/, '') // trim - from end

  if (!slug) {
    slug = 'workflow'
  }

  // Windows reserved names
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
  if (reserved.test(slug)) {
    slug = `${slug}-file`
  }

  return slug
}

function formatTimestampForFilename(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-')
}

export class WorkspaceService {
  private static instance: WorkspaceService
  private watcher: FSWatcher | null = null
  private currentWorkspacePath: string | null = null
  private currentSender: Electron.WebContents | null = null

  // Watcher is now scoped to the workspace directory, but we specifically
  // track writes to the active workflow to ignore them
  private lastInternalWorkflowWritePath: string | null = null
  private lastInternalWorkflowWriteAt = 0

  // Track the active workflow file path so the watcher knows what's important
  private activeWorkflowFilePath: string | null = null

  private constructor() {
    // Singleton
  }

  public static getInstance(): WorkspaceService {
    if (!WorkspaceService.instance) {
      WorkspaceService.instance = new WorkspaceService()
    }
    return WorkspaceService.instance
  }

  public getLegacyWorkflowFilePath(workspacePath: string): string {
    return path.join(path.resolve(workspacePath), '.fluxion', 'workflow.json')
  }

  public getWorkflowsDirectory(workspacePath: string): string {
    return path.join(path.resolve(workspacePath), '.fluxion', 'workflows')
  }

  public getContextFilePath(workspacePath: string): string {
    return path.join(path.resolve(workspacePath), '.fluxion', 'context.json')
  }

  public async scanWorkspaceContext(workspacePath: string): Promise<ContextScanResult> {
    return scanWorkspaceContext(path.resolve(workspacePath))
  }

  /**
   * Scans the workspace for all workflow files (.fluxion.json and legacy workflow.json)
   */
  public async scanWorkflows(workspacePath: string): Promise<{
    workflows: WorkflowMetadata[]
    legacyWorkflowDetected: boolean
    legacyWorkflowPath?: string
  }> {
    const workflows: WorkflowMetadata[] = []
    let legacyWorkflowDetected = false
    let legacyWorkflowPath: string | undefined

    const resolvedWorkspacePath = path.resolve(workspacePath)

    // 1. Check for legacy workflow
    const legacyPath = this.getLegacyWorkflowFilePath(resolvedWorkspacePath)
    try {
      const stat = await fs.stat(legacyPath)
      if (stat.isFile()) {
        const raw = await fs.readFile(legacyPath, 'utf-8')
        try {
          const parsed = workflowFileSchema.parse(JSON.parse(raw))
          workflows.push({
            id: parsed.id,
            name: parsed.name,
            description: parsed.description,
            tags: parsed.tags,
            fluxionVersion: (parsed.fluxionVersion as FluxionSchemaVersion) || '1.0',
            createdAt: parsed.createdAt || new Date(stat.birthtime).toISOString(),
            updatedAt: parsed.updatedAt || new Date(stat.mtime).toISOString(),
            filePath: legacyPath,
            isLegacy: true
          })
          legacyWorkflowDetected = true
          legacyWorkflowPath = legacyPath
        } catch (e) {
          console.warn(`Failed to parse legacy workflow.json`, e)
        }
      }
    } catch {
      // Legacy file doesn't exist, ignore
    }

    // 2. Check for new workflows
    const workflowsDir = this.getWorkflowsDirectory(resolvedWorkspacePath)
    try {
      await fs.mkdir(workflowsDir, { recursive: true })
      const entries = await fs.readdir(workflowsDir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.fluxion.json')) {
          const filePath = path.join(workflowsDir, entry.name)
          try {
            const raw = await fs.readFile(filePath, 'utf-8')
            const parsed = workflowFileSchema.parse(JSON.parse(raw))

            workflows.push({
              id: parsed.id,
              name: parsed.name,
              description: parsed.description,
              tags: parsed.tags,
              fluxionVersion: (parsed.fluxionVersion as FluxionSchemaVersion) || '1.0',
              createdAt: parsed.createdAt || new Date().toISOString(),
              updatedAt: parsed.updatedAt || new Date().toISOString(),
              filePath: filePath,
              isLegacy: false
            })
          } catch (e) {
            console.warn(`Failed to parse workflow file: ${entry.name}`, e)
          }
        }
      }
    } catch (e) {
      console.warn(`Failed to read workflows directory`, e)
    }

    // Sort descending by updatedAt
    workflows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    return { workflows, legacyWorkflowDetected, legacyWorkflowPath }
  }

  private async buildRecoveredReviewPayload(
    workspacePath: string,
    workflow: Workflow,
    run: {
      workflowId: string
      runId: string
      awaitingReviewNodeIds: string[]
      executionMode: ExecutionMode
      updatedAt: string
      nodes: Record<string, { attempts: number }>
    }
  ): Promise<RecoveredReviewPayload | undefined> {
    const availableNodeIds = new Set(workflow.nodes.map((node) => node.id))
    const nodeIds = run.awaitingReviewNodeIds.filter((nodeId) => availableNodeIds.has(nodeId))
    if (nodeIds.length === 0) {
      return undefined
    }

    const nodeOutputPaths: Partial<Record<NodeId, string>> = {}
    const nodeAttemptCounts: Partial<Record<NodeId, number>> = {}

    for (const nodeId of nodeIds) {
      const outputPath = memoryManager.getNodeOutputPath(workspacePath, workflow.id, nodeId)
      nodeOutputPaths[nodeId] = outputPath
      nodeAttemptCounts[nodeId] = run.nodes[nodeId]?.attempts ?? 1

      try {
        await fs.access(outputPath)
      } catch (error) {
        console.warn(`Recovered review output is missing for node ${nodeId}: ${outputPath}`, error)
      }
    }

    return {
      workflowId: run.workflowId,
      runId: run.runId,
      nodeIds,
      nodeOutputPaths,
      nodeAttemptCounts,
      executionMode: run.executionMode,
      updatedAt: run.updatedAt
    }
  }

  public async loadWorkspace(
    workspacePath: string,
    sender: Electron.WebContents
  ): Promise<WorkspaceOpenedPayload> {
    const resolvedWorkspacePath = path.resolve(workspacePath)
    let activeStep: WorkspaceLoadingStep = 'init'

    try {
      this.emitWorkspaceLoading(
        sender,
        resolvedWorkspacePath,
        activeStep,
        'active',
        'Initialize workspace storage'
      )
      await memoryManager.initWorkspace(resolvedWorkspacePath)
      this.emitWorkspaceLoading(sender, resolvedWorkspacePath, activeStep, 'done')

      activeStep = 'loadWorkflows'
      this.emitWorkspaceLoading(
        sender,
        resolvedWorkspacePath,
        activeStep,
        'active',
        'Load workflow catalog'
      )
      let isNewWorkspace = false
      const { workflows, legacyWorkflowDetected } = await this.scanWorkflows(resolvedWorkspacePath)
      const awaitingReviewRuns = await runStateStore.listAwaitingReviewRuns(resolvedWorkspacePath)
      const newestRecoverableRun = awaitingReviewRuns.find((run) =>
        workflows.some((candidate) => candidate.id === run.workflowId)
      )

      let activeWorkflowFilePath: string
      let workflow: Workflow
      let recoveredReview: RecoveredReviewPayload | undefined

      // If no workflows exist, create a default one
      if (workflows.length === 0) {
        workflow = this.createDefaultWorkflow(resolvedWorkspacePath)
        activeWorkflowFilePath = path.join(
          this.getWorkflowsDirectory(resolvedWorkspacePath),
          `${slugify(workflow.name)}.fluxion.json`
        )

        await this.writeWorkflowToDisk(activeWorkflowFilePath, workflow)
        isNewWorkspace = true

        // Update metadata list
        workflows.push({
          id: workflow.id,
          name: workflow.name,
          fluxionVersion: '1.0',
          createdAt: workflow.createdAt!,
          updatedAt: workflow.updatedAt!,
          filePath: activeWorkflowFilePath,
          isLegacy: false
        })
      } else {
        // Preserve the currently active workflow when possible (for explicit switch),
        // otherwise fall back to the most recently updated workflow.
        const preferredActivePath = this.activeWorkflowFilePath
          ? normalizePathForCompare(this.activeWorkflowFilePath)
          : null
        const preferredActiveWorkflow = preferredActivePath
          ? workflows.find(
              (candidate) => normalizePathForCompare(candidate.filePath) === preferredActivePath
            )
          : undefined
        const recoveredWorkflow = newestRecoverableRun
          ? workflows.find((candidate) => candidate.id === newestRecoverableRun.workflowId)
          : undefined
        const workflowToLoad = recoveredWorkflow ?? preferredActiveWorkflow ?? workflows[0]
        activeWorkflowFilePath = workflowToLoad.filePath
        workflow = await this.readWorkflowFromDisk(activeWorkflowFilePath)
        if (recoveredWorkflow && newestRecoverableRun && recoveredWorkflow.id === workflow.id) {
          recoveredReview = await this.buildRecoveredReviewPayload(
            resolvedWorkspacePath,
            workflow,
            newestRecoverableRun
          )
        }
      }
      this.emitWorkspaceLoading(sender, resolvedWorkspacePath, activeStep, 'done')

      activeStep = 'loadContext'
      this.emitWorkspaceLoading(
        sender,
        resolvedWorkspacePath,
        activeStep,
        'active',
        'Prepare local context'
      )
      const contextSummary = await this.getContext(resolvedWorkspacePath)
      const contextStatus = contextSummary?.contextStatus ?? 'missing'
      this.emitWorkspaceLoading(sender, resolvedWorkspacePath, activeStep, 'done')

      activeStep = 'watcher'
      this.emitWorkspaceLoading(
        sender,
        resolvedWorkspacePath,
        activeStep,
        'active',
        'Start workspace watcher'
      )
      this.activeWorkflowFilePath = activeWorkflowFilePath
      await this.startWatcher(resolvedWorkspacePath, sender)
      this.emitWorkspaceLoading(sender, resolvedWorkspacePath, activeStep, 'done')

      this.emitWorkspaceLoading(sender, resolvedWorkspacePath, 'ready', 'done')

      return {
        workspacePath: resolvedWorkspacePath,
        workflow,
        activeWorkflowFilePath,
        activeWorkflowId: workflow.id,
        workflows,
        isNewWorkspace,
        contextStatus,
        contextSummary,
        legacyWorkflowDetected,
        recoveredReview
      }
    } catch (error) {
      this.emitWorkspaceLoading(
        sender,
        resolvedWorkspacePath,
        activeStep,
        'error',
        error instanceof Error ? error.message : 'Failed to load workspace.'
      )
      throw error
    }
  }

  public async saveWorkflow(
    workspacePath: string,
    workflow: Workflow,
    activeWorkflowFilePath: string
  ): Promise<WorkflowSavedPayload> {
    const resolvedWorkspacePath = path.resolve(workspacePath)
    const savedWorkflow = await this.writeWorkflowToDisk(activeWorkflowFilePath, workflow)

    return {
      workspacePath: resolvedWorkspacePath,
      workflowFilePath: activeWorkflowFilePath,
      savedAt: savedWorkflow.updatedAt ?? new Date().toISOString()
    }
  }

  /**
   * Creates a new workflow file in the workflows directory
   */
  public async createWorkflow(
    workspacePath: string,
    name: string
  ): Promise<{ workflow: Workflow; workflowFilePath: string }> {
    const resolvedWorkspacePath = path.resolve(workspacePath)

    const workflow: Workflow = {
      id: ulid(),
      name,
      executionMode: 'auto',
      fluxionVersion: '1.0',
      nodes: [],
      edges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const workflowsDir = this.getWorkflowsDirectory(resolvedWorkspacePath)
    await fs.mkdir(workflowsDir, { recursive: true })

    // Generate a safe unique filename
    const slug = slugify(name)
    let filePath = path.join(workflowsDir, `${slug}.fluxion.json`)

    // Anti-collision loop
    let counter = 1
    while (true) {
      try {
        await fs.access(filePath)
        filePath = path.join(workflowsDir, `${slug}-${counter}.fluxion.json`)
        counter++
      } catch {
        break // File doesn't exist, safe to use
      }
    }

    await this.writeWorkflowToDisk(filePath, workflow)
    return { workflow, workflowFilePath: filePath }
  }

  /**
   * Loads a specific workflow file from disk
   */
  public async loadWorkflowFile(filePath: string): Promise<Workflow> {
    this.activeWorkflowFilePath = filePath
    return this.readWorkflowFromDisk(filePath)
  }

  /**
   * Deletes a workflow file
   */
  public async deleteWorkflow(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
      if (this.activeWorkflowFilePath === filePath) {
        this.activeWorkflowFilePath = null
      }
    } catch (e) {
      console.error(`Failed to delete workflow at ${filePath}`, e)
    }
  }

  public async dispose(): Promise<void> {
    await this.closeWatcher()
    this.currentWorkspacePath = null
    this.currentSender = null
    this.activeWorkflowFilePath = null
  }

  public async getContext(workspacePath: string): Promise<ProjectContextDraft | null> {
    const resolvedWorkspacePath = path.resolve(workspacePath)
    const contextFilePath = this.getContextFilePath(resolvedWorkspacePath)
    try {
      const raw = await fs.readFile(contextFilePath, 'utf-8')
      const parsed = JSON.parse(raw) as unknown

      const projectContext = projectContextDraftSchema.safeParse(parsed)
      if (projectContext.success) {
        return normalizeProjectContextDraft(projectContext.data)
      }

      const legacyContext = legacyContextSchema.safeParse(parsed)
      if (legacyContext.success) {
        return mapLegacyContextToDraft(legacyContext.data, resolvedWorkspacePath)
      }

      return null
    } catch {
      return null
    }
  }

  public async saveProjectContext(
    workspacePath: string,
    draft: ProjectContextDraft,
    mode: ContextSaveMode = 'final'
  ): Promise<WorkspaceContextSavedPayload> {
    const resolvedWorkspacePath = path.resolve(workspacePath)
    const normalizedDraft = normalizeProjectContextDraft(draft, {
      projectName: path.basename(resolvedWorkspacePath) || 'Workspace',
      workspaceType: draft.workspaceType
    })
    const now = new Date().toISOString()
    const contextToSave: ProjectContextDraft =
      mode === 'skip'
        ? {
            ...buildSkippedProjectContextDraft(
              normalizedDraft,
              normalizedDraft.workspaceType,
              normalizedDraft.projectName
            ),
            lastReviewedAt: now
          }
        : {
            ...normalizedDraft,
            lastReviewedAt: now,
            contextStatus: resolveProjectContextStatus(normalizedDraft, mode)
          }
    const validationError = mode === 'final' ? getContextValidationError(contextToSave) : null

    if (validationError) {
      throw new Error(validationError)
    }

    return this.writeProjectContextFiles(resolvedWorkspacePath, contextToSave)
  }

  public async updateContextOnboarding(
    workspacePath: string,
    patch: ProjectContextOnboarding
  ): Promise<WorkspaceContextSavedPayload> {
    const resolvedWorkspacePath = path.resolve(workspacePath)
    const existingContext = await this.getContext(resolvedWorkspacePath)
    const workspaceName = path.basename(resolvedWorkspacePath) || 'Workspace'
    const baseContext =
      existingContext ??
      normalizeProjectContextDraft({
        ...createEmptyProjectContextDraft('existing', workspaceName),
        contextStatus: 'incomplete'
      })
    const contextToSave = normalizeProjectContextDraft({
      ...baseContext,
      contextOnboarding: {
        ...baseContext.contextOnboarding,
        ...patch
      }
    })

    return this.writeProjectContextFiles(resolvedWorkspacePath, contextToSave)
  }

  public async migrateLegacyWorkflow(
    workspacePath: string
  ): Promise<{ workflowFilePath: string; backupFilePath: string }> {
    const resolvedWorkspacePath = path.resolve(workspacePath)
    const legacyPath = this.getLegacyWorkflowFilePath(resolvedWorkspacePath)

    try {
      const legacyStat = await fs.stat(legacyPath)
      if (!legacyStat.isFile()) {
        throw new Error('Legacy workflow path is not a file.')
      }
    } catch {
      throw new Error('No legacy workflow.json file was found for this workspace.')
    }

    const workflow = await this.readWorkflowFromDisk(legacyPath)
    const workflowsDir = this.getWorkflowsDirectory(resolvedWorkspacePath)
    await fs.mkdir(workflowsDir, { recursive: true })

    let workflowFilePath = path.join(workflowsDir, `${slugify(workflow.name)}.fluxion.json`)
    let counter = 1
    while (true) {
      try {
        await fs.access(workflowFilePath)
        workflowFilePath = path.join(
          workflowsDir,
          `${slugify(workflow.name)}-${counter}.fluxion.json`
        )
        counter++
      } catch {
        break
      }
    }

    await this.writeWorkflowToDisk(workflowFilePath, workflow)

    const legacyBackupDir = path.join(resolvedWorkspacePath, '.fluxion', 'legacy')
    await fs.mkdir(legacyBackupDir, { recursive: true })
    const backupFilePath = path.join(
      legacyBackupDir,
      `workflow-${formatTimestampForFilename()}.json`
    )
    await fs.rename(legacyPath, backupFilePath)

    await this.updateContextOnboarding(resolvedWorkspacePath, {
      legacyWorkflowDecision: 'migrated',
      legacyWorkflowDecisionAt: new Date().toISOString()
    })

    return { workflowFilePath, backupFilePath }
  }

  public async saveContext(workspacePath: string, context: Record<string, string>): Promise<void> {
    const legacyDraft = mapLegacyContextToDraft(
      legacyContextSchema.parse(context),
      path.resolve(workspacePath)
    )

    await this.saveProjectContext(workspacePath, legacyDraft, 'draft')
  }

  private async writeProjectContextFiles(
    resolvedWorkspacePath: string,
    contextToSave: ProjectContextDraft
  ): Promise<WorkspaceContextSavedPayload> {
    await memoryManager.initWorkspace(resolvedWorkspacePath)

    const contextFilePath = this.getContextFilePath(resolvedWorkspacePath)
    const globalContextPath = path.join(
      resolvedWorkspacePath,
      '.fluxion',
      'memory',
      'global-context.md'
    )

    await fs.mkdir(path.dirname(contextFilePath), { recursive: true })
    await fs.writeFile(contextFilePath, JSON.stringify(contextToSave, null, 2), 'utf-8')
    await fs.writeFile(globalContextPath, formatProjectContextMarkdown(contextToSave), 'utf-8')

    return {
      contextStatus: contextToSave.contextStatus,
      context: contextToSave
    }
  }

  private createDefaultWorkflow(workspacePath: string): Workflow {
    const workspaceName = path.basename(workspacePath) || 'Fluxion'
    const now = new Date().toISOString()

    // Hello World template — seeded on first workspace open only.
    // Uses Windows-safe `dir` command. The workflow is immediately
    // persisted to disk, so isNewWorkspace will be false on all future opens.
    const nodeA: Workflow['nodes'][number] = {
      id: 'hello-node-a',
      type: 'agentNode',
      label: 'List Files',
      data: {
        provider: 'codex',
        model: CODEX_DEFAULT_MODEL,
        prompt: 'Run `dir` and summarize the top-level files and folders in this workspace.',
        systemInstruction: 'You are a workspace scanner. List and briefly describe what you find.',
        humanReview: false
      },
      position: { x: 100, y: 160 }
    }

    const nodeB: Workflow['nodes'][number] = {
      id: 'hello-node-b',
      type: 'agentNode',
      label: 'Summarize Structure',
      data: {
        provider: 'codex',
        model: CODEX_DEFAULT_MODEL,
        prompt:
          "Based on the previous output, write a one-paragraph description of this project's structure.",
        humanReview: false
      },
      position: { x: 400, y: 160 }
    }

    const nodeC: Workflow['nodes'][number] = {
      id: 'hello-node-c',
      type: 'agentNode',
      label: 'Review Gate',
      data: {
        provider: 'codex',
        model: CODEX_DEFAULT_MODEL,
        prompt:
          'Review the previous summary and confirm it is accurate. Output: APPROVED or NEEDS_REVISION.',
        humanReview: true
      },
      position: { x: 700, y: 160 }
    }

    return {
      id: ulid(),
      name: `${workspaceName} — Hello World`,
      description:
        'Your first Fluxion workflow. Run it to see DAG execution, log streaming, and review gates in action. Delete these nodes when ready to build your own.',
      executionMode: 'manual',
      fluxionVersion: '1.0',
      nodes: [nodeA, nodeB, nodeC],
      edges: [
        { id: 'hello-edge-ab', source: 'hello-node-a', target: 'hello-node-b' },
        { id: 'hello-edge-bc', source: 'hello-node-b', target: 'hello-node-c' }
      ],
      createdAt: now,
      updatedAt: now
    }
  }

  private normalizeWorkflow(workflowFile: WorkflowFile): Workflow {
    return {
      id: workflowFile.id,
      name: workflowFile.name,
      description: workflowFile.description,
      tags: workflowFile.tags,
      executionMode: workflowFile.executionMode ?? 'auto',
      fluxionVersion: (workflowFile.fluxionVersion as FluxionSchemaVersion) || '1.0',
      createdAt: workflowFile.createdAt,
      updatedAt: workflowFile.updatedAt,
      nodes: workflowFile.nodes.map((node) => {
        const normalizedData = sanitizeWorkflowNodeData(node.data)

        return {
          id: node.id,
          type: node.type ?? 'agentNode',
          label:
            node.label ||
            (typeof normalizedData.label === 'string' && normalizedData.label.trim()
              ? normalizedData.label
              : node.id),
          data: normalizedData,
          position: node.position
        }
      }),
      edges: workflowFile.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label
      }))
    }
  }

  private async readWorkflowFromDisk(workflowFilePath: string): Promise<Workflow> {
    const raw = await fs.readFile(workflowFilePath, 'utf-8')
    const parsed = workflowFileSchema.parse(JSON.parse(raw))
    return this.normalizeWorkflow(parsed)
  }

  private async writeWorkflowToDisk(
    workflowFilePath: string,
    workflow: Workflow
  ): Promise<Workflow> {
    const normalizedWorkflow = this.normalizeWorkflow(workflowFileSchema.parse(workflow))
    const savedWorkflow: Workflow = {
      ...normalizedWorkflow,
      updatedAt: new Date().toISOString()
    }

    await fs.mkdir(path.dirname(workflowFilePath), { recursive: true })
    this.lastInternalWorkflowWritePath = normalizePathForCompare(workflowFilePath)
    this.lastInternalWorkflowWriteAt = Date.now()
    await fs.writeFile(workflowFilePath, JSON.stringify(savedWorkflow, null, 2), 'utf-8')

    return savedWorkflow
  }

  private async startWatcher(workspacePath: string, sender: Electron.WebContents): Promise<void> {
    await this.closeWatcher()

    this.currentWorkspacePath = workspacePath
    this.currentSender = sender
    this.watcher = watch(workspacePath, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 250,
        pollInterval: 100
      },
      ignored: [
        '**/.git/**',
        '**/node_modules/**',
        '**/.fluxion/memory/**',
        '**/out/**',
        '**/dist/**'
      ]
    })

    this.watcher.on('all', (eventName: string, changedPath: string) => {
      const currentSender = this.currentSender
      const currentWorkspacePath = this.currentWorkspacePath
      if (!currentSender || !currentWorkspacePath) {
        return
      }

      if (eventName !== 'add' && eventName !== 'change' && eventName !== 'unlink') {
        return
      }

      const filePath = path.resolve(changedPath)

      // We only suppress external change events if the file changing is the
      // one we JUST wrote to internally.
      if (this.shouldIgnoreInternalWorkflowWrite(filePath)) {
        return
      }

      // If the file changing is the active workflow file, tell the frontend
      // so it can show the "External change detected" banner
      const relativePath = this.toRelativePath(currentWorkspacePath, filePath)
      if (!relativePath) {
        return
      }

      // Check if it's the active workflow
      const isActiveWorkflow =
        this.activeWorkflowFilePath &&
        normalizePathForCompare(filePath) === normalizePathForCompare(this.activeWorkflowFilePath)

      currentSender.send(IpcChannels.WORKSPACE_FILE_CHANGED, {
        filePath,
        relativePath,
        changeType: eventName as SupportedChangeType,
        // Optional: frontend can use this to know if it should prompt reload
        isActiveWorkflow
      } as WorkspaceFileChangedPayload & { isActiveWorkflow?: boolean })
    })

    this.watcher.on('error', (error: unknown) => {
      console.error('Workspace watcher error:', error)
    })
  }

  private emitWorkspaceLoading(
    sender: Electron.WebContents,
    workspacePath: string,
    step: WorkspaceLoadingStep,
    status: 'active' | 'done' | 'error',
    message?: string
  ): void {
    sender.send(IpcChannels.WORKSPACE_LOADING, {
      workspacePath,
      step,
      status,
      message
    })
  }

  private shouldIgnoreInternalWorkflowWrite(filePath: string): boolean {
    if (!this.lastInternalWorkflowWritePath) {
      return false
    }

    return (
      normalizePathForCompare(filePath) === this.lastInternalWorkflowWritePath &&
      Date.now() - this.lastInternalWorkflowWriteAt < 1500
    )
  }

  private toRelativePath(workspacePath: string, filePath: string): string {
    const relativePath = path.relative(workspacePath, filePath)
    return relativePath.replaceAll('\\', '/')
  }

  private async closeWatcher(): Promise<void> {
    if (!this.watcher) {
      return
    }

    await this.watcher.close()
    this.watcher = null
  }
}

export const workspaceService = WorkspaceService.getInstance()
