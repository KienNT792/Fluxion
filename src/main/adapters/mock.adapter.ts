import { BaseAdapter } from './base.adapter';
import { NodeId, AgentNodeData, AgentChunk, AgentResult, AbortReason } from '@shared';
import { processManager } from '../services/process-manager';

const MOCK_CLI_BOOTSTRAP = `
const prompt = process.argv.slice(1).join(' ');

if (prompt.includes('simulate_freeze')) {
  process.stdout.write('Simulating a frozen process... Will not exit.\\n');
  setInterval(() => {}, 10000);
} else {
  const lines = [
    'Initializing Mock Agent...',
    'Analyzing context...',
    'Generating code blocks...',
    '\`\`\`javascript',
    'function helloWorld() {',
    '  console.log("Hello from Mock CLI!");',
    '}',
    '\`\`\`',
    'Code generation complete.',
    'Verifying syntax...',
    'All checks passed.'
  ];

  let index = 0;

  const interval = setInterval(() => {
    if (index < lines.length) {
      process.stdout.write(lines[index] + '\\n');
      index += 1;
      return;
    }

    clearInterval(interval);
    process.exit(0);
  }, 100);
}
`

export class MockAdapter extends BaseAdapter {
  // Store PIDs associated with nodeIds to allow graceful abortion
  private nodeProcesses: Map<NodeId, number> = new Map();
  // Store the abort reason if an abort was requested
  private abortReasons: Map<NodeId, AbortReason> = new Map();

  public async *execute(nodeId: NodeId, _nodeData: AgentNodeData, prompt: string, workspacePath: string): AsyncGenerator<AgentChunk, AgentResult, void> {
    this.activeExecutions.add(nodeId)
    this.abortReasons.delete(nodeId)
    
    // Spawn process
    const child = processManager.spawnProcess(nodeId, process.execPath, ['-e', MOCK_CLI_BOOTSTRAP, prompt], {
      cwd: workspacePath,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1'
      }
    })

    if (child.pid) {
      this.nodeProcesses.set(nodeId, child.pid)
    }

    yield this.createChunk('status', `Started Mock CLI (PID: ${child.pid})`)

    // We use a queue and a resolver to convert events into an AsyncGenerator
    const chunkQueue: AgentChunk[] = []
    let resolveNext: (() => void) | null = null
    let isFinished = false
    let exitCode: number | null = null
    let errorMessage = ''

    const pushChunk = (type: AgentChunk['type'], content: string): void => {
      chunkQueue.push(this.createChunk(type, content))
      if (resolveNext) {
        resolveNext()
        resolveNext = null
      }
    }

    child.stdout?.on('data', (data) => pushChunk('stdout', data.toString()))
    child.stderr?.on('data', (data) => pushChunk('stderr', data.toString()))

    child.on('error', (err) => {
      errorMessage = err.message
      isFinished = true
      if (resolveNext) resolveNext()
    })

    child.on('exit', (code) => {
      exitCode = code
      isFinished = true
      if (resolveNext) resolveNext()
    })

    // Yield loop
    while (!isFinished || chunkQueue.length > 0) {
      if (chunkQueue.length > 0) {
        yield chunkQueue.shift()!
      } else {
        // Wait for next chunk or finish
        await new Promise<void>((resolve) => {
          resolveNext = resolve
        })
      }
    }

    this.activeExecutions.delete(nodeId)
    this.nodeProcesses.delete(nodeId)
    const abortReason = this.abortReasons.get(nodeId)

    return {
      success: exitCode === 0 && !abortReason && !errorMessage,
      exitCode: exitCode ?? undefined,
      error: errorMessage || undefined,
      abortReason: abortReason
    }
  }

  protected async onAbort(nodeId: NodeId, reason: AbortReason): Promise<void> {
    this.abortReasons.set(nodeId, reason)
    const pid = this.nodeProcesses.get(nodeId)
    if (pid) {
      // Gracefully kill the process tree via our ProcessManager
      await processManager.killProcessGracefully(pid)
    }
  }
}
