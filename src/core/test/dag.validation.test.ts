import { describe, expect, it } from 'vitest';
import {
  getReachableNodeIds,
  getTopologicalBatches,
  validateWorkflowGraph,
  WorkflowSchema,
} from '..';

function buildWorkflow(input: {
  nodes: Array<{ id: string; prompt?: string }>;
  edges: Array<{ id: string; source: string; target: string }>;
}) {
  return WorkflowSchema.parse({
    id: 'workflow-1',
    name: 'Workflow 1',
    nodes: input.nodes.map((node, index) => ({
      id: node.id,
      type: 'agentNode',
      label: node.id,
      position: { x: index * 100, y: 0 },
      data: {
        provider: 'openai',
        model: 'gpt-5.5',
        prompt: node.prompt ?? `Prompt for ${node.id}`,
      },
    })),
    edges: input.edges,
  });
}

describe('validateWorkflowGraph', () => {
  it('passes a valid minimal workflow', () => {
    const workflow = buildWorkflow({
      nodes: [{ id: 'A' }],
      edges: [],
    });

    const result = validateWorkflowGraph(workflow);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when a node prompt is empty', () => {
    const workflow = buildWorkflow({
      nodes: [{ id: 'A', prompt: '' }],
      edges: [],
    });

    const result = validateWorkflowGraph(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('NODE_PROMPT_MISSING');
  });

  it('fails on duplicate node ids', () => {
    const workflow = buildWorkflow({
      nodes: [{ id: 'A' }, { id: 'A' }],
      edges: [],
    });

    const result = validateWorkflowGraph(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === 'DUPLICATE_NODE_ID')).toBe(true);
  });

  it('fails when an edge source is missing', () => {
    const workflow = buildWorkflow({
      nodes: [{ id: 'A' }],
      edges: [{ id: 'edge-1', source: 'missing', target: 'A' }],
    });

    const result = validateWorkflowGraph(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === 'EDGE_SOURCE_MISSING')).toBe(true);
  });

  it('fails when an edge target is missing', () => {
    const workflow = buildWorkflow({
      nodes: [{ id: 'A' }],
      edges: [{ id: 'edge-1', source: 'A', target: 'missing' }],
    });

    const result = validateWorkflowGraph(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === 'EDGE_TARGET_MISSING')).toBe(true);
  });

  it('fails when the graph contains a cycle', () => {
    const workflow = buildWorkflow({
      nodes: [{ id: 'A' }, { id: 'B' }],
      edges: [
        { id: 'edge-1', source: 'A', target: 'B' },
        { id: 'edge-2', source: 'B', target: 'A' },
      ],
    });

    const result = validateWorkflowGraph(workflow);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === 'WORKFLOW_CYCLE')).toBe(true);
  });

  it('returns ordered topological batches for a linear DAG', () => {
    const workflow = buildWorkflow({
      nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
      edges: [
        { id: 'edge-1', source: 'A', target: 'B' },
        { id: 'edge-2', source: 'B', target: 'C' },
      ],
    });

    expect(getTopologicalBatches(workflow)).toEqual([['A'], ['B'], ['C']]);
  });

  it('returns parallel nodes in the first batch', () => {
    const workflow = buildWorkflow({
      nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
      edges: [
        { id: 'edge-1', source: 'A', target: 'C' },
        { id: 'edge-2', source: 'B', target: 'C' },
      ],
    });

    const batches = getTopologicalBatches(workflow);
    expect([...batches[0]].sort()).toEqual(['A', 'B']);
    expect(batches[1]).toEqual(['C']);
  });

  it('selects only reachable downstream nodes from the resume node', () => {
    const workflow = buildWorkflow({
      nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
      edges: [
        { id: 'edge-1', source: 'A', target: 'B' },
        { id: 'edge-2', source: 'B', target: 'C' },
      ],
    });

    expect([...getReachableNodeIds(workflow, 'B')].sort()).toEqual(['B', 'C']);
    expect(getReachableNodeIds(workflow, 'B').has('A')).toBe(false);
    expect(getReachableNodeIds(workflow, 'B').has('D')).toBe(false);
  });
});

