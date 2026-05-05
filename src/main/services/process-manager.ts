import { ChildProcess, execFile, spawn, SpawnOptions } from 'child_process';
import { platform } from 'os';

export interface ProcessRecord {
  pid: number;
  nodeId: string;
  process: ChildProcess;
  status: 'running' | 'stopping' | 'killed' | 'completed';
}

export class ProcessManager {
  private static instance: ProcessManager;
  private processes: Map<number, ProcessRecord> = new Map();
  private maxConcurrent: number = 5;

  private constructor() {
    // Singleton
  }

  public static getInstance(): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager();
    }
    return ProcessManager.instance;
  }

  public setMaxConcurrent(limit: number): void {
    this.maxConcurrent = limit;
  }

  public getActiveCount(): number {
    let count = 0;
    for (const record of this.processes.values()) {
      if (record.status === 'running') count++;
    }
    return count;
  }

  public spawnProcess(nodeId: string, command: string, args: string[], options: SpawnOptions): ChildProcess {
    if (this.getActiveCount() >= this.maxConcurrent) {
      throw new Error(`Process pool limit reached (${this.maxConcurrent}). Cannot spawn process for node ${nodeId}.`);
    }

    const child = spawn(command, args, { ...options, windowsHide: true });

    if (child.pid) {
      this.processes.set(child.pid, {
        pid: child.pid,
        nodeId,
        process: child,
        status: 'running',
      });

      child.on('exit', () => {
        const record = this.processes.get(child.pid!);
        if (record && record.status === 'running') {
          record.status = 'completed';
        }
      });
      
      child.on('error', () => {
        const record = this.processes.get(child.pid!);
        if (record && record.status === 'running') {
          record.status = 'completed'; // treated as done
        }
      });
    }

    return child;
  }

  public killProcessGracefully(pid: number, timeoutMs: number = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      const record = this.processes.get(pid);
      if (!record || record.status !== 'running') {
        resolve();
        return;
      }

      record.status = 'stopping';

      if (platform() === 'win32') {
        // Send a gentle taskkill first (without /F)
        execFile('taskkill', ['/pid', String(pid), '/T'], { windowsHide: true }, (err) => {
          if (!err) {
            record.status = 'killed';
            resolve();
            return;
          }

          // If gentle kill fails or doesn't exit within timeout, force kill
          setTimeout(() => {
            execFile(
              'taskkill',
              ['/pid', String(pid), '/T', '/F'],
              { windowsHide: true },
              (forceErr) => {
              if (forceErr) {
                console.error(`Failed to force kill process ${pid}`, forceErr);
                reject(forceErr);
              } else {
                record.status = 'killed';
                resolve();
              }
            });
          }, timeoutMs);
        });
      } else {
        // POSIX systems
        record.process.kill('SIGTERM');
        setTimeout(() => {
          try {
            // Check if process still running
            process.kill(pid, 0);
            record.process.kill('SIGKILL');
          } catch {
            // Process already dead
          }
          record.status = 'killed';
          resolve();
        }, timeoutMs);
      }
    });
  }

  public async killAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const pid of this.processes.keys()) {
      promises.push(this.killProcessGracefully(pid));
    }
    await Promise.all(promises);
    this.processes.clear();
  }
}

export const processManager = ProcessManager.getInstance();
