import { Workflow } from '../schema/workflow.schema';
import {
  WorkflowGraphValidationOptions,
  WorkflowValidationError,
  WorkflowValidationResult,
} from './dag.types';

function addError(
  errors: WorkflowValidationError[],
  code: string,
  message: string,
  details: Pick<WorkflowValidationError, 'nodeId' | 'edgeId'> = {}
): void {
  errors.push({ code, message, ...details });
}

function buildAdjacency(workflow: Workflow): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();

  for (const node of workflow.nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of workflow.edges) {
    adjacency.get(edge.source)?.push(edge.target);
  }

  return adjacency;
}

function findDuplicateIds(items: { id: string }[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) {
      duplicates.add(item.id);
    }
    seen.add(item.id);
  }

  return duplicates;
}

export function getReachableNodeIds(workflow: Workflow, fromNodeId: string): Set<string> {
  const adjacency = buildAdjacency(workflow);
  const selectedNodeIds = new Set<string>();
  const queue: string[] = [fromNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (selectedNodeIds.has(nodeId)) {
      continue;
    }

    selectedNodeIds.add(nodeId);
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      queue.push(neighbor);
    }
  }

  return selectedNodeIds;
}

export function getTopologicalBatches(
  workflow: Workflow,
  nodeIds = new Set(workflow.nodes.map((node) => node.id))
): string[][] {
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const node of workflow.nodes) {
    if (!nodeIds.has(node.id)) {
      continue;
    }
    inDegree.set(node.id, 0);
    graph.set(node.id, []);
  }

  for (const edge of workflow.edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      graph.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  const batches: string[][] = [];
  let visitedCount = 0;

  while (queue.length > 0) {
    const currentBatch = [...queue];
    queue.length = 0;
    batches.push(currentBatch);

    for (const nodeId of currentBatch) {
      visitedCount += 1;
      for (const neighbor of graph.get(nodeId) ?? []) {
        const nextDegree = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, nextDegree);
        if (nextDegree === 0) {
          queue.push(neighbor);
        }
      }
    }
  }

  if (visitedCount !== nodeIds.size) {
    throw new Error('Workflow graph contains a cycle.');
  }

  return batches;
}

export function validateWorkflowGraph(
  workflow: Workflow,
  options: WorkflowGraphValidationOptions = {}
): WorkflowValidationResult {
  const errors: WorkflowValidationError[] = [];
  const requireRunnableWorkflow = options.requireRunnableWorkflow ?? true;

  if (requireRunnableWorkflow && workflow.nodes.length === 0) {
    addError(errors, 'WORKFLOW_EMPTY', 'Add at least one node before running the workflow.');
  }

  const duplicateNodeIds = findDuplicateIds(workflow.nodes);
  for (const nodeId of duplicateNodeIds) {
    addError(errors, 'DUPLICATE_NODE_ID', `Duplicate node id detected: ${nodeId}`, {
      nodeId,
    });
  }

  const duplicateEdgeIds = findDuplicateIds(workflow.edges);
  for (const edgeId of duplicateEdgeIds) {
    addError(errors, 'DUPLICATE_EDGE_ID', `Duplicate edge id detected: ${edgeId}`, {
      edgeId,
    });
  }

  const nodeIds = new Set(workflow.nodes.map((node) => node.id));

  for (const node of workflow.nodes) {
    if (!node.data.prompt.trim()) {
      addError(errors, 'NODE_PROMPT_MISSING', `Node ${node.id} is missing a prompt.`, {
        nodeId: node.id,
      });
    }
  }

  if (options.resumeFromNodeId && !nodeIds.has(options.resumeFromNodeId)) {
    addError(
      errors,
      'RESUME_NODE_MISSING',
      `Retry node ${options.resumeFromNodeId} does not exist in the workflow.`,
      { nodeId: options.resumeFromNodeId }
    );
  }

  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.source)) {
      addError(
        errors,
        'EDGE_SOURCE_MISSING',
        `Edge ${edge.id} references a source node that does not exist.`,
        { edgeId: edge.id, nodeId: edge.source }
      );
    }

    if (!nodeIds.has(edge.target)) {
      addError(
        errors,
        'EDGE_TARGET_MISSING',
        `Edge ${edge.id} references a target node that does not exist.`,
        { edgeId: edge.id, nodeId: edge.target }
      );
    }
  }

  if (errors.length === 0) {
    try {
      getTopologicalBatches(workflow);
    } catch {
      addError(errors, 'WORKFLOW_CYCLE', 'Workflow graph contains a cycle. Remove the loop before running.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

