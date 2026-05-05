import { execFile } from 'child_process';
import { access } from 'fs/promises';
import { dirname, extname, join } from 'path';

export const CODEX_CLI_NOT_FOUND_MESSAGE =
  'Codex CLI not found. Install @openai/codex and run codex login.';

export interface ResolvedCodexCli {
  command: string;
  argsPrefix: string[];
  displayCommand: string;
  source: 'direct' | 'node-script' | 'cmd-shim';
}

function runWhereCodex(): Promise<string[]> {
  return new Promise((resolve) => {
    execFile(
      'where.exe',
      ['codex'],
      { encoding: 'utf8', windowsHide: true },
      (error, stdout) => {
        if (error) {
          resolve([]);
          return;
        }

        resolve(
          stdout
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
        );
      }
    );
  });
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveNodeScriptForShim(shimPath: string): Promise<ResolvedCodexCli | null> {
  const baseDirectory = dirname(shimPath);
  const scriptPath = join(baseDirectory, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');

  if (!(await pathExists(scriptPath))) {
    return null;
  }

  const localNodePath = join(baseDirectory, 'node.exe');
  const nodeCommand = (await pathExists(localNodePath)) ? localNodePath : 'node';

  return {
    command: nodeCommand,
    argsPrefix: [scriptPath],
    displayCommand: `${nodeCommand} ${scriptPath}`,
    source: 'node-script',
  };
}

function createCmdShimCandidate(cmdPath: string): ResolvedCodexCli {
  return {
    command: process.env.ComSpec || 'cmd.exe',
    argsPrefix: ['/d', '/c', 'call', cmdPath],
    displayCommand: `cmd.exe /d /c call ${cmdPath}`,
    source: 'cmd-shim',
  };
}

function isCmdShim(candidate: string): boolean {
  const extension = extname(candidate).toLowerCase();
  return extension === '.cmd' || extension === '.bat';
}

function isExecutable(candidate: string): boolean {
  return extname(candidate).toLowerCase() === '.exe';
}

export async function resolveCodexCliCandidates(): Promise<ResolvedCodexCli[]> {
  if (process.platform !== 'win32') {
    return [
      {
        command: 'codex',
        argsPrefix: [],
        displayCommand: 'codex',
        source: 'direct',
      },
    ];
  }

  const candidates = await runWhereCodex();
  const directCandidates: ResolvedCodexCli[] = [];
  const nodeScriptCandidates: ResolvedCodexCli[] = [];
  const cmdShimCandidates: ResolvedCodexCli[] = [];

  for (const candidate of candidates) {
    if (isExecutable(candidate)) {
      directCandidates.push({
        command: candidate,
        argsPrefix: [],
        displayCommand: candidate,
        source: 'direct',
      });
      continue;
    }

    const nodeScriptCandidate = await resolveNodeScriptForShim(candidate);
    if (nodeScriptCandidate) {
      nodeScriptCandidates.push(nodeScriptCandidate);
    }

    if (isCmdShim(candidate)) {
      cmdShimCandidates.push(createCmdShimCandidate(candidate));
    }
  }

  const resolvedCandidates = [
    ...directCandidates,
    ...nodeScriptCandidates,
    ...cmdShimCandidates,
  ];

  if (resolvedCandidates.length === 0) {
    throw new Error(CODEX_CLI_NOT_FOUND_MESSAGE);
  }

  return resolvedCandidates;
}

