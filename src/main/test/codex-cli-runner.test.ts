import { EventEmitter } from 'events';
import { ChildProcess, SpawnOptions } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PassThrough } from 'stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunnerContext, WorkflowNodeSchema } from '@core';
import {
  buildCodexExecArgs,
  CodexCliRunner,
  CodexProcessManager,
} from '../runners/codex-cli-runner';

class FakeChildProcess extends EventEmitter {
  public pid = 1234;
  public stdout = new PassThrough();
  public stderr = new PassThrough();
  public stdin = new PassThrough();
  public kill = vi.fn(() => true);

  public close(code: number | null = 0): void {
    this.emit('close', code, null);
  }
}

class FakeProcessManager implements CodexProcessManager {
  public readonly child = new FakeChildProcess();
  public readonly spawnCalls: Array<{
    nodeId: string;
    command: string;
    args: string[];
    options: SpawnOptions;
  }> = [];
  public readonly killCalls: number[] = [];
  public spawnError: unknown;

  public spawnProcess(
    nodeId: string,
    command: string,
    args: string[],
    options: SpawnOptions
  ): ChildProcess {
    if (this.spawnError) {
      throw this.spawnError;
    }

    this.spawnCalls.push({ nodeId, command, args, options });
    return this.child as unknown as ChildProcess;
  }

  public async killProcessGracefully(pid: number): Promise<void> {
    this.killCalls.push(pid);
  }
}

function createContext(overrides: Partial<RunnerContext> = {}): RunnerContext {
  const node = WorkflowNodeSchema.parse({
    id: 'node-a',
    type: 'agentNode',
    label: 'Node A',
    position: { x: 0, y: 0 },
    data: {
      provider: 'codex',
      model: 'gpt-5.5',
      runner: 'codex',
      prompt: 'Do the thing',
    },
  });

  return {
    runId: 'run-1',
    workflowId: 'workflow-1',
    workspacePath: 'D:\\workspace',
    prompt: 'Do the thing',
    node,
    ...overrides,
  };
}

function createRunner(processManager: FakeProcessManager, outputDirectory: string): CodexCliRunner {
  return new CodexCliRunner({
    processManager,
    outputDirectory,
    resolveCli: async () => ({
      command: 'node',
      argsPrefix: ['C:\\npm\\node_modules\\@openai\\codex\\bin\\codex.js'],
      displayCommand: 'node codex.js',
      source: 'node-script',
    }),
    modelSupportsReasoning: async () => false,
  });
}

describe('CodexCliRunner', () => {
  let outputDirectory: string;

  beforeEach(async () => {
    outputDirectory = await mkdtemp(join(tmpdir(), 'fluxion-codex-runner-'));
  });

  afterEach(async () => {
    await rm(outputDirectory, { recursive: true, force: true });
  });

  it('builds default codex exec args for non-interactive JSON mode', async () => {
    const args = await buildCodexExecArgs(createContext(), 'D:\\out\\last-message.md');

    expect(args).toEqual([
      'exec',
      '--json',
      '--cd',
      'D:\\workspace',
      '--model',
      'gpt-5.5',
      '--sandbox',
      'workspace-write',
      '--output-last-message',
      'D:\\out\\last-message.md',
      '--config',
      'approval_policy=never',
      '-',
    ]);
  });

  it('maps explicit sandbox, approval, Windows sandbox, profile, and custom config', async () => {
    const ctx = createContext({
      node: WorkflowNodeSchema.parse({
        ...createContext().node,
        data: {
          ...createContext().node.data,
          codex: {
            ...createContext().node.data.codex,
            sandboxMode: 'read-only',
            approvalPolicy: 'on-request',
            windowsSandbox: 'unelevated',
            profile: 'fluxion',
            config: {
              'model_verbosity': 'high',
              'analytics.enabled': false,
            },
          },
        },
      }),
    });

    const args = await buildCodexExecArgs(ctx, 'D:\\out\\last-message.md');

    expect(args).toContain('--sandbox');
    expect(args[args.indexOf('--sandbox') + 1]).toBe('read-only');
    expect(args).toContain('--profile');
    expect(args[args.indexOf('--profile') + 1]).toBe('fluxion');
    expect(args).toContain('approval_policy=on-request');
    expect(args).toContain('windows.sandbox=unelevated');
    expect(args).toContain('analytics.enabled=false');
    expect(args).toContain('model_verbosity="high"');
  });

  it('injects model_reasoning_effort only for supported models and does not override explicit config', async () => {
    const ctx = createContext({
      node: WorkflowNodeSchema.parse({
        ...createContext().node,
        data: {
          ...createContext().node.data,
          reasoningLevel: 'high',
        },
      }),
    });

    const args = await buildCodexExecArgs(ctx, 'D:\\out\\last-message.md', {
      modelSupportsReasoning: async () => true,
    });

    expect(args).toContain('model_reasoning_effort="high"');

    const explicitArgs = await buildCodexExecArgs(
      {
        ...ctx,
        node: WorkflowNodeSchema.parse({
          ...ctx.node,
          data: {
            ...ctx.node.data,
            codex: {
              ...ctx.node.data.codex,
              config: {
                model_reasoning_effort: 'low',
              },
            },
          },
        }),
      },
      'D:\\out\\last-message.md',
      {
        modelSupportsReasoning: async () => true,
      }
    );

    expect(explicitArgs).toContain('model_reasoning_effort="low"');
    expect(explicitArgs).not.toContain('model_reasoning_effort="high"');
  });

  it('passes prompt through stdin instead of command args', async () => {
    const processManager = new FakeProcessManager();
    const runner = createRunner(processManager, outputDirectory);
    const ctx = createContext({ prompt: 'Prompt with spaces && Windows chars' });
    let stdin = '';
    processManager.child.stdin.on('data', (chunk) => {
      stdin += chunk.toString();
    });

    const iterator = runner.run(ctx);
    const firstEvent = await iterator.next();

    expect(firstEvent.value).toMatchObject({ type: 'status' });
    expect(stdin).toBe(ctx.prompt);
    expect(processManager.spawnCalls[0].args).not.toContain(ctx.prompt);

    processManager.child.close(0);
    await iterator.next();
  });

  it('parses NDJSON stdout into json-event events and falls back for invalid lines', async () => {
    const processManager = new FakeProcessManager();
    const runner = createRunner(processManager, outputDirectory);
    const iterator = runner.run(createContext());

    await iterator.next();
    processManager.child.stdout.write('{"type":"started"}\n{"type":"delta"');

    const firstJsonEvent = await iterator.next();
    expect(firstJsonEvent.value).toMatchObject({
      type: 'json-event',
      event: { type: 'started' },
    });

    processManager.child.stdout.write(',"value":1}\nnot-json\n');

    const secondJsonEvent = await iterator.next();
    expect(secondJsonEvent.value).toMatchObject({
      type: 'json-event',
      event: { type: 'delta', value: 1 },
    });

    const fallbackEvent = await iterator.next();
    expect(fallbackEvent.value).toMatchObject({
      type: 'stdout',
      content: 'not-json\n',
    });

    processManager.child.close(0);
    const done = await iterator.next();
    expect(done.done).toBe(true);
    expect(done.value).toMatchObject({ success: true, output: 'not-json\n' });
  });

  it('captures final assistant output from --output-last-message without echoing it to stdout', async () => {
    const processManager = new FakeProcessManager();
    const runner = createRunner(processManager, outputDirectory);
    const iterator = runner.run(createContext());

    await iterator.next();
    const args = processManager.spawnCalls[0].args;
    const outputPath = args[args.indexOf('--output-last-message') + 1];
    await writeFile(outputPath, 'Final assistant answer', 'utf8');

    processManager.child.close(0);

    const done = await iterator.next();
    expect(done.done).toBe(true);
    expect(done.value).toMatchObject({
      success: true,
      output: 'Final assistant answer',
      exitCode: 0,
    });
  });

  it('returns a clear missing CLI error when spawn fails with ENOENT', async () => {
    const processManager = new FakeProcessManager();
    processManager.spawnError = Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });
    const runner = createRunner(processManager, outputDirectory);
    const iterator = runner.run(createContext());

    const errorEvent = await iterator.next();
    expect(errorEvent.value).toMatchObject({
      type: 'stderr',
      content: expect.stringContaining('Codex CLI not found'),
    });

    const done = await iterator.next();
    expect(done.done).toBe(true);
    expect(done.value).toMatchObject({
      success: false,
      exitCode: 127,
    });
  });

  it('aborts by killing the tracked process tree', async () => {
    const processManager = new FakeProcessManager();
    const runner = createRunner(processManager, outputDirectory);
    const ctx = createContext();
    const iterator = runner.run(ctx);

    await iterator.next();
    await runner.abort(ctx.runId, ctx.node.id);

    expect(processManager.killCalls).toEqual([processManager.child.pid]);

    processManager.child.close(1);
    const done = await iterator.next();
    expect(done.done).toBe(true);
    expect(done.value).toMatchObject({
      success: false,
      error: 'Codex CLI execution was aborted.',
      exitCode: 1,
    });
  });
});
