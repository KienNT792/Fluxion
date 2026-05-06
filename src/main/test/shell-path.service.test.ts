import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  openShellPath,
  revealShellPath,
  validateShellTargetPath,
} from '../services/shell-path.service';

let tempDir: string | undefined;

async function createTempFile(): Promise<string> {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'fluxion-shell-path-'));
  const filePath = path.join(tempDir, 'output.md');
  await writeFile(filePath, '# output', 'utf8');
  return filePath;
}

afterEach(async () => {
  if (tempDir) {
    const target = tempDir;
    tempDir = undefined;
    await rm(target, { recursive: true, force: true });
  }
});

describe('shell-path.service', () => {
  it('validates an existing absolute path', async () => {
    const filePath = await createTempFile();
    await expect(validateShellTargetPath(filePath)).resolves.toBe(filePath);
  });

  it('rejects empty, relative, and missing paths', async () => {
    await expect(validateShellTargetPath('')).rejects.toThrow('Path is required');
    await expect(validateShellTargetPath('relative\\file.md')).rejects.toThrow(
      'Path must be absolute'
    );
    const missingPath = path.join(os.tmpdir(), `missing-fluxion-file-${Date.now()}.md`);
    await expect(validateShellTargetPath(missingPath)).rejects.toThrow('Path does not exist');
  });

  it('opens a valid path through the shell adapter', async () => {
    const filePath = await createTempFile();
    const shellAdapter = {
      openPath: vi.fn(async () => ''),
      showItemInFolder: vi.fn(),
    };

    await openShellPath(shellAdapter, filePath);

    expect(shellAdapter.openPath).toHaveBeenCalledWith(filePath);
    expect(shellAdapter.showItemInFolder).not.toHaveBeenCalled();
  });

  it('reveals a valid path through the shell adapter', async () => {
    const filePath = await createTempFile();
    const shellAdapter = {
      openPath: vi.fn(async () => ''),
      showItemInFolder: vi.fn(),
    };

    await revealShellPath(shellAdapter, filePath);

    expect(shellAdapter.showItemInFolder).toHaveBeenCalledWith(filePath);
    expect(shellAdapter.openPath).not.toHaveBeenCalled();
  });

  it('returns shell open errors clearly', async () => {
    const filePath = await createTempFile();
    const shellAdapter = {
      openPath: vi.fn(async () => 'No app can open this file.'),
      showItemInFolder: vi.fn(),
    };

    await expect(openShellPath(shellAdapter, filePath)).rejects.toThrow(
      'No app can open this file.'
    );
  });
});
