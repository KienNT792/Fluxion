import { describe, expect, it } from 'vitest';
import { WorkflowSchema } from '../schema/workflow.schema';
import { formatZodError } from '../schema/zod-error';

describe('formatZodError', () => {
  it('formats malformed workflow payload errors without throwing', () => {
    const parsed = WorkflowSchema.safeParse({
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
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }

    expect(formatZodError(parsed.error)).toContain('nodes.0.data.codex.approvalPolicy');
  });
});

