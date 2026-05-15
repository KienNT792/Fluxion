import { once } from 'events';
import { afterEach, describe, expect, it } from 'vitest';
import { processManager } from '../services/process-manager';

describe('ProcessManager', () => {
  afterEach(async () => {
    await processManager.killAll();
    processManager.setMaxConcurrent(5);
  });

  it('cleans up completed process records', async () => {
    const child = processManager.spawnProcess(
      'node-a',
      process.execPath,
      ['-e', 'setTimeout(() => undefined, 25)'],
      { stdio: 'ignore' }
    );

    expect(child.pid).toBeDefined();
    expect(processManager.getTrackedCount()).toBe(1);

    await once(child, 'exit');

    expect(processManager.getTrackedCount()).toBe(0);
    expect(processManager.getActiveCount()).toBe(0);
  });

  it('clears killed process records after killAll', async () => {
    const child = processManager.spawnProcess(
      'node-a',
      process.execPath,
      ['-e', 'setTimeout(() => undefined, 10000)'],
      { stdio: 'ignore' }
    );

    expect(child.pid).toBeDefined();
    expect(processManager.getTrackedCount()).toBe(1);

    await processManager.killAll();

    expect(processManager.getTrackedCount()).toBe(0);
    expect(processManager.getActiveCount()).toBe(0);
  });
});
