import { describe, expect, it } from 'vitest';
import { WorkflowRunStateSchema } from '../schema/run-state.schema';

describe('WorkflowRunStateSchema', () => {
  it('accepts a valid initial run state', () => {
    const parsed = WorkflowRunStateSchema.parse({
      schemaVersion: 1,
      runId: 'run-1',
      workflowId: 'workflow-1',
      executionMode: 'auto',
      status: 'pending',
      updatedAt: '2026-05-05T00:00:00.000Z',
      currentNodeIds: [],
      awaitingReviewNodeIds: [],
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
    expect(parsed.executionMode).toBe('auto');
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
      executionMode: 'auto',
      status: 'idle',
      updatedAt: '2026-05-05T00:00:00.000Z',
      currentNodeIds: [],
      awaitingReviewNodeIds: [],
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

  it('accepts awaiting review metadata for human review checkpoints', () => {
    const parsed = WorkflowRunStateSchema.parse({
      schemaVersion: 1,
      runId: 'run-2',
      workflowId: 'workflow-1',
      executionMode: 'manual',
      status: 'awaiting_review',
      updatedAt: '2026-05-05T00:00:00.000Z',
      currentNodeIds: [],
      awaitingReviewNodeIds: ['node-a'],
      nodes: {
        'node-a': {
          nodeId: 'node-a',
          runner: 'codex',
          status: 'awaiting_review',
          attempts: 1,
          model: 'gpt-5.5',
          humanReview: true,
          reviewStatus: 'pending',
          reviewSource: 'manual',
          reviewRequestedAt: '2026-05-05T00:00:00.000Z',
          outputArtifactPaths: ['docs/review.md'],
        },
      },
    });

    expect(parsed.awaitingReviewNodeIds).toEqual(['node-a']);
    expect(parsed.executionMode).toBe('manual');
    expect(parsed.nodes['node-a']?.reviewStatus).toBe('pending');
    expect(parsed.nodes['node-a']?.reviewSource).toBe('manual');
  });
});
