import { app, dialog, ipcMain, IpcMainEvent, shell } from 'electron';
import { open, realpath, stat } from 'fs/promises';
import { isAbsolute, relative, resolve } from 'path';
import {
  ContextSaveMode,
  getProviderCodexApprovalProtocolStatus,
  getWorkflowCodexApprovalGuardrail,
  IpcChannels,
  ProviderSettingsSummaryPayload,
  GetProviderCapabilitiesPayload,
  ProjectContextDraftV2,
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
  WorkspaceReadTextFilePayload,
  WorkspaceReadTextFileResult,
} from '@shared';
import { formatZodError, validateWorkflowGraph, WorkflowSchema } from '@core';
import { workflowEngine } from '../services/workflow-engine';
import { providerRegistryService } from '../services/provider-registry.service';
import { processManager } from '../services/process-manager';
import { settingsService } from '../services/settings.service';
import { openShellPath, revealShellPath } from '../services/shell-path.service';
import { workspaceService } from '../services/workspace.service';

const DEFAULT_TEXT_PREVIEW_MAX_BYTES = 256 * 1024;
const HARD_TEXT_PREVIEW_MAX_BYTES = 1024 * 1024;

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
    error,
  };
}

function validateWorkflow(payload: WorkflowRunPayload): string | null {
  if (!payload.workspacePath.trim()) {
    return 'Open a workspace before running the workflow.';
  }

  const parsedWorkflow = WorkflowSchema.safeParse({
    id: payload.workflowId,
    name: 'Fluxion Workflow',
    executionMode: payload.executionMode,
    nodes: payload.nodes,
    edges: payload.edges,
  });

  if (!parsedWorkflow.success) {
    return `Invalid workflow payload: ${formatZodError(parsedWorkflow.error)}`;
  }

  const workflow = parsedWorkflow.data;
  const result = validateWorkflowGraph(workflow, {
    resumeFromNodeId: payload.resumeFromNodeId,
  });

  return result.errors[0]?.message ?? null;
}

function coercePreviewMaxBytes(maxBytes: number | undefined): number {
  if (typeof maxBytes !== 'number' || !Number.isFinite(maxBytes)) {
    return DEFAULT_TEXT_PREVIEW_MAX_BYTES;
  }

  return Math.min(
    HARD_TEXT_PREVIEW_MAX_BYTES,
    Math.max(1, Math.floor(maxBytes))
  );
}

async function resolveWorkspaceBoundFile(
  workspacePath: string,
  filePath: string
): Promise<string> {
  const workspaceRoot = resolve(workspacePath);
  const requestedPath = isAbsolute(filePath)
    ? resolve(filePath)
    : resolve(workspaceRoot, filePath);
  const [workspaceRealPath, fileRealPath] = await Promise.all([
    realpath(workspaceRoot),
    realpath(requestedPath),
  ]);
  const relativePath = relative(workspaceRealPath, fileRealPath);

  if (
    relativePath === ''
    || relativePath.startsWith('..')
    || isAbsolute(relativePath)
  ) {
    throw new Error('File is outside the active workspace.');
  }

  return fileRealPath;
}

async function readWorkspaceTextFile(
  payload: WorkspaceReadTextFilePayload
): Promise<WorkspaceReadTextFileResult> {
  const filePath = await resolveWorkspaceBoundFile(payload.workspacePath, payload.filePath);
  const maxBytes = coercePreviewMaxBytes(payload.maxBytes);
  const fileStats = await stat(filePath);

  if (!fileStats.isFile()) {
    throw new Error('Path is not a file.');
  }

  const bytesToRead = Math.min(fileStats.size, maxBytes);
  const fileHandle = await open(filePath, 'r');

  try {
    const buffer = Buffer.alloc(bytesToRead);
    const { bytesRead } = await fileHandle.read(buffer, 0, bytesToRead, 0);

    return {
      content: buffer.subarray(0, bytesRead).toString('utf8'),
      truncated: fileStats.size > maxBytes,
    };
  } finally {
    await fileHandle.close();
  }
}

export function registerWorkflowHandlers(): void {
  ipcMain.handle(IpcChannels.WORKSPACE_OPEN_DIALOG, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open Workspace',
      buttonLabel: 'Open Workspace',
      defaultPath: app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled) {
      return null;
    }

    return result.filePaths[0] ?? null;
  });

  ipcMain.handle(IpcChannels.WORKSPACE_LOAD, async (event, workspacePath: string) => {
    return workspaceService.loadWorkspace(workspacePath, event.sender);
  });

  ipcMain.handle(IpcChannels.WORKSPACE_SAVE, async (_event, payload: WorkflowSavePayload) => {
    return workspaceService.saveWorkflow(
      payload.workspacePath,
      payload.workflow,
      payload.activeWorkflowFilePath
    );
  });

  ipcMain.handle(
    IpcChannels.WORKSPACE_READ_TEXT_FILE,
    async (_event, payload: WorkspaceReadTextFilePayload) => {
      return readWorkspaceTextFile(payload);
    }
  );

  ipcMain.handle(
    IpcChannels.WORKSPACE_WORKFLOW_CREATE,
    async (_event, payload: WorkflowCreatePayload) => {
      return workspaceService.createWorkflow(payload.workspacePath, payload.name);
    }
  );

  ipcMain.handle(
    IpcChannels.WORKSPACE_WORKFLOW_LOAD,
    async (_event, payload: WorkflowLoadPayload) => {
      const { workflows } = await workspaceService.scanWorkflows(payload.workspacePath);
      const target = workflows.find((w) => w.id === payload.workflowId);
      if (!target) {
        throw new Error(`Workflow with ID ${payload.workflowId} not found.`);
      }
      return workspaceService.loadWorkflowFile(target.filePath);
    }
  );

  ipcMain.handle(
    IpcChannels.WORKSPACE_WORKFLOW_DELETE,
    async (_event, payload: WorkflowDeletePayload) => {
      const { workflows } = await workspaceService.scanWorkflows(payload.workspacePath);
      const target = workflows.find((w) => w.id === payload.workflowId);
      if (!target) {
        throw new Error(`Workflow with ID ${payload.workflowId} not found.`);
      }
      return workspaceService.deleteWorkflow(target.filePath);
    }
  );

  ipcMain.handle(
    IpcChannels.WORKSPACE_SAVE_CONTEXT,
    async (_event, payload: { workspacePath: string; context: Record<string, string> }) => {
      await workspaceService.saveContext(payload.workspacePath, payload.context);
    }
  );

  ipcMain.handle(IpcChannels.WORKSPACE_SCAN_CONTEXT, async (_event, workspacePath: string) => {
    return workspaceService.scanWorkspaceContext(workspacePath);
  });

  ipcMain.handle(IpcChannels.WORKSPACE_GET_CONTEXT, async (_event, workspacePath: string) => {
    return workspaceService.getContext(workspacePath);
  });

  ipcMain.handle(
    IpcChannels.WORKSPACE_SAVE_CONTEXT_V2,
    async (
      _event,
      payload: { workspacePath: string; draft: ProjectContextDraftV2; mode?: ContextSaveMode }
    ) => {
      return workspaceService.saveContextV2(
        payload.workspacePath,
        payload.draft,
        payload.mode
      );
    }
  );

  ipcMain.handle(
    IpcChannels.PROVIDERS_GET_CAPABILITIES,
    async (_event, payload?: GetProviderCapabilitiesPayload) => {
      return providerRegistryService.fetchCapabilities(Boolean(payload?.forceRefresh));
    }
  );

  ipcMain.handle(
    IpcChannels.SETTINGS_GET_PROVIDER_SUMMARY,
    async (): Promise<ProviderSettingsSummaryPayload> => {
      return settingsService.getProviderSettingsSummary();
    }
  );

  ipcMain.handle(
    IpcChannels.SETTINGS_SET_OPENAI_API_KEY,
    async (_event, payload: UpdateOpenAIApiKeyPayload): Promise<ProviderSettingsSummaryPayload> => {
      const summary = await settingsService.updateOpenAIApiKey(payload.apiKey);
      providerRegistryService.invalidateCache();
      return summary;
    }
  );

  ipcMain.handle(IpcChannels.SHELL_OPEN_PATH, async (_event, pathValue: string) => {
    await openShellPath(shell, pathValue);
  });

  ipcMain.handle(IpcChannels.SHELL_REVEAL_PATH, async (_event, pathValue: string) => {
    await revealShellPath(shell, pathValue);
  });

  ipcMain.on(
    IpcChannels.WORKFLOW_RUN,
    async (event: IpcMainEvent, payload: WorkflowRunPayload) => {
      try {
        const validationError = validateWorkflow(payload);
        if (validationError) {
          event.sender.send(IpcChannels.TERMINAL_ERROR, {
            nodeId: 'system',
            error: validationError,
          });
          event.sender.send(
            IpcChannels.WORKFLOW_COMPLETED,
            createWorkflowFailurePayload(payload.workflowId, validationError)
          );
          return;
        }

        const approvalGuardrail = getWorkflowCodexApprovalGuardrail(payload.nodes, {
          approvalProtocolStatus: getProviderCodexApprovalProtocolStatus(
            providerRegistryService.getCachedCapabilities()
          ),
        });
        if (approvalGuardrail.severity === 'blocked') {
          event.sender.send(IpcChannels.TERMINAL_ERROR, {
            nodeId: 'system',
            error: approvalGuardrail.message,
          });
          event.sender.send(
            IpcChannels.WORKFLOW_COMPLETED,
            createWorkflowFailurePayload(payload.workflowId, approvalGuardrail.message)
          );
          return;
        }

        const workflow: Workflow = {
          id: payload.workflowId,
          name: 'Fluxion Workflow',
          executionMode: payload.executionMode ?? 'auto',
          nodes: payload.nodes,
          edges: payload.edges,
        };

        await workflowEngine.start(
          workflow,
          payload.workspacePath,
          event.sender,
          payload.resumeFromNodeId
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown workflow start error';
        console.error('Error starting workflow:', error);
        event.sender.send(IpcChannels.TERMINAL_ERROR, {
          nodeId: 'system',
          error: errorMessage,
        });
        event.sender.send(
          IpcChannels.WORKFLOW_COMPLETED,
          createWorkflowFailurePayload(payload.workflowId, errorMessage)
        );
      }
    }
  );

  ipcMain.handle(
    IpcChannels.WORKFLOW_ABORT,
    async (_event, payload: WorkflowAbortPayload) => {
      console.log(
        `Received abort request for node: ${payload.nodeId || 'ALL'}, reason: ${payload.reason}`
      );
      await workflowEngine.abort(payload.nodeId, payload.reason);
    }
  );

  ipcMain.handle(
    IpcChannels.WORKFLOW_REVIEW_APPROVE,
    async (_event, payload: WorkflowReviewActionPayload) => {
      await workflowEngine.approveReview(payload);
    }
  );

  ipcMain.handle(
    IpcChannels.WORKFLOW_REVIEW_REJECT,
    async (_event, payload: WorkflowReviewActionPayload) => {
      await workflowEngine.rejectReview(payload);
    }
  );

  ipcMain.handle(
    IpcChannels.WORKFLOW_REVIEW_RERUN,
    async (_event, payload: WorkflowReviewActionPayload) => {
      await workflowEngine.rerunReviewNode(payload);
    }
  );

  app.on('before-quit', async (e: Electron.Event) => {
    e.preventDefault();
    console.log('App quitting, cleaning up processes and workspace watchers...');
    await workspaceService.dispose();
    await processManager.killAll();
    app.exit(0);
  });
}
