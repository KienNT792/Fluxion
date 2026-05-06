import { app, dialog, ipcMain, IpcMainEvent } from 'electron';
import {
  IpcChannels,
  ProviderSettingsSummaryPayload,
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
} from '@shared';
import { formatZodError, validateWorkflowGraph, WorkflowSchema } from '@core';
import { workflowEngine } from '../services/workflow-engine';
import { providerRegistryService } from '../services/provider-registry.service';
import { processManager } from '../services/process-manager';
import { settingsService } from '../services/settings.service';
import { workspaceService } from '../services/workspace.service';

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

  ipcMain.handle(IpcChannels.PROVIDERS_GET_CAPABILITIES, async () => {
    return providerRegistryService.fetchCapabilities();
  });

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

  ipcMain.on(
    IpcChannels.WORKFLOW_ABORT,
    async (_event: IpcMainEvent, payload: WorkflowAbortPayload) => {
      try {
        console.log(
          `Received abort request for node: ${payload.nodeId || 'ALL'}, reason: ${payload.reason}`
        );
        await workflowEngine.abort(payload.nodeId, payload.reason);
      } catch (error) {
        console.error('Error aborting workflow:', error);
      }
    }
  );

  ipcMain.on(
    IpcChannels.WORKFLOW_REVIEW_APPROVE,
    async (_event: IpcMainEvent, payload: WorkflowReviewActionPayload) => {
      try {
        await workflowEngine.approveReview(payload);
      } catch (error) {
        console.error('Error approving workflow review:', error);
      }
    }
  );

  ipcMain.on(
    IpcChannels.WORKFLOW_REVIEW_REJECT,
    async (_event: IpcMainEvent, payload: WorkflowReviewActionPayload) => {
      try {
        await workflowEngine.rejectReview(payload);
      } catch (error) {
        console.error('Error rejecting workflow review:', error);
      }
    }
  );

  ipcMain.on(
    IpcChannels.WORKFLOW_REVIEW_RERUN,
    async (_event: IpcMainEvent, payload: WorkflowReviewActionPayload) => {
      try {
        await workflowEngine.rerunReviewNode(payload);
      } catch (error) {
        console.error('Error rerunning review node:', error);
      }
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
