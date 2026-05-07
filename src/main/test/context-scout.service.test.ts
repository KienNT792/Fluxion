import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { afterEach, describe, expect, it } from 'vitest';
import { scanWorkspaceContext } from '../services/context-scout.service';

describe('context-scout.service', () => {
  const workspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(workspaces.map((workspacePath) => rm(workspacePath, { recursive: true, force: true })));
  });

  it('classifies an empty workspace as blank', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-context-blank-'));
    workspaces.push(workspacePath);

    const result = await scanWorkspaceContext(workspacePath);

    expect(result.workspaceType).toBe('blank');
    expect(result.projectName).toBeTruthy();
    expect(result.scannedFiles).toEqual([]);
  });

  it('classifies a repository with package metadata as existing', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-context-existing-'));
    workspaces.push(workspacePath);
    await mkdir(join(workspacePath, 'src', 'main'), { recursive: true });
    await writeFile(
      join(workspacePath, 'package.json'),
      JSON.stringify({
        name: 'fluxion',
        description: 'Windows-first workflow app',
        scripts: {
          typecheck: 'tsc --noEmit',
          test: 'vitest run',
        },
        dependencies: {
          electron: '^39.0.0',
          react: '^19.0.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
          vite: '^7.0.0',
        },
      }),
      'utf8'
    );
    await writeFile(join(workspacePath, 'README.md'), '# Fluxion\n\nDesktop workflow orchestration.\n', 'utf8');

    const result = await scanWorkspaceContext(workspacePath);

    expect(result.workspaceType).toBe('existing');
    expect(result.detectedFields.projectGoal).toBe('Windows-first workflow app');
    expect(result.detectedFields.primaryStack).toEqual(
      expect.arrayContaining(['Electron', 'React', 'Vite'])
    );
    expect(result.detectedFields.importantPaths).toEqual(expect.arrayContaining(['src', 'src/main']));
  });

  it('classifies a repository with AGENTS.md as existing_with_instructions', async () => {
    const workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-context-instructions-'));
    workspaces.push(workspacePath);
    await writeFile(join(workspacePath, 'AGENTS.md'), '# Repo instructions', 'utf8');

    const result = await scanWorkspaceContext(workspacePath);

    expect(result.workspaceType).toBe('existing_with_instructions');
    expect(result.sourceEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'workspaceType',
          sourcePath: 'AGENTS.md',
          confidence: 'high',
        }),
      ])
    );
  });
});
