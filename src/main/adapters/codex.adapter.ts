import { BaseAdapter } from './base.adapter';
import { NodeId, AgentNodeData, AgentChunk, AgentResult, AbortReason } from '@shared';
import { processManager } from '../services/process-manager';
import { execSync } from 'child_process';

// ─── Codex JSONL Event Types ────────────────────────────────────────────────

/**
 * Codex CLI `--json` emits one JSON object per line (JSONL).
 * We only care about a subset of event types for streaming to the UI.
 */
interface CodexEvent {
  type: string;
  [key: string]: unknown;
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export class CodexAdapter extends BaseAdapter {
  private nodeProcesses: Map<NodeId, number> = new Map();
  private abortReasons: Map<NodeId, AbortReason> = new Map();

  /**
   * Checks if the `codex` CLI is installed and reachable from PATH.
   * Call this once at startup or before first execution.
   */
  public static checkRequirements(): { available: boolean; version?: string; error?: string } {
    try {
      const output = execSync('codex --version', {
        timeout: 5000,
        windowsHide: true,
        encoding: 'utf-8',
      }).trim();
      return { available: true, version: output };
    } catch {
      return {
        available: false,
        error:
          'Codex CLI is not installed or not found in PATH. ' +
          'Install it with: npm install -g @openai/codex',
      };
    }
  }

  public async *execute(
    nodeId: NodeId,
    nodeData: AgentNodeData,
    prompt: string,
    workspacePath: string
  ): AsyncGenerator<AgentChunk, AgentResult, void> {
    this.activeExecutions.add(nodeId);
    this.abortReasons.delete(nodeId);

    // ── Build command args ──────────────────────────────────────────────────
    // V1 Slice: hardcoded safe defaults per user requirement.
    // Future: these will be configurable via Execution Mode UI.
    const args = [
      'exec',
      '--json',
      '--ask-for-approval', 'never',
      '--sandbox', 'workspace-write',
      '--cd', workspacePath,
    ];

    // Pass the model selected in the UI (e.g. 'o4-mini', 'claude-3-5-sonnet')
    if (nodeData.model && nodeData.model !== 'mock-agent') {
      args.push('--model', nodeData.model);
    }

    // Spawn the codex process
    const child = processManager.spawnProcess(nodeId, 'codex', args, {
      cwd: workspacePath,
      env: { ...process.env },
      // We pipe stdin so we can write the prompt and close it
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (child.pid) {
      this.nodeProcesses.set(nodeId, child.pid);
    }

    yield this.createChunk('status', `Started Codex CLI (PID: ${child.pid})`);

    // ── Write prompt to stdin and close ─────────────────────────────────────
    // `codex exec` reads from stdin when no positional PROMPT arg is given.
    // This avoids shell escaping issues with complex multi-line prompts.
    if (child.stdin) {
      child.stdin.write(prompt, 'utf-8');
      child.stdin.end();
    }

    // ── Event-driven chunk queue ────────────────────────────────────────────
    const chunkQueue: AgentChunk[] = [];
    let resolveNext: (() => void) | null = null;
    let isFinished = false;
    let exitCode: number | null = null;
    let errorMessage = '';
    let lineBuffer = '';

    const pushChunk = (type: AgentChunk['type'], content: string): void => {
      chunkQueue.push(this.createChunk(type, content));
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
    };

    /**
     * Parse a single JSONL line from Codex and convert to AgentChunk.
     * Codex emits various event types; we map them to stdout/stderr/status.
     */
    const parseJsonlLine = (line: string): void => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const event: CodexEvent = JSON.parse(trimmed);
        
        switch (event.type) {
          // Agent message chunks (the actual AI output)
          case 'message': {
            const content = typeof event.content === 'string' ? event.content : '';
            if (content) pushChunk('stdout', content);
            break;
          }

          // Tool/command execution events  
          case 'function_call':
          case 'function_call_output': {
            const name = typeof event.name === 'string' ? event.name : 'tool';
            const output = typeof event.output === 'string'
              ? event.output
              : typeof event.arguments === 'string'
                ? event.arguments
                : JSON.stringify(event);
            pushChunk('stdout', `[${name}] ${output}\n`);
            break;
          }

          // Status/lifecycle events
          case 'error': {
            const errContent = typeof event.message === 'string' ? event.message : JSON.stringify(event);
            pushChunk('stderr', errContent + '\n');
            break;
          }

          default: {
            // For any unrecognized event type, forward as status
            // This covers 'session.start', 'session.end', etc.
            if (typeof event.type === 'string') {
              pushChunk('status', `[${event.type}] ${JSON.stringify(event)}\n`);
            }
          }
        }
      } catch {
        // If it's not valid JSON, treat as raw stdout text
        pushChunk('stdout', trimmed + '\n');
      }
    };

    // ── Stdout handler: line-buffered JSONL parsing ─────────────────────────
    child.stdout?.on('data', (data: Buffer) => {
      lineBuffer += data.toString();
      const lines = lineBuffer.split('\n');
      // Keep last incomplete line in buffer
      lineBuffer = lines.pop() ?? '';
      for (const line of lines) {
        parseJsonlLine(line);
      }
    });

    // ── Stderr: forward directly ────────────────────────────────────────────
    child.stderr?.on('data', (data: Buffer) => {
      pushChunk('stderr', data.toString());
    });

    child.on('error', (err: Error) => {
      errorMessage = err.message;
      isFinished = true;
      if (resolveNext) resolveNext();
    });

    child.on('exit', (code: number | null) => {
      // Flush any remaining content in line buffer
      if (lineBuffer.trim()) {
        parseJsonlLine(lineBuffer);
        lineBuffer = '';
      }
      exitCode = code;
      isFinished = true;
      if (resolveNext) resolveNext();
    });

    // ── Yield loop ──────────────────────────────────────────────────────────
    while (!isFinished || chunkQueue.length > 0) {
      if (chunkQueue.length > 0) {
        yield chunkQueue.shift()!;
      } else {
        await new Promise<void>((resolve) => {
          resolveNext = resolve;
        });
      }
    }

    this.activeExecutions.delete(nodeId);
    this.nodeProcesses.delete(nodeId);
    const abortReason = this.abortReasons.get(nodeId);

    return {
      success: exitCode === 0 && !abortReason && !errorMessage,
      exitCode: exitCode ?? undefined,
      error: errorMessage || undefined,
      abortReason,
    };
  }

  protected async onAbort(nodeId: NodeId, reason: AbortReason): Promise<void> {
    this.abortReasons.set(nodeId, reason);
    const pid = this.nodeProcesses.get(nodeId);
    if (pid) {
      await processManager.killProcessGracefully(pid);
    }
  }
}
