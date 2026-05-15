import { spawn } from 'child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

interface EvalResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runEval(workspacePath: string, runId: string): Promise<EvalResult> {
  const scriptPath = join(process.cwd(), 'scripts', 'eval', 'workflow-trace-eval.mjs');
  const child = spawn(process.execPath, [
    scriptPath,
    '--workspace',
    workspacePath,
    '--run',
    runId,
  ]);
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: Buffer) => {
    stdout += chunk.toString('utf8');
  });
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
  });

  return new Promise((resolve) => {
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function writeTrace(workspacePath: string, runId: string, events: unknown[]): Promise<void> {
  const runDir = join(workspacePath, '.fluxion', 'runs');
  await mkdir(runDir, { recursive: true });
  await writeFile(
    join(runDir, `${runId}.trace.jsonl`),
    `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
    'utf8'
  );
}

function event(type: string, nodeId?: string): Record<string, unknown> {
  return {
    schemaVersion: 1,
    runId: 'run-1',
    workflowId: 'workflow-1',
    nodeId,
    type,
    timestamp: '2026-05-10T00:00:00.000Z',
  };
}

describe('workflow-trace-eval', () => {
  let workspacePath: string;

  beforeEach(async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-trace-eval-'));
  });

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true });
  });

  it('returns pass for a valid happy-path trace', async () => {
    await writeTrace(workspacePath, 'run-1', [
      event('workflow.started'),
      event('node.ready', 'node-a'),
      event('node.running', 'node-a'),
      event('node.process_spawned', 'node-a'),
      event('node.process_exited', 'node-a'),
      event('node.produces_validated', 'node-a'),
      event('node.output_saved', 'node-a'),
      event('workflow.completed'),
    ]);

    const result = await runEval(workspacePath, 'run-1');
    const summary = JSON.parse(result.stdout);

    expect(result.code).toBe(0);
    expect(summary).toMatchObject({
      ok: true,
      runId: 'run-1',
      errors: [],
      stats: {
        events: 8,
        nodes: 1,
      },
    });
  });

  it('returns deterministic failure for an invalid event order', async () => {
    await writeTrace(workspacePath, 'run-1', [
      event('workflow.started'),
      event('node.ready', 'node-a'),
      event('node.running', 'node-a'),
      event('node.output_saved', 'node-a'),
      event('node.produces_validated', 'node-a'),
      event('workflow.completed'),
    ]);

    const result = await runEval(workspacePath, 'run-1');
    const summary = JSON.parse(result.stdout);

    expect(result.code).toBe(1);
    expect(summary.ok).toBe(false);
    expect(summary.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'artifact-validation-before-output-save',
          ok: false,
        }),
      ])
    );
  });

  it('returns input error for a missing trace file', async () => {
    const result = await runEval(workspacePath, 'missing-run');
    const summary = JSON.parse(result.stderr);

    expect(result.code).toBe(2);
    expect(summary.ok).toBe(false);
    expect(summary.errors[0]).toContain('no such file');
  });

  it('returns input error for invalid JSONL', async () => {
    const runDir = join(workspacePath, '.fluxion', 'runs');
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'run-1.trace.jsonl'), '{bad json}\n', 'utf8');

    const result = await runEval(workspacePath, 'run-1');
    const summary = JSON.parse(result.stderr);

    expect(result.code).toBe(2);
    expect(summary.ok).toBe(false);
    expect(summary.errors[0]).toContain('Invalid JSON on trace line 1');
  });
});
