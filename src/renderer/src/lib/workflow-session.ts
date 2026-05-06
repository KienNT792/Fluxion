import { NodeId, Workflow, WorkflowEdge, WorkflowNode, WorkspaceOpenedPayload } from '@shared';
import { useExecutionStore } from '../stores/execution.store';
import { useWorkflowStore } from '../stores/workflow.store';

function mapCanvasNodesToWorkflowNodes(): WorkflowNode[] {
  return useWorkflowStore.getState().nodes.map((node) => ({
    id: node.id,
    type: node.type ?? 'agentNode',
    label:
      typeof node.data.label === 'string' && node.data.label.trim()
        ? node.data.label
        : String(node.data.model),
    data: node.data,
    position: node.position,
  }));
}

function mapCanvasEdgesToWorkflowEdges(): WorkflowEdge[] {
  return useWorkflowStore.getState().edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: typeof edge.label === 'string' ? edge.label : undefined,
  }));
}

function collectRetryNodeIds(startNodeId: NodeId, edges: WorkflowEdge[]): NodeId[] {
  const adjacency = new Map<NodeId, NodeId[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, []);
    }

    adjacency.get(edge.source)!.push(edge.target);
  }

  const visited = new Set<NodeId>();
  const queue: NodeId[] = [startNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) {
      continue;
    }

    visited.add(nodeId);
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      queue.push(neighbor);
    }
  }

  return [...visited];
}

export function buildWorkflowDocument(): Workflow {
  const { workflowId, workflowName, lastSavedAt, executionMode } = useWorkflowStore.getState();

  return {
    id: workflowId,
    name: workflowName,
    executionMode,
    nodes: mapCanvasNodesToWorkflowNodes(),
    edges: mapCanvasEdgesToWorkflowEdges(),
    updatedAt: lastSavedAt ?? undefined,
  };
}

export function hydrateWorkspaceState(payload: WorkspaceOpenedPayload): void {
  useWorkflowStore.getState().hydrateWorkspace(payload);
  useWorkflowStore.getState().setHasContext(payload.hasContext);
  const executionStore = useExecutionStore.getState();
  executionStore.resetExecution(payload.workflow.nodes.map((node) => node.id));
  executionStore.setWorkflowStatus('idle');
  executionStore.setWorkflowError(null);
}

export async function loadWorkspaceFromPath(workspacePath: string): Promise<void> {
  const payload = await window.api.loadWorkspace(workspacePath);
  hydrateWorkspaceState(payload);
  await useWorkflowStore.getState().fetchProviderCapabilities();
}

export async function openWorkspaceFromDialog(): Promise<void> {
  const selectedPath = await window.api.openWorkspaceDialog();
  if (!selectedPath) {
    return;
  }

  await loadWorkspaceFromPath(selectedPath);
}

export async function reloadCurrentWorkspaceFromDisk(): Promise<void> {
  const workspacePath = useWorkflowStore.getState().workspacePath;
  if (!workspacePath) {
    return;
  }

  await loadWorkspaceFromPath(workspacePath);
}

export async function saveCurrentWorkflow(): Promise<void> {
  const workflowStore = useWorkflowStore.getState();
  const workspacePath = workflowStore.workspacePath;
  if (!workspacePath || workflowStore.isSaving) {
    return;
  }

  const savedRevision = workflowStore.workflowRevision;
  workflowStore.markSaveStarted();

  try {
    const activeWorkflowFilePath = workflowStore.activeWorkflowFilePath;
    if (!activeWorkflowFilePath) {
      throw new Error('No active workflow file path found.');
    }

    const result = await window.api.saveWorkflow(
      workspacePath, 
      buildWorkflowDocument(),
      activeWorkflowFilePath
    );
    useWorkflowStore.getState().markSaveCompleted(result.savedAt, savedRevision);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to save workflow.';
    useWorkflowStore.getState().markSaveFailed(errorMessage);
    throw error;
  }
}

export function runCurrentWorkflow(resumeFromNodeId?: NodeId): void {
  const workflowStore = useWorkflowStore.getState();
  const executionStore = useExecutionStore.getState();

  if (
    !workflowStore.workspacePath ||
    workflowStore.nodes.length === 0 ||
    executionStore.workflowStatus === 'running' ||
    executionStore.workflowStatus === 'paused'
  ) {
    return;
  }

  const workflow = buildWorkflowDocument();

  if (resumeFromNodeId) {
    const retryNodeIds = collectRetryNodeIds(resumeFromNodeId, workflow.edges);
    executionStore.resetNodeExecution(retryNodeIds);
  } else {
    executionStore.resetExecution(workflow.nodes.map((node) => node.id));
  }

  executionStore.setWorkflowStatus('running');
  executionStore.setWorkflowError(null);
  window.api.runWorkflow(
    workflow.id,
    workflow.nodes,
    workflow.edges,
    workflowStore.workspacePath,
    workflow.executionMode ?? 'auto',
    resumeFromNodeId
  );
}

export function retryWorkflowFromNode(nodeId: NodeId): void {
  runCurrentWorkflow(nodeId);
}

export function approveReviewNode(nodeId: NodeId): void {
  const workflowStore = useWorkflowStore.getState();
  const executionStore = useExecutionStore.getState();
  if (!executionStore.activeRunId) {
    return;
  }

  window.api.approveWorkflowNode({
    workflowId: workflowStore.workflowId,
    runId: executionStore.activeRunId,
    nodeId,
  });
}

export function rejectReviewNode(nodeId: NodeId): void {
  const workflowStore = useWorkflowStore.getState();
  const executionStore = useExecutionStore.getState();
  if (!executionStore.activeRunId) {
    return;
  }

  window.api.rejectWorkflowNode({
    workflowId: workflowStore.workflowId,
    runId: executionStore.activeRunId,
    nodeId,
  });
}

export function rerunReviewNode(nodeId: NodeId): void {
  const workflowStore = useWorkflowStore.getState();
  const executionStore = useExecutionStore.getState();
  if (!executionStore.activeRunId) {
    return;
  }

  window.api.rerunWorkflowNode({
    workflowId: workflowStore.workflowId,
    runId: executionStore.activeRunId,
    nodeId,
  });
}

// Multi-workflow helpers

export async function createNewWorkflow(name: string): Promise<void> {
  const workspacePath = useWorkflowStore.getState().workspacePath;
  if (!workspacePath) return;

  const result = await window.api.createWorkflow(workspacePath, name);
  await switchWorkflow(result.workflow.id);
}

export async function switchWorkflow(workflowId: string): Promise<void> {
  const workflowState = useWorkflowStore.getState();
  const workspacePath = workflowState.workspacePath;
  if (!workspacePath) return;
  if (workflowState.workflowId === workflowId) return;

  // Persist pending changes from the current workflow before switching.
  if (workflowState.isDirty) {
    await saveCurrentWorkflow();
  }

  // Main process sets the active workflow file in this call.
  await window.api.loadWorkflow(workspacePath, workflowId);

  // Reload workspace payload so canvas state and workflow list stay in sync.
  await loadWorkspaceFromPath(workspacePath);
}

export async function deleteCurrentWorkflow(): Promise<void> {
  const workflowStore = useWorkflowStore.getState();
  const workspacePath = workflowStore.workspacePath;
  const workflowId = workflowStore.workflowId;

  if (!workspacePath || !workflowId) return;

  await window.api.deleteWorkflow(workspacePath, workflowId);
  await loadWorkspaceFromPath(workspacePath);
}
