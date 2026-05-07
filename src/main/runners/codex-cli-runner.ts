import { ChildProcess, SpawnOptions } from 'child_process';
import { mkdir, readFile, rm } from 'fs/promises';
import { isAbsolute, join } from 'path';
import {
  CodexExecutionOptionsSchema,
  FluxionRunner,
  RunnerContext,
  RunnerEvent,
  RunnerResult,
} from '@core';
import { processManager } from '../services/process-manager';
import {
  CODEX_CLI_NOT_FOUND_MESSAGE,
  ResolvedCodexCli,
  resolveCodexCliCandidates,
} from './codex-cli-resolver';
import { providerRegistryService } from '../services/provider-registry.service';

interface RunnerEventQueueItem {
  event?: RunnerEvent;
  result?: RunnerResult;
  done: boolean;
}

class RunnerEventQueue {
  private readonly items: RunnerEventQueueItem[] = [];
  private waitingResolver: ((item: RunnerEventQueueItem) => void) | null = null;
  private closed = false;

  public push(event: RunnerEvent): void {
    if (this.closed) {
      return;
    }

    this.enqueue({ event, done: false });
  }

  public close(result: RunnerResult): void {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.enqueue({ result, done: true });
  }

  public next(): Promise<IteratorResult<RunnerEvent, RunnerResult>> {
    if (this.items.length > 0) {
      return Promise.resolve(this.toIteratorResult(this.items.shift()!));
    }

    return new Promise((resolve) => {
      this.waitingResolver = (item) => resolve(this.toIteratorResult(item));
    });
  }

  private enqueue(item: RunnerEventQueueItem): void {
    if (this.waitingResolver) {
      const resolver = this.waitingResolver;
      this.waitingResolver = null;
      resolver(item);
      return;
    }

    this.items.push(item);
  }

  private toIteratorResult(item: RunnerEventQueueItem): IteratorResult<RunnerEvent, RunnerResult> {
    if (item.done) {
      return {
        done: true,
        value: item.result ?? { success: false, error: 'Codex runner ended without a result.' },
      };
    }

    return {
      done: false,
      value: item.event!,
    };
  }
}

interface ActiveCodexProcess {
  child: ChildProcess;
  pid?: number;
  aborted: boolean;
}

export interface CodexProcessManager {
  spawnProcess(nodeId: string, command: string, args: string[], options: SpawnOptions): ChildProcess;
  killProcessGracefully(pid: number, timeoutMs?: number): Promise<void>;
}

export interface CodexCliRunnerOptions {
  processManager?: CodexProcessManager;
  resolveCli?: () => Promise<ResolvedCodexCli | ResolvedCodexCli[]>;
  outputDirectory?: string;
  modelSupportsReasoning?: (modelId: string) => Promise<boolean>;
}

export function encodeCodexConfigValue(value: string | number | boolean): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  return String(value);
}

async function modelSupportsReasoningEffort(modelId: string): Promise<boolean> {
  const capabilities = await providerRegistryService.fetchCapabilities();
  const model = capabilities.codex?.models.find((candidate) => candidate.id === modelId);
  return (model?.supportedReasoningLevels.length ?? 0) > 0;
}

export async function buildCodexExecArgs(
  ctx: RunnerContext,
  outputLastMessagePath: string,
  options: {
    modelSupportsReasoning?: (modelId: string) => Promise<boolean>;
  } = {}
): Promise<string[]> {
  const codexOptions = CodexExecutionOptionsSchema.parse(ctx.node.data.codex);
  const args = ['exec'];
  const model =
    typeof ctx.node.data.model === 'string' && ctx.node.data.model.trim().length > 0
      ? ctx.node.data.model.trim()
      : undefined;
  const configEntries = new Map(Object.entries(codexOptions.config ?? {}));

  if (codexOptions.json) {
    args.push('--json');
  }

  args.push('--cd', ctx.workspacePath);

  if (model) {
    args.push('--model', model);
  }

  args.push('--sandbox', codexOptions.sandboxMode);
  args.push('--output-last-message', outputLastMessagePath);

  if (codexOptions.profile) {
    args.push('--profile', codexOptions.profile);
  }

  args.push('--config', `approval_policy=${codexOptions.approvalPolicy}`);

  if (codexOptions.windowsSandbox) {
    args.push('--config', `windows.sandbox=${codexOptions.windowsSandbox}`);
  }

  if (
    model
    && typeof ctx.node.data.reasoningLevel === 'string'
    && !configEntries.has('model_reasoning_effort')
    && await (options.modelSupportsReasoning ?? modelSupportsReasoningEffort)(model)
  ) {
    configEntries.set('model_reasoning_effort', ctx.node.data.reasoningLevel);
  }

  for (const [key, value] of [...configEntries.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    args.push('--config', `${key}=${encodeCodexConfigValue(value)}`);
  }

  args.push('-');
  return args;
}

function createRunnerEvent(type: 'stdout' | 'stderr' | 'status', content: string): RunnerEvent {
  return {
    type,
    content,
    timestamp: Date.now(),
  };
}

function executionKey(runId: string, nodeId: string): string {
  return `${runId}:${nodeId}`;
}

function sanitizePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'node';
}

function getSpawnErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function shouldTryNextCandidate(error: unknown): boolean {
  const code = getSpawnErrorCode(error);
  return code === 'EPERM' || code === 'EACCES' || code === 'EINVAL' || code === 'ENOENT';
}

function mapSpawnError(error: unknown): string {
  const code = getSpawnErrorCode(error);
  if (code === 'ENOENT') {
    return CODEX_CLI_NOT_FOUND_MESSAGE;
  }

  if (error instanceof Error) {
    return `Failed to start Codex CLI: ${error.message}`;
  }

  return 'Failed to start Codex CLI.';
}

function mapCodexExitError(stderrOutput: string, fallbackStdout: string, exitDescription: string): string {
  const combinedOutput = [stderrOutput.trim(), fallbackStdout.trim()].filter(Boolean).join('\n');

  if (/(codex login|not authenticated|authentication|required login|please log in)/i.test(combinedOutput)) {
    return 'Codex CLI is not authenticated. Run "codex login" and try again.';
  }

  return combinedOutput || exitDescription;
}

function normalizeCliCandidates(
  candidateOrCandidates: ResolvedCodexCli | ResolvedCodexCli[]
): ResolvedCodexCli[] {
  return Array.isArray(candidateOrCandidates) ? candidateOrCandidates : [candidateOrCandidates];
}

export class CodexCliRunner implements FluxionRunner {
  public readonly id = 'codex';

  private readonly processManager: CodexProcessManager;
  private readonly resolveCli: () => Promise<ResolvedCodexCli | ResolvedCodexCli[]>;
  private readonly outputDirectory: string;
  private readonly supportsReasoningByModel?: (modelId: string) => Promise<boolean>;
  private readonly activeProcesses = new Map<string, ActiveCodexProcess>();

  public constructor(options: CodexCliRunnerOptions = {}) {
    this.processManager = options.processManager ?? processManager;
    this.resolveCli = options.resolveCli ?? resolveCodexCliCandidates;
    this.outputDirectory = options.outputDirectory ?? join('.fluxion', 'tmp', 'codex');
    this.supportsReasoningByModel = options.modelSupportsReasoning;
  }

  public async *run(ctx: RunnerContext): AsyncGenerator<RunnerEvent, RunnerResult, void> {
    const outputPath = await this.createOutputPath(ctx);
    const codexOptions = CodexExecutionOptionsSchema.parse(ctx.node.data.codex);
    const execArgs = await buildCodexExecArgs(ctx, outputPath, {
      modelSupportsReasoning: this.supportsReasoningByModel,
    });
    const cliCandidates = normalizeCliCandidates(await this.resolveCli());
    const queue = new RunnerEventQueue();
    const key = executionKey(ctx.runId, ctx.node.id);
    let child: ChildProcess | null = null;
    let selectedCli: ResolvedCodexCli | null = null;
    let lastSpawnError: unknown;

    for (const cliCandidate of cliCandidates) {
      try {
        child = this.processManager.spawnProcess(
          ctx.node.id,
          cliCandidate.command,
          [...cliCandidate.argsPrefix, ...execArgs],
          {
            cwd: ctx.workspacePath,
            env: {
              ...process.env,
              ...ctx.env,
            },
            stdio: ['pipe', 'pipe', 'pipe'],
          }
        );
        selectedCli = cliCandidate;
        break;
      } catch (error) {
        lastSpawnError = error;
        if (!shouldTryNextCandidate(error)) {
          break;
        }
      }
    }

    if (!child || !selectedCli) {
      const error = mapSpawnError(lastSpawnError);
      yield createRunnerEvent('stderr', `${error}\n`);
      return {
        success: false,
        error,
        exitCode: getSpawnErrorCode(lastSpawnError) === 'ENOENT' ? 127 : 1,
      };
    }

    this.activeProcesses.set(key, {
      child,
      pid: child.pid,
      aborted: false,
    });

    queue.push(createRunnerEvent('status', `Starting Codex CLI via ${selectedCli.displayCommand}.`));

    let fallbackStdout = '';
    let stderrOutput = '';
    let stdoutLineBuffer = '';

    const handleJsonLine = (line: string, forceTrailingNewline: boolean): void => {
      const normalizedLine = line.replace(/\r$/, '');
      if (normalizedLine.trim().length === 0) {
        return;
      }

      try {
        queue.push({
          type: 'json-event',
          event: JSON.parse(normalizedLine) as unknown,
          raw: normalizedLine,
          timestamp: Date.now(),
        });
      } catch {
        fallbackStdout += forceTrailingNewline ? `${normalizedLine}\n` : normalizedLine;
        queue.push(
          createRunnerEvent(
            'stdout',
            forceTrailingNewline ? `${normalizedLine}\n` : normalizedLine
          )
        );
      }
    };

    const handleStdoutChunk = (chunk: Buffer | string): void => {
      const content = chunk.toString();

      if (!codexOptions.json) {
        fallbackStdout += content;
        queue.push(createRunnerEvent('stdout', content));
        return;
      }

      stdoutLineBuffer += content;
      let newlineIndex = stdoutLineBuffer.search(/\r?\n/);

      while (newlineIndex >= 0) {
        const line = stdoutLineBuffer.slice(0, newlineIndex);
        const newlineMatch = stdoutLineBuffer.slice(newlineIndex).match(/^\r?\n/);
        stdoutLineBuffer = stdoutLineBuffer.slice(newlineIndex + (newlineMatch?.[0].length ?? 1));
        handleJsonLine(line, true);
        newlineIndex = stdoutLineBuffer.search(/\r?\n/);
      }
    };

    const finalize = async (result: RunnerResult): Promise<void> => {
      this.activeProcesses.delete(key);
      queue.close(result);
    };

    child.stdout?.on('data', handleStdoutChunk);
    child.stderr?.on('data', (chunk: Buffer | string) => {
      const content = chunk.toString();
      stderrOutput += content;
      queue.push(createRunnerEvent('stderr', content));
    });

    child.once('error', async (error) => {
      await finalize({
        success: false,
        error: mapSpawnError(error),
        exitCode: getSpawnErrorCode(error) === 'ENOENT' ? 127 : 1,
      });
    });

    child.once('close', async (code, signal) => {
      if (codexOptions.json && stdoutLineBuffer.length > 0) {
        handleJsonLine(stdoutLineBuffer, false);
        stdoutLineBuffer = '';
      }

      const activeProcess = this.activeProcesses.get(key);
      const aborted = activeProcess?.aborted ?? false;
      const output = await this.readOutput(outputPath);
      await this.cleanupOutput(outputPath);

      if (aborted) {
        await finalize({
          success: false,
          output,
          error: 'Codex CLI execution was aborted.',
          exitCode: typeof code === 'number' ? code : undefined,
        });
        return;
      }

      const fallbackOutput =
        output ?? (fallbackStdout.trim().length > 0 ? fallbackStdout : undefined);

      if (code === 0) {
        await finalize({
          success: true,
          output: fallbackOutput,
          exitCode: 0,
        });
        return;
      }

      const exitDescription =
        typeof code === 'number'
          ? `Codex CLI exited with code ${code}.`
          : `Codex CLI exited with signal ${signal ?? 'unknown'}.`;
      const error = mapCodexExitError(stderrOutput, fallbackStdout, exitDescription);

      await finalize({
        success: false,
        output: fallbackOutput,
        error,
        exitCode: typeof code === 'number' ? code : 1,
      });
    });

    child.stdin?.write(ctx.prompt);
    child.stdin?.end();

    while (true) {
      const next = await queue.next();
      if (next.done) {
        return next.value;
      }

      yield next.value;
    }
  }

  public async abort(runId: string, nodeId: string): Promise<void> {
    const activeProcess = this.activeProcesses.get(executionKey(runId, nodeId));
    if (!activeProcess) {
      return;
    }

    activeProcess.aborted = true;

    if (activeProcess.pid) {
      await this.processManager.killProcessGracefully(activeProcess.pid);
      return;
    }

    activeProcess.child.kill();
  }

  private async createOutputPath(ctx: RunnerContext): Promise<string> {
    const outputBaseDirectory = isAbsolute(this.outputDirectory)
      ? this.outputDirectory
      : join(ctx.workspacePath, this.outputDirectory);
    const outputDirectory = join(
      outputBaseDirectory,
      sanitizePathPart(ctx.runId),
      sanitizePathPart(ctx.node.id)
    );
    await mkdir(outputDirectory, { recursive: true });
    return join(outputDirectory, 'last-message.md');
  }

  private async readOutput(outputPath: string): Promise<string | undefined> {
    try {
      const output = await readFile(outputPath, 'utf8');
      return output.length > 0 ? output : undefined;
    } catch {
      return undefined;
    }
  }

  private async cleanupOutput(outputPath: string): Promise<void> {
    try {
      await rm(outputPath, { force: true });
    } catch {
      // Temporary output cleanup is best-effort.
    }
  }
}
