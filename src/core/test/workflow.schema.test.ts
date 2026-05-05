import { describe, expect, it } from 'vitest';
import { WorkflowSchema } from '../schema/workflow.schema';

describe('WorkflowSchema', () => {
  it('normalizes future-facing node defaults for backward compatibility', () => {
    const parsed = WorkflowSchema.parse({
      id: 'workflow-1',
      name: 'Workflow 1',
      nodes: [
        {
          id: 'node-a',
          type: 'agentNode',
          label: 'Node A',
          position: { x: 0, y: 0 },
          data: {
            provider: 'openai',
            model: 'gpt-5.5',
            prompt: 'Do the thing',
          },
        },
      ],
      edges: [],
    });

    expect(parsed.nodes[0].data.runner).toBe('codex');
    expect(parsed.nodes[0].data.codex).toEqual({
      json: true,
      sandboxMode: 'workspace-write',
      approvalPolicy: 'never',
    });
    expect(parsed.nodes[0].data.requires).toEqual([]);
    expect(parsed.nodes[0].data.produces).toEqual([]);
    expect(parsed.nodes[0].data.humanReview).toBe(false);
  });

  it('accepts explicit codex sandbox options', () => {
    const parsed = WorkflowSchema.parse({
      id: 'workflow-1',
      name: 'Workflow 1',
      nodes: [
        {
          id: 'node-a',
          type: 'agentNode',
          label: 'Node A',
          position: { x: 0, y: 0 },
          data: {
            provider: 'openai',
            model: 'gpt-5.5',
            prompt: 'Do the thing',
            codex: {
              sandboxMode: 'read-only',
              approvalPolicy: 'on-request',
            },
          },
        },
      ],
      edges: [],
    });

    expect(parsed.nodes[0].data.codex).toEqual({
      json: true,
      sandboxMode: 'read-only',
      approvalPolicy: 'on-request',
    });
  });

  it('rejects an invalid codex sandbox mode', () => {
    expect(() =>
      WorkflowSchema.parse({
        id: 'workflow-1',
        name: 'Workflow 1',
        nodes: [
          {
            id: 'node-a',
            type: 'agentNode',
            label: 'Node A',
            position: { x: 0, y: 0 },
            data: {
              provider: 'openai',
              model: 'gpt-5.5',
              prompt: 'Do the thing',
              codex: {
                sandboxMode: 'full-auto',
              },
            },
          },
        ],
        edges: [],
      })
    ).toThrow();
  });

  it('rejects an invalid codex approval policy', () => {
    expect(() =>
      WorkflowSchema.parse({
        id: 'workflow-1',
        name: 'Workflow 1',
        nodes: [
          {
            id: 'node-a',
            type: 'agentNode',
            label: 'Node A',
            position: { x: 0, y: 0 },
            data: {
              provider: 'openai',
              model: 'gpt-5.5',
              prompt: 'Do the thing',
              codex: {
                approvalPolicy: 'on-failure',
              },
            },
          },
        ],
        edges: [],
      })
    ).toThrow();
  });
});
