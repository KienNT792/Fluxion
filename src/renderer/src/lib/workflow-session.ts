import {
  getProviderCodexApprovalProtocolStatus,
  getWorkflowCodexApprovalGuardrail,
  NodeId,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  WorkspaceOpenedPayload,
} from '@shared';
import { useExecutionStore } from '../stores/execution.store';
import { useWorkflowStore } from '../stores/workflow.store';
import {
  getCodexReadinessBadgeState,
  getCodexReadinessBlockMessage,
} from './provider-capabilities';

const TRUSTED_WORKSPACE_STORAGE_KEY = 'fluxion.trusted-workspaces';

function normalizeWorkspacePath(value: string): string {
  return value.replace(/\\/g, '/').trim().toLowerCase();
}

function readTrustedWorkspaces(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(TRUSTED_WORKSPACE_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeTrustedWorkspaces(paths: string[]): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(TRUSTED_WORKSPACE_STORAGE_KEY, JSON.stringify(paths));
  } catch {
    // A storage failure should not block the explicit trust action; it only means
    // Fluxion will ask again the next time this workspace is opened.
  }
}

export function isTrustedWorkspacePath(workspacePath: string): boolean {
  const normalizedPath = normalizeWorkspacePath(workspacePath);
  return readTrustedWorkspaces().includes(normalizedPath);
}

export function markWorkspaceAsTrusted(workspacePath: string): void {
  const normalizedPath = normalizeWorkspacePath(workspacePath);
  const trustedWorkspaces = readTrustedWorkspaces();
  if (trustedWorkspaces.includes(normalizedPath)) {
    return;
  }

  // Renderer localStorage is intentionally a short-term trust cache for this release.
  // Clearing app data or reinstalling the app removes these entries and will prompt
  // for trust again. A future hardening pass should persist this in Electron userData.
  writeTrustedWorkspaces([...trustedWorkspaces, normalizedPath]);
}

export function shouldPromptWorkspaceTrust(workspacePath: string): boolean {
  return !isTrustedWorkspacePath(workspacePath);
}

export function requiresLegacyWorkflowAction(payload: WorkspaceOpenedPayload): boolean {
  return (
    payload.legacyWorkflowDetected
    && !payload.contextSummary?.contextOnboarding.legacyWorkflowDecision
  );
}

export function shouldShowInitialIncompleteContextPrompt(payload: WorkspaceOpenedPayload): boolean {
  if (payload.contextStatus !== 'incomplete' || !payload.isNewWorkspace) {
    return false;
  }

  return !payload.contextSummary?.contextOnboarding.initialPromptDismissedAt;
}

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
  useWorkflowStore.getState().setContextState(
    payload.contextStatus,
    payload.contextSummary ?? null
  );
  useWorkflowStore
    .getState()
    .setContextSetupOpen(
      payload.contextStatus === 'missing'
      || payload.contextStatus === 'legacy'
      || shouldShowInitialIncompleteContextPrompt(payload)
    );
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

export async function selectWorkspacePathFromDialog(): Promise<string | null> {
  return window.api.openWorkspaceDialog();
}

export async function openWorkspaceFromDialog(
  requestWorkspaceTrust?: (workspacePath: string) => Promise<boolean>
): Promise<void> {
  const selectedPath = await selectWorkspacePathFromDialog();
  if (!selectedPath) {
    return;
  }

  if (shouldPromptWorkspaceTrust(selectedPath)) {
    if (!requestWorkspaceTrust) {
      return;
    }

    const isTrusted = await requestWorkspaceTrust(selectedPath);
    if (!isTrusted) {
      return;
    }

    markWorkspaceAsTrusted(selectedPath);
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

export async function runCurrentWorkflow(resumeFromNodeId?: NodeId): Promise<void> {
  const workflowStore = useWorkflowStore.getState();
  const executionStore = useExecutionStore.getState();

  if (
    !workflowStore.workspacePath ||
    workflowStore.nodes.length === 0 ||
    executionStore.workflowStatus === 'running' ||
    executionStore.workflowStatus === 'stopping' ||
    executionStore.workflowStatus === 'paused'
  ) {
    return;
  }

  const workflow = buildWorkflowDocument();
  const approvalGuardrail = getWorkflowCodexApprovalGuardrail(workflow.nodes, {
    approvalProtocolStatus: getProviderCodexApprovalProtocolStatus(
      workflowStore.providerCapabilities
    ),
  });

  if (approvalGuardrail.severity === 'blocked') {
    executionStore.setWorkflowStatus('error');
    executionStore.setWorkflowError(approvalGuardrail.message);
    return;
  }

  const currentReadiness = getCodexReadinessBadgeState(
    workflowStore.providerCapabilities,
    workflowStore.nodes.map((node) => String(node.data.model ?? ''))
  );
  const providerCapabilities =
    !workflowStore.hasFetchedProviderCapabilities || currentReadiness.blocking
      ? await workflowStore.fetchProviderCapabilities(true)
      : workflowStore.providerCapabilities;
  const readiness = getCodexReadinessBadgeState(
    providerCapabilities,
    workflowStore.nodes.map((node) => String(node.data.model ?? ''))
  );

  if (readiness.blocking) {
    executionStore.setWorkflowStatus('error');
    executionStore.setWorkflowError(getCodexReadinessBlockMessage(readiness));
    return;
  }

  if (resumeFromNodeId) {
    const retryNodeIds = collectRetryNodeIds(resumeFromNodeId, workflow.edges);
    executionStore.resetNodeExecution(retryNodeIds);
    retryNodeIds.forEach((nodeId) => {
      executionStore.appendAttemptSeparator(
        nodeId,
        nodeId === resumeFromNodeId
          ? 'Retry started from this node.'
          : `Retry started from upstream node ${resumeFromNodeId}.`
      );
    });
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
  void runCurrentWorkflow(nodeId);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function approveReviewNode(nodeId: NodeId): Promise<void> {
  const workflowStore = useWorkflowStore.getState();
  const executionStore = useExecutionStore.getState();
  if (!executionStore.activeRunId) {
    return;
  }

  executionStore.setReviewActionInFlight(nodeId, 'approve');

  try {
    await window.api.approveWorkflowNode({
      workflowId: workflowStore.workflowId,
      runId: executionStore.activeRunId,
      nodeId,
    });
  } catch (error) {
    useExecutionStore.getState().setReviewActionInFlight(nodeId, undefined);
    useExecutionStore
      .getState()
      .setWorkflowError(getErrorMessage(error, 'Failed to approve review node.'));
  }
}

export async function rejectReviewNode(nodeId: NodeId): Promise<void> {
  const workflowStore = useWorkflowStore.getState();
  const executionStore = useExecutionStore.getState();
  if (!executionStore.activeRunId) {
    return;
  }

  executionStore.setReviewActionInFlight(nodeId, 'reject');

  try {
    await window.api.rejectWorkflowNode({
      workflowId: workflowStore.workflowId,
      runId: executionStore.activeRunId,
      nodeId,
    });
  } catch (error) {
    useExecutionStore.getState().setReviewActionInFlight(nodeId, undefined);
    useExecutionStore
      .getState()
      .setWorkflowError(getErrorMessage(error, 'Failed to reject review node.'));
  }
}

export async function rerunReviewNode(nodeId: NodeId): Promise<void> {
  const workflowStore = useWorkflowStore.getState();
  const executionStore = useExecutionStore.getState();
  if (!executionStore.activeRunId) {
    return;
  }

  executionStore.setReviewActionInFlight(nodeId, 'rerun');
  executionStore.appendAttemptSeparator(nodeId, 'Review rerun started.');

  try {
    await window.api.rerunWorkflowNode({
      workflowId: workflowStore.workflowId,
      runId: executionStore.activeRunId,
      nodeId,
    });
  } catch (error) {
    useExecutionStore.getState().setReviewActionInFlight(nodeId, undefined);
    useExecutionStore
      .getState()
      .setWorkflowError(getErrorMessage(error, 'Failed to rerun review node.'));
  }
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
