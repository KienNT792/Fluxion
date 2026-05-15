import * as fs from 'fs/promises';
import * as path from 'path';
import { WorkflowTraceEvent, WorkflowTraceEventSchema } from '@core';

type TraceWriteOperation<T> = () => Promise<T>;

export class WorkflowTraceStore {
  private readonly writeQueues = new Map<string, Promise<unknown>>();

  public getTracePath(workspacePath: string, runId: string): string {
    return path.join(workspacePath, '.fluxion', 'runs', `${runId}.trace.jsonl`);
  }

  public async append(workspacePath: string, event: WorkflowTraceEvent): Promise<void> {
    const tracePath = this.getTracePath(workspacePath, event.runId);

    try {
      await this.enqueue(tracePath, async () => {
        const parsed = WorkflowTraceEventSchema.parse(event);
        await fs.mkdir(path.dirname(tracePath), { recursive: true });
        await fs.appendFile(tracePath, `${JSON.stringify(parsed)}\n`, 'utf8');
      });
    } catch (error) {
      console.warn('Failed to append workflow trace event:', {
        tracePath,
        runId: event.runId,
        type: event.type,
        nodeId: event.nodeId,
        error,
      });
    }
  }

  public async appendMany(workspacePath: string, events: WorkflowTraceEvent[]): Promise<void> {
    for (const event of events) {
      await this.append(workspacePath, event);
    }
  }

  public async readTrace(workspacePath: string, runId: string): Promise<WorkflowTraceEvent[]> {
    const tracePath = this.getTracePath(workspacePath, runId);
    const content = await fs.readFile(tracePath, 'utf8');

    return content
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => WorkflowTraceEventSchema.parse(JSON.parse(line) as unknown));
  }

  private enqueue<T>(tracePath: string, operation: TraceWriteOperation<T>): Promise<T> {
    const queueKey = path.resolve(tracePath);
    const previous = this.writeQueues.get(queueKey) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    this.writeQueues.set(queueKey, next.catch(() => undefined));
    return next;
  }
}

export const workflowTraceStore = new WorkflowTraceStore();
