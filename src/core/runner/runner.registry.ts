import {
  FluxionRunner,
  RunnerContext,
  RunnerEvent,
  RunnerResult,
} from './runner.types';

class ContractOnlyRunner implements FluxionRunner {
  public constructor(public readonly id: 'codex' | 'custom') {}

  public async *run(_ctx: RunnerContext): AsyncGenerator<RunnerEvent, RunnerResult, void> {
    throw new Error(`Runner "${this.id}" is declared but not implemented in P0.`);
  }

  public async abort(_runId: string, _nodeId: string): Promise<void> {
    // No process exists in P0. Real cleanup is implemented by concrete runners.
  }
}

export class RunnerRegistry {
  private readonly runners = new Map<string, FluxionRunner>();

  public constructor() {
    this.register(new ContractOnlyRunner('codex'));
  }

  public register(runner: FluxionRunner): void {
    this.runners.set(runner.id, runner);
  }

  public has(id: string): boolean {
    return this.runners.has(id) || id === 'custom';
  }

  public resolve(id: string): FluxionRunner {
    const runner = this.runners.get(id);
    if (runner) {
      return runner;
    }

    if (id === 'custom') {
      return new ContractOnlyRunner('custom');
    }

    throw new Error(`Runner "${id}" is not registered.`);
  }

  public listRunnerIds(): string[] {
    return [...this.runners.keys(), 'custom'];
  }
}
