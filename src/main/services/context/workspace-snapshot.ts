import type { Dirent } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_MAX_ENTRIES = 8000;
const DEFAULT_MAX_TEXT_BYTES = 256 * 1024;

const IGNORED_DIRECTORY_NAMES = new Set([
  '.cache',
  '.fluxion',
  '.git',
  '.gradle',
  '.idea',
  '.next',
  '.nuxt',
  '.pytest_cache',
  '.ruff_cache',
  '.svn',
  '.turbo',
  '.venv',
  '.vscode',
  '__pycache__',
  'bin',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'obj',
  'out',
  'target',
  'vendor',
]);

export interface WorkspaceSnapshotFile {
  relativePath: string;
  name: string;
  extension: string;
  size: number;
}

export interface WorkspaceSnapshotDirectory {
  relativePath: string;
  name: string;
}

export interface WorkspaceSnapshot {
  rootPath: string;
  files: WorkspaceSnapshotFile[];
  directories: WorkspaceSnapshotDirectory[];
  truncated: boolean;
  hasFile(relativePath: string): boolean;
  hasDirectory(relativePath: string): boolean;
  findFiles(predicate: (file: WorkspaceSnapshotFile) => boolean): WorkspaceSnapshotFile[];
  findDirectories(predicate: (directory: WorkspaceSnapshotDirectory) => boolean): WorkspaceSnapshotDirectory[];
  readText(relativePath: string, maxBytes?: number): Promise<string | null>;
}

interface MutableSnapshot {
  files: WorkspaceSnapshotFile[];
  directories: WorkspaceSnapshotDirectory[];
  truncated: boolean;
}

function toPosixPath(value: string): string {
  return value.replaceAll('\\', '/');
}

function normalizeRelativePath(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function shouldIgnoreDirectory(name: string): boolean {
  return IGNORED_DIRECTORY_NAMES.has(name);
}

async function walkDirectory(
  rootPath: string,
  currentPath: string,
  currentDepth: number,
  state: MutableSnapshot
): Promise<void> {
  if (state.truncated || currentDepth > DEFAULT_MAX_DEPTH) {
    return;
  }

  let entries: Dirent[];
  try {
    entries = await fs.readdir(currentPath, { withFileTypes: true });
  } catch {
    return;
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (state.files.length + state.directories.length >= DEFAULT_MAX_ENTRIES) {
      state.truncated = true;
      return;
    }

    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = toPosixPath(path.relative(rootPath, absolutePath));

    if (entry.isDirectory()) {
      if (shouldIgnoreDirectory(entry.name)) {
        continue;
      }

      state.directories.push({
        relativePath,
        name: entry.name,
      });
      await walkDirectory(rootPath, absolutePath, currentDepth + 1, state);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    let size = 0;
    try {
      size = (await fs.stat(absolutePath)).size;
    } catch {
      size = 0;
    }

    state.files.push({
      relativePath,
      name: entry.name,
      extension: path.extname(entry.name).toLowerCase(),
      size,
    });
  }
}

export async function createWorkspaceSnapshot(workspacePath: string): Promise<WorkspaceSnapshot> {
  const rootPath = path.resolve(workspacePath);
  const state: MutableSnapshot = {
    files: [],
    directories: [],
    truncated: false,
  };

  await walkDirectory(rootPath, rootPath, 1, state);

  const filePaths = new Set(state.files.map((file) => file.relativePath.toLowerCase()));
  const directoryPaths = new Set(
    state.directories.map((directory) => directory.relativePath.toLowerCase())
  );

  return {
    rootPath,
    files: state.files,
    directories: state.directories,
    truncated: state.truncated,
    hasFile(relativePath: string): boolean {
      return filePaths.has(normalizeRelativePath(relativePath).toLowerCase());
    },
    hasDirectory(relativePath: string): boolean {
      return directoryPaths.has(normalizeRelativePath(relativePath).toLowerCase());
    },
    findFiles(predicate: (file: WorkspaceSnapshotFile) => boolean): WorkspaceSnapshotFile[] {
      return state.files.filter(predicate);
    },
    findDirectories(
      predicate: (directory: WorkspaceSnapshotDirectory) => boolean
    ): WorkspaceSnapshotDirectory[] {
      return state.directories.filter(predicate);
    },
    async readText(relativePath: string, maxBytes = DEFAULT_MAX_TEXT_BYTES): Promise<string | null> {
      const normalizedPath = normalizeRelativePath(relativePath);
      const matchingFile = state.files.find(
        (file) => file.relativePath.toLowerCase() === normalizedPath.toLowerCase()
      );
      if (!matchingFile) {
        return null;
      }

      try {
        const fileHandle = await fs.open(path.join(rootPath, matchingFile.relativePath), 'r');
        try {
          const bytesToRead = Math.min(matchingFile.size, maxBytes);
          const buffer = Buffer.alloc(bytesToRead);
          const { bytesRead } = await fileHandle.read(buffer, 0, bytesToRead, 0);
          return buffer.subarray(0, bytesRead).toString('utf8');
        } finally {
          await fileHandle.close();
        }
      } catch {
        return null;
      }
    },
  };
}
