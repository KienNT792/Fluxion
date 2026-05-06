import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import matter from 'gray-matter';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { memoryManager } from '../services/memory-manager';

describe('MemoryManager', () => {
  let workspacePath: string;

  beforeEach(async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-memory-'));
    await memoryManager.initWorkspace(workspacePath);
  });

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true });
  });

  it('writes V2 frontmatter for completed node outputs', async () => {
    const outputPath = await memoryManager.saveNodeOutput(workspacePath, 'workflow-1', {
      runId: 'run-1',
      nodeId: 'node-a',
      runner: 'codex',
      model: 'gpt-5.5',
      status: 'completed',
      startedAt: '2026-05-06T00:00:00.000Z',
      completedAt: '2026-05-06T00:00:01.000Z',
      exitCode: 0,
      runnerSessionId: 'session-1',
      provider: 'openai',
      content: 'Final answer',
    });

    const parsed = matter(await readFile(outputPath, 'utf8'));
    expect(parsed.data).toMatchObject({
      schemaVersion: '2.0',
      nodeId: 'node-a',
      runId: 'run-1',
      runner: 'codex',
      model: 'gpt-5.5',
      status: 'completed',
      startedAt: '2026-05-06T00:00:00.000Z',
      completedAt: '2026-05-06T00:00:01.000Z',
      exitCode: 0,
      runnerSessionId: 'session-1',
      provider: 'openai',
    });
    expect(parsed.content.trimEnd()).toBe('Final answer');
  });

  it('compiles context from both V1 and V2 short-term memory files', async () => {
    const shortTermDir = join(workspacePath, '.fluxion', 'memory', 'short-term', 'workflow-2');
    await mkdir(shortTermDir, { recursive: true });
    const v1Content = matter.stringify('Legacy node output', {
      schemaVersion: '1.0',
      nodeId: 'node-v1',
      provider: 'openai',
      model: 'gpt-4.1',
      status: 'completed',
      timestamp: 123,
    });
    await writeFile(join(shortTermDir, 'node-v1.md'), v1Content, 'utf8');

    await memoryManager.saveNodeOutput(workspacePath, 'workflow-2', {
      runId: 'run-2',
      nodeId: 'node-v2',
      runner: 'codex',
      model: 'gpt-5.5',
      status: 'completed',
      startedAt: '2026-05-06T00:00:00.000Z',
      completedAt: '2026-05-06T00:00:01.000Z',
      provider: 'openai',
      content: 'Modern node output',
    });

    const context = await memoryManager.compileContext(workspacePath, 'workflow-2', [
      'node-v1',
      'node-v2',
    ]);

    expect(context).toContain('Output from Node node-v1 (openai / gpt-4.1)');
    expect(context).toContain('Legacy node output');
    expect(context).toContain('Output from Node node-v2 (codex / gpt-5.5)');
    expect(context).toContain('Modern node output');
  });
});
