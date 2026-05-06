import { access } from 'fs/promises';
import path from 'path';

export interface ShellPathAdapter {
  openPath: (targetPath: string) => Promise<string>;
  showItemInFolder: (targetPath: string) => void;
}

export async function validateShellTargetPath(pathValue: string): Promise<string> {
  if (typeof pathValue !== 'string' || !pathValue.trim()) {
    throw new Error('Path is required.');
  }

  const targetPath = pathValue.trim();
  if (!path.isAbsolute(targetPath)) {
    throw new Error(`Path must be absolute: ${targetPath}`);
  }

  try {
    await access(targetPath);
  } catch {
    throw new Error(`Path does not exist: ${targetPath}`);
  }

  return targetPath;
}

export async function openShellPath(
  shellAdapter: ShellPathAdapter,
  pathValue: string
): Promise<void> {
  const targetPath = await validateShellTargetPath(pathValue);
  const shellError = await shellAdapter.openPath(targetPath);

  if (shellError) {
    throw new Error(shellError);
  }
}

export async function revealShellPath(
  shellAdapter: ShellPathAdapter,
  pathValue: string
): Promise<void> {
  const targetPath = await validateShellTargetPath(pathValue);
  shellAdapter.showItemInFolder(targetPath);
}
