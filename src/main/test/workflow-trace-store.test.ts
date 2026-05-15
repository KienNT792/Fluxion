import { mkdir, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowTraceEvent, WorkflowTraceEventSchema } from '@core';
import { WorkflowTraceStore } from '../services/workflow-trace-store';

function createEvent(overrides: Partial<WorkflowTraceEvent> = {}): WorkflowTraceEvent {
  const event: WorkflowTraceEvent = {
    schemaVersion: 1,
    runId: 'run-1',
    workflowId: 'workflow-1',
    type: 'node.running',
    timestamp: '2026-05-10T00:00:00.000Z',
    data: {},
    ...overrides,
  };

  if (!event.type.startsWith('workflow.') && !event.nodeId) {
    event.nodeId = 'node-a';
  }

  return event;
}

describe('WorkflowTraceStore', () => {
  let workspacePath: string;
  let store: WorkflowTraceStore;

  beforeEach(async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-trace-'));
    store = new WorkflowTraceStore();
  });

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('appends one JSON event per line and reads parsed trace events', async () => {
    await store.append(workspacePath, createEvent({ type: 'workflow.started' }));
    await store.append(workspacePath, createEvent({ type: 'node.running' }));

    const events = await store.readTrace(workspacePath, 'run-1');

    expect(events.map((event) => event.type)).toEqual(['workflow.started', 'node.running']);
    expect(events[0]).toMatchObject({
      schemaVersion: 1,
      runId: 'run-1',
      workflowId: 'workflow-1',
    });
  });

  it('validates trace event schema', () => {
    expect(() => WorkflowTraceEventSchema.parse(createEvent())).not.toThrow();
    expect(() =>
      WorkflowTraceEventSchema.parse({
        ...createEvent(),
        type: 'node.unknown',
      })
    ).toThrow();
  });

  it('serializes concurrent appends without corrupting JSONL output', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        store.append(
          workspacePath,
          createEvent({
            type: 'node.running',
            nodeId: `node-${index}`,
            data: { index },
          })
        )
      )
    );

    const events = await store.readTrace(workspacePath, 'run-1');

    expect(events).toHaveLength(10);
    expect(events.map((event) => event.nodeId)).toEqual(
      Array.from({ length: 10 }, (_, index) => `node-${index}`)
    );
  });

  it('logs a warning instead of throwing when append fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const tracePath = store.getTracePath(workspacePath, 'run-1');
    await mkdir(dirname(tracePath), { recursive: true });
    await mkdir(tracePath);

    await expect(
      store.append(workspacePath, createEvent({ type: 'workflow.started' }))
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to append workflow trace event:',
      expect.objectContaining({
        tracePath,
        runId: 'run-1',
        type: 'workflow.started',
        error: expect.any(Error),
      })
    );
  });
});
