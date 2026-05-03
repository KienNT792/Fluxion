import { app, dialog, ipcMain, IpcMainEvent } from 'electron';
import {
  IpcChannels,
  Workflow,
  WorkflowAbortPayload,
  WorkflowCompletedPayload,
  WorkflowRunPayload,
  WorkflowSavePayload,
  WorkflowCreatePayload,
  WorkflowLoadPayload,
  WorkflowDeletePayload,
} from '@shared';
import { workflowEngine } from '../services/workflow-engine';
import { codexModelRegistryService } from '../services/codex-model-registry.service';
import { processManager } from '../services/process-manager';
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

  if (payload.nodes.length === 0) {
    return 'Add at least one node before running the workflow.';
  }

  const nodeIds = new Set<string>();
  for (const node of payload.nodes) {
    if (nodeIds.has(node.id)) {
      return `Duplicate node id detected: ${node.id}`;
    }

    nodeIds.add(node.id);

    if (!node.data.prompt.trim()) {
      return `Node ${node.id} is missing a prompt.`;
    }
  }

  if (payload.resumeFromNodeId && !nodeIds.has(payload.resumeFromNodeId)) {
    return `Retry node ${payload.resumeFromNodeId} does not exist in the workflow.`;
  }

  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of payload.nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of payload.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      return `Edge ${edge.id} references a node that does not exist.`;
    }

    adjacency.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  let visitedCount = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visitedCount += 1;

    for (const neighbor of adjacency.get(current) ?? []) {
      const nextDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, nextDegree);
      if (nextDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (visitedCount !== payload.nodes.length) {
    return 'Workflow graph contains a cycle. Remove the loop before running.';
  }

  return null;
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

  ipcMain.handle(IpcChannels.CODEX_GET_CAPABILITIES, async () => {
    return codexModelRegistryService.fetchCapabilities();
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

        const workflow: Workflow = {
          id: payload.workflowId,
          name: 'Fluxion Workflow',
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

  app.on('before-quit', async (e: Electron.Event) => {
    e.preventDefault();
    console.log('App quitting, cleaning up processes and workspace watchers...');
    await workspaceService.dispose();
    await processManager.killAll();
    app.exit(0);
  });
}
