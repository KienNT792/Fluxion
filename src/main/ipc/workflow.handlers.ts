import { app, dialog, ipcMain, IpcMainEvent, shell } from 'electron'
import { open, realpath, stat } from 'fs/promises'
import { isAbsolute, relative, resolve } from 'path'
import {
  ContextSaveMode,
  AgentConfigApplyPreviewPayload,
  AgentConfigCreatePreviewPayload,
  ContextEnrichmentRequest,
  GenerateOnboardingPacketRequest,
  getProviderCodexApprovalProtocolStatus,
  getWorkflowProviderRuntimePreflight,
  getWorkflowCodexApprovalGuardrail,
  IpcChannels,
  RepoOnboardingSkillPreview,
  ProviderSettingsSummaryPayload,
  SaveOnboardingPacketRequest,
  CreateOnboardingWorkflowRequest,
  RepoOnboardingSkillPreviewRequest,
  ApplyRepoOnboardingSkillPreviewRequest,
  GetProviderCapabilitiesPayload,
  OpenTerminalPayload,
  ProjectContextDraft,
  WorkflowExplainFailurePayload,
  WorkflowExplainFailureResult,
  UpdateOpenAIApiKeyPayload,
  Workflow,
  WorkflowAbortPayload,
  WorkflowCompletedPayload,
  WorkflowReviewActionPayload,
  WorkflowRunPayload,
  WorkflowSavePayload,
  WorkflowCreatePayload,
  WorkflowLoadPayload,
  WorkflowDeletePayload,
  WorkspaceOpenedPayload,
  WorkspaceContextOnboardingUpdatePayload,
  LegacyWorkflowMigrationPayload,
  WorkspaceTrustMigrationPayload,
  WorkspaceDirectoryValidationResult,
  WorkspaceReadTextFilePayload,
  WorkspaceReadTextFileResult
} from '@shared'
import { formatZodError, validateWorkflowGraph, WorkflowSchema } from '@core'
import { workflowEngine } from '../services/workflow-engine'
import { providerRegistryService } from '../services/provider-registry.service'
import { processManager } from '../services/process-manager'
import { settingsService } from '../services/settings.service'
import {
  openInWindowsTerminal,
  openShellPath,
  revealShellPath
} from '../services/shell-path.service'
import { agentConfigPreviewService } from '../services/agent-config/agent-config-preview.service'
import { contextEnrichmentService } from '../services/context-enrichment.service'
import { onboardingService } from '../services/onboarding.service'
import { runStateStore } from '../services/run-state-store'
import { workspaceService } from '../services/workspace.service'
import { workspaceTrustService } from '../services/workspace-trust.service'
import { recentWorkspacesService } from '../services/recent-workspaces.service'
import { memoryManager } from '../services/memory-manager'

const DEFAULT_TEXT_PREVIEW_MAX_BYTES = 256 * 1024
const HARD_TEXT_PREVIEW_MAX_BYTES = 1024 * 1024

function createWorkflowFailurePayload(
  workflowId: string,
  error: string,
  aborted = false
): WorkflowCompletedPayload {
  return {
    workflowId,
    success: false,
    totalTimeMs: 0,
    aborted,
    error
  }
}

function validateWorkflow(payload: WorkflowRunPayload): string | null {
  if (!payload.workspacePath.trim()) {
    return 'Open a workspace before running the workflow.'
  }

  const parsedWorkflow = WorkflowSchema.safeParse({
    id: payload.workflowId,
    name: 'Fluxion Workflow',
    executionMode: payload.executionMode,
    nodes: payload.nodes,
    edges: payload.edges
  })

  if (!parsedWorkflow.success) {
    return `Invalid workflow payload: ${formatZodError(parsedWorkflow.error)}`
  }

  const workflow = parsedWorkflow.data
  const result = validateWorkflowGraph(workflow, {
    resumeFromNodeId: payload.resumeFromNodeId
  })

  return result.errors[0]?.message ?? null
}

function coercePreviewMaxBytes(maxBytes: number | undefined): number {
  if (typeof maxBytes !== 'number' || !Number.isFinite(maxBytes)) {
    return DEFAULT_TEXT_PREVIEW_MAX_BYTES
  }

  return Math.min(HARD_TEXT_PREVIEW_MAX_BYTES, Math.max(1, Math.floor(maxBytes)))
}

async function recoverPausedReviewIfAvailable(
  payload: WorkspaceOpenedPayload,
  sender: Electron.WebContents
): Promise<WorkspaceOpenedPayload> {
  if (!payload.recoveredReview) {
    return payload
  }

  try {
    const runState = await runStateStore.readRun(
      payload.workspacePath,
      payload.recoveredReview.runId
    )
    workflowEngine.hydratePausedReviewRuntime(
      payload.workflow,
      payload.workspacePath,
      sender,
      runState
    )
    return payload
  } catch (error) {
    console.warn(
      `Failed to hydrate paused review runtime for run ${payload.recoveredReview.runId}.`,
      error
    )
    return {
      ...payload,
      recoveredReview: undefined
    }
  }
}

async function recordRecentWorkspace(workspacePath: string): Promise<void> {
  try {
    await recentWorkspacesService.recordWorkspaceOpened(workspacePath)
  } catch (error) {
    console.warn('Failed to record recent workspace:', error)
  }
}

async function validateWorkspaceDirectory(
  pathValue: string
): Promise<WorkspaceDirectoryValidationResult> {
  const candidatePath = pathValue.trim()

  if (!candidatePath) {
    return {
      ok: false,
      path: '',
      message: 'Drop a folder to open it as a workspace.'
    }
  }

  const resolvedPath = resolve(candidatePath)

  try {
    const pathStats = await stat(resolvedPath)

    if (!pathStats.isDirectory()) {
      return {
        ok: false,
        path: resolvedPath,
        message: 'Drop a folder, not a file.'
      }
    }

    return {
      ok: true,
      path: resolvedPath
    }
  } catch {
    return {
      ok: false,
      path: resolvedPath,
      message: 'Folder does not exist or cannot be accessed.'
    }
  }
}

async function resolveWorkspaceBoundFile(workspacePath: string, filePath: string): Promise<string> {
  const workspaceRoot = resolve(workspacePath)
  const requestedPath = isAbsolute(filePath) ? resolve(filePath) : resolve(workspaceRoot, filePath)
  const [workspaceRealPath, fileRealPath] = await Promise.all([
    realpath(workspaceRoot),
    realpath(requestedPath)
  ])
  const relativePath = relative(workspaceRealPath, fileRealPath)

  if (relativePath === '' || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error('File is outside the active workspace.')
  }

  return fileRealPath
}

async function readWorkspaceTextFile(
  payload: WorkspaceReadTextFilePayload
): Promise<WorkspaceReadTextFileResult> {
  const filePath = await resolveWorkspaceBoundFile(payload.workspacePath, payload.filePath)
  const maxBytes = coercePreviewMaxBytes(payload.maxBytes)
  const fileStats = await stat(filePath)

  if (!fileStats.isFile()) {
    throw new Error('Path is not a file.')
  }

  const bytesToRead = Math.min(fileStats.size, maxBytes)
  const fileHandle = await open(filePath, 'r')

  try {
    const buffer = Buffer.alloc(bytesToRead)
    const { bytesRead } = await fileHandle.read(buffer, 0, bytesToRead, 0)

    return {
      content: buffer.subarray(0, bytesRead).toString('utf8'),
      truncated: fileStats.size > maxBytes
    }
  } finally {
    await fileHandle.close()
  }
}

function summarizeWorkflowFailure(
  payload: WorkflowExplainFailurePayload
): WorkflowExplainFailureResult {
  const nodeDescriptor = payload.nodeLabel?.trim() || payload.nodeId
  const providerModel = [payload.provider, payload.model].filter(Boolean).join(' / ')

  return {
    summary: `Node ${nodeDescriptor} failed${providerModel ? ` under ${providerModel}` : ''}.`,
    likelyCause: payload.error.trim().length > 0 ? payload.error.trim() : 'Unknown execution failure.',
    recommendedNextSteps: [
      'Inspect the terminal logs for the last stderr chunk.',
      'Check provider readiness and node configuration.',
      'Retry with a narrower prompt or smaller input if the failure was transient.'
    ]
  }
}

export function registerWorkflowHandlers(): void {
  ipcMain.handle(IpcChannels.WORKSPACE_OPEN_DIALOG, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open Workspace',
      buttonLabel: 'Open Workspace',
      defaultPath: app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory']
    })

    if (result.canceled) {
      return null
    }

    return result.filePaths[0] ?? null
  })

  ipcMain.handle(IpcChannels.WORKSPACE_LOAD, async (event, workspacePath: string) => {
    const payload = await recoverPausedReviewIfAvailable(
      await workspaceService.loadWorkspace(workspacePath, event.sender),
      event.sender
    )
    await recordRecentWorkspace(payload.workspacePath)
    return payload
  })

  ipcMain.handle(IpcChannels.WORKSPACE_VALIDATE_DIRECTORY, async (_event, pathValue: string) => {
    return validateWorkspaceDirectory(pathValue)
  })

  ipcMain.handle(IpcChannels.WORKSPACE_TRUST_IS_TRUSTED, async (_event, workspacePath: string) => {
    return workspaceTrustService.isWorkspaceTrusted(workspacePath)
  })

  ipcMain.handle(
    IpcChannels.WORKSPACE_TRUST_MARK_TRUSTED,
    async (_event, workspacePath: string) => {
      await workspaceTrustService.markWorkspaceAsTrusted(workspacePath)
    }
  )

  ipcMain.handle(
    IpcChannels.WORKSPACE_TRUST_MIGRATE_RENDERER_CACHE,
    async (_event, payload: WorkspaceTrustMigrationPayload) => {
      await workspaceTrustService.migrateTrustedWorkspaces(payload.workspacePaths)
    }
  )

  ipcMain.handle(IpcChannels.WORKSPACE_RECENT_LIST, async () => {
    return recentWorkspacesService.listRecentWorkspaces()
  })

  ipcMain.handle(IpcChannels.WORKSPACE_RECENT_REMOVE, async (_event, workspacePath: string) => {
    return recentWorkspacesService.removeRecentWorkspace(workspacePath)
  })

  ipcMain.handle(IpcChannels.WORKSPACE_SAVE, async (_event, payload: WorkflowSavePayload) => {
    return workspaceService.saveWorkflow(
      payload.workspacePath,
      payload.workflow,
      payload.activeWorkflowFilePath
    )
  })

  ipcMain.handle(
    IpcChannels.WORKSPACE_READ_TEXT_FILE,
    async (_event, payload: WorkspaceReadTextFilePayload) => {
      return readWorkspaceTextFile(payload)
    }
  )

  ipcMain.handle(
    IpcChannels.WORKSPACE_WORKFLOW_CREATE,
    async (_event, payload: WorkflowCreatePayload) => {
      return workspaceService.createWorkflow(payload.workspacePath, payload.name)
    }
  )

  ipcMain.handle(
    IpcChannels.WORKSPACE_WORKFLOW_LOAD,
    async (_event, payload: WorkflowLoadPayload) => {
      const { workflows } = await workspaceService.scanWorkflows(payload.workspacePath)
      const target = workflows.find((w) => w.id === payload.workflowId)
      if (!target) {
        throw new Error(`Workflow with ID ${payload.workflowId} not found.`)
      }
      return workspaceService.loadWorkflowFile(target.filePath)
    }
  )

  ipcMain.handle(
    IpcChannels.WORKSPACE_WORKFLOW_DELETE,
    async (_event, payload: WorkflowDeletePayload) => {
      const { workflows } = await workspaceService.scanWorkflows(payload.workspacePath)
      const target = workflows.find((w) => w.id === payload.workflowId)
      if (!target) {
        throw new Error(`Workflow with ID ${payload.workflowId} not found.`)
      }
      return workspaceService.deleteWorkflow(target.filePath)
    }
  )

  ipcMain.handle(
    IpcChannels.WORKSPACE_SAVE_CONTEXT,
    async (_event, payload: { workspacePath: string; context: Record<string, string> }) => {
      await workspaceService.saveContext(payload.workspacePath, payload.context)
    }
  )

  ipcMain.handle(IpcChannels.WORKSPACE_SCAN_CONTEXT, async (_event, workspacePath: string) => {
    return workspaceService.scanWorkspaceContext(workspacePath)
  })

  ipcMain.handle(
    IpcChannels.WORKSPACE_ENRICH_CONTEXT,
    async (_event, payload: ContextEnrichmentRequest) => {
      return contextEnrichmentService.enrich(payload)
    }
  )

  ipcMain.handle(
    IpcChannels.WORKSPACE_GENERATE_ONBOARDING_PACKET,
    async (_event, payload: GenerateOnboardingPacketRequest) => {
      return onboardingService.generatePacket(payload)
    }
  )

  ipcMain.handle(
    IpcChannels.WORKSPACE_SAVE_ONBOARDING_PACKET,
    async (_event, payload: SaveOnboardingPacketRequest) => {
      return onboardingService.savePacket(payload)
    }
  )

  ipcMain.handle(
    IpcChannels.WORKSPACE_CREATE_ONBOARDING_WORKFLOW,
    async (_event, payload: CreateOnboardingWorkflowRequest) => {
      return onboardingService.createWorkflow(payload)
    }
  )

  ipcMain.handle(
    IpcChannels.WORKSPACE_CREATE_REPO_ONBOARDING_SKILL_PREVIEW,
    async (_event, payload: RepoOnboardingSkillPreviewRequest) => {
      return onboardingService.createRepoSkillPreview(payload)
    }
  )

  ipcMain.handle(
    IpcChannels.WORKSPACE_APPLY_REPO_ONBOARDING_SKILL_PREVIEW,
    async (_event, payload: ApplyRepoOnboardingSkillPreviewRequest) => {
      return onboardingService.applyRepoSkillPreview(payload.preview as RepoOnboardingSkillPreview)
    }
  )

  ipcMain.handle(IpcChannels.WORKSPACE_GET_CONTEXT, async (_event, workspacePath: string) => {
    return workspaceService.getContext(workspacePath)
  })

  ipcMain.handle(
    'workspace:read-memory-files',
    async (_event, workspacePath: string) => workspaceService.readWorkspaceMemoryFiles(workspacePath)
  )

  ipcMain.handle(
    IpcChannels.WORKSPACE_SAVE_PROJECT_CONTEXT,
    async (
      _event,
      payload: { workspacePath: string; draft: ProjectContextDraft; mode?: ContextSaveMode }
    ) => {
      return workspaceService.saveProjectContext(payload.workspacePath, payload.draft, payload.mode)
    }
  )

  ipcMain.handle(
    'workspace:save-memory-files',
    async (
      _event,
      payload: { workspacePath: string; globalContext: string; longTermIndex: string }
    ) => workspaceService.saveWorkspaceMemoryFiles(payload.workspacePath, payload.globalContext, payload.longTermIndex)
  )

  ipcMain.handle(
    IpcChannels.WORKSPACE_SAVE_PROJECT_CONTEXT_LEGACY,
    async (
      _event,
      payload: { workspacePath: string; draft: ProjectContextDraft; mode?: ContextSaveMode }
    ) => {
      return workspaceService.saveProjectContext(payload.workspacePath, payload.draft, payload.mode)
    }
  )

  ipcMain.handle(
    IpcChannels.WORKSPACE_UPDATE_CONTEXT_ONBOARDING,
    async (_event, payload: WorkspaceContextOnboardingUpdatePayload) => {
      return workspaceService.updateContextOnboarding(payload.workspacePath, payload.patch)
    }
  )

  ipcMain.handle(
    IpcChannels.WORKSPACE_MIGRATE_LEGACY_WORKFLOW,
    async (event, payload: LegacyWorkflowMigrationPayload) => {
      const migrationResult = await workspaceService.migrateLegacyWorkflow(payload.workspacePath)
      const openedPayload = await recoverPausedReviewIfAvailable(
        await workspaceService.loadWorkspace(payload.workspacePath, event.sender),
        event.sender
      )
      await recordRecentWorkspace(openedPayload.workspacePath)
      return {
        ...openedPayload,
        legacyWorkflowBackupFilePath: migrationResult.backupFilePath
      }
    }
  )

  ipcMain.handle(IpcChannels.AGENT_CONFIG_LIST_EXPORTERS, async () => {
    return agentConfigPreviewService.listExporters()
  })

  ipcMain.handle(
    IpcChannels.AGENT_CONFIG_CREATE_PREVIEW,
    async (_event, payload: AgentConfigCreatePreviewPayload) => {
      return agentConfigPreviewService.createPreview(
        payload.workspacePath,
        payload.exporterId,
        payload.context,
        payload.options
      )
    }
  )

  ipcMain.handle(
    IpcChannels.AGENT_CONFIG_APPLY_PREVIEW,
    async (_event, payload: AgentConfigApplyPreviewPayload) => {
      return agentConfigPreviewService.applyPreview(payload.preview)
    }
  )

  ipcMain.handle(
    IpcChannels.PROVIDERS_GET_CAPABILITIES,
    async (_event, payload?: GetProviderCapabilitiesPayload) => {
      return providerRegistryService.fetchCapabilities(
        Boolean(payload?.forceRefresh),
        payload?.workspacePath
      )
    }
  )

  ipcMain.handle(
    IpcChannels.SETTINGS_GET_PROVIDER_SUMMARY,
    async (): Promise<ProviderSettingsSummaryPayload> => {
      return settingsService.getProviderSettingsSummary()
    }
  )

  ipcMain.handle(
    IpcChannels.SETTINGS_SET_OPENAI_API_KEY,
    async (_event, payload: UpdateOpenAIApiKeyPayload): Promise<ProviderSettingsSummaryPayload> => {
      const summary = await settingsService.updateOpenAIApiKey(payload.apiKey)
      providerRegistryService.invalidateCache()
      return summary
    }
  )

  ipcMain.handle(IpcChannels.SHELL_OPEN_PATH, async (_event, pathValue: string) => {
    await openShellPath(shell, pathValue)
  })

  ipcMain.handle(IpcChannels.SHELL_REVEAL_PATH, async (_event, pathValue: string) => {
    await revealShellPath(shell, pathValue)
  })

  ipcMain.handle(
    IpcChannels.SHELL_OPEN_TERMINAL,
    async (_event, payload: OpenTerminalPayload) => {
      await openInWindowsTerminal(payload)
    }
  )

  ipcMain.on(IpcChannels.WORKFLOW_RUN, async (event: IpcMainEvent, payload: WorkflowRunPayload) => {
    try {
      const validationError = validateWorkflow(payload)
      if (validationError) {
        event.sender.send(IpcChannels.TERMINAL_ERROR, {
          nodeId: 'system',
          error: validationError
        })
        event.sender.send(
          IpcChannels.WORKFLOW_COMPLETED,
          createWorkflowFailurePayload(payload.workflowId, validationError)
        )
        return
      }

      const providerCapabilities = await providerRegistryService.fetchCapabilities()
      const providerPreflight = getWorkflowProviderRuntimePreflight(
        payload.nodes,
        providerCapabilities
      )
      if (!providerPreflight.ok) {
        event.sender.send(IpcChannels.TERMINAL_ERROR, {
          nodeId: providerPreflight.nodeId ?? 'system',
          error: providerPreflight.message
        })
        event.sender.send(
          IpcChannels.WORKFLOW_COMPLETED,
          createWorkflowFailurePayload(payload.workflowId, providerPreflight.message)
        )
        return
      }

      const approvalGuardrail = getWorkflowCodexApprovalGuardrail(payload.nodes, {
        approvalProtocolStatus: getProviderCodexApprovalProtocolStatus(
          providerCapabilities
        )
      })
      if (approvalGuardrail.severity === 'blocked') {
        event.sender.send(IpcChannels.TERMINAL_ERROR, {
          nodeId: 'system',
          error: approvalGuardrail.message
        })
        event.sender.send(
          IpcChannels.WORKFLOW_COMPLETED,
          createWorkflowFailurePayload(payload.workflowId, approvalGuardrail.message)
        )
        return
      }

      const workflow: Workflow = {
        id: payload.workflowId,
        name: 'Fluxion Workflow',
        executionMode: payload.executionMode ?? 'auto',
        nodes: payload.nodes,
        edges: payload.edges
      }

      await workflowEngine.start(
        workflow,
        payload.workspacePath,
        event.sender,
        payload.resumeFromNodeId
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown workflow start error'
      console.error('Error starting workflow:', error)
      event.sender.send(IpcChannels.TERMINAL_ERROR, {
        nodeId: 'system',
        error: errorMessage
      })
      event.sender.send(
        IpcChannels.WORKFLOW_COMPLETED,
        createWorkflowFailurePayload(payload.workflowId, errorMessage)
      )
    }
  })

  ipcMain.handle(IpcChannels.WORKFLOW_ABORT, async (_event, payload: WorkflowAbortPayload) => {
    console.log(
      `Received abort request for node: ${payload.nodeId || 'ALL'}, reason: ${payload.reason}`
    )
    await workflowEngine.abort(payload.nodeId, payload.reason)
  })

  ipcMain.handle(
    IpcChannels.WORKFLOW_REVIEW_APPROVE,
    async (_event, payload: WorkflowReviewActionPayload) => {
      await workflowEngine.approveReview(payload)
    }
  )

  ipcMain.handle(
    IpcChannels.WORKFLOW_REVIEW_REJECT,
    async (_event, payload: WorkflowReviewActionPayload) => {
      await workflowEngine.rejectReview(payload)
    }
  )

  ipcMain.handle(
    IpcChannels.WORKFLOW_REVIEW_RERUN,
    async (_event, payload: WorkflowReviewActionPayload) => {
      await workflowEngine.rerunReviewNode(payload)
    }
  )

  ipcMain.handle(
    IpcChannels.WORKFLOW_EXPLAIN_FAILURE,
    async (_event, payload: WorkflowExplainFailurePayload): Promise<WorkflowExplainFailureResult> => {
      return summarizeWorkflowFailure(payload)
    }
  )

  ipcMain.handle(IpcChannels.MEMORY_COMPACT_WORKFLOW, async (_event, payload) => {
    const createdAt = payload.createdAt ?? new Date().toISOString()
    const summary =
      payload.summary?.trim().length
        ? payload.summary
        : memoryManager.buildSuggestedCompactSummary({
            runId: payload.runId,
            sourceNodeIds: payload.sourceNodeIds,
            diagnostics: payload.diagnostics
          })
    const result = await memoryManager.compactWorkflowMemory({
      workspacePath: payload.workspacePath,
      workflowId: payload.workflowId,
      runId: payload.runId,
      sourceNodeIds: payload.sourceNodeIds,
      summary,
      createdAt
    })

    return {
      summaryPath: result.summaryPath,
      runId: payload.runId,
      sourceNodeIds: payload.sourceNodeIds
    }
  })

  app.on('before-quit', async (e: Electron.Event) => {
    e.preventDefault()
    console.log('App quitting, cleaning up processes and workspace watchers...')
    await workspaceService.dispose()
    await processManager.killAll()
    app.exit(0)
  })
}
