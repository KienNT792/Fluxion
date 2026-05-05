import { describe, expect, it } from 'vitest';
import { WorkflowRunStateSchema } from '../schema/run-state.schema';

describe('WorkflowRunStateSchema', () => {
  it('accepts a valid initial run state', () => {
    const parsed = WorkflowRunStateSchema.parse({
      schemaVersion: 1,
      runId: 'run-1',
      workflowId: 'workflow-1',
      status: 'pending',
      updatedAt: '2026-05-05T00:00:00.000Z',
      currentNodeIds: [],
      nodes: {
        'node-a': {
          nodeId: 'node-a',
          runner: 'codex',
          status: 'pending',
          attempts: 0,
          runnerSessionId: 'session-123',
          model: 'gpt-5.5',
          outputArtifactPaths: [],
        },
      },
    });

    expect(parsed.status).toBe('pending');
    expect(parsed.nodes['node-a']?.runner).toBe('codex');
    expect(parsed.nodes['node-a']?.runnerSessionId).toBe('session-123');
    expect(parsed.nodes['node-a']?.model).toBe('gpt-5.5');
  });

  it('rejects an unsupported status', () => {
    expect(() =>
      WorkflowRunStateSchema.parse({
        schemaVersion: 1,
        runId: 'run-1',
        workflowId: 'workflow-1',
        status: 'idle',
        updatedAt: '2026-05-05T00:00:00.000Z',
        currentNodeIds: [],
        nodes: {
          'node-a': {
            nodeId: 'node-a',
            runner: 'codex',
            status: 'pending',
            attempts: 0,
            outputArtifactPaths: [],
          },
        },
      })
    ).toThrow();
  });
});

