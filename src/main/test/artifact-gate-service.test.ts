import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ArtifactGateService } from '../services/artifact-gate-service';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('ArtifactGateService', () => {
  let workspacePath: string;
  let service: ArtifactGateService;

  beforeEach(async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-artifacts-'));
    service = new ArtifactGateService();
    await mkdir(join(workspacePath, 'docs'), { recursive: true });
  });

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true });
  });

  it('passes requires when the artifact exists', async () => {
    await writeFile(join(workspacePath, 'docs', 'input.md'), 'hello', 'utf8');

    await expect(
      service.validateRequires(workspacePath, [{ path: 'docs/input.md' }])
    ).resolves.toMatchObject({
      valid: true,
      artifactPaths: ['docs/input.md'],
    });
  });

  it('allows optional missing required artifacts', async () => {
    await expect(
      service.validateRequires(workspacePath, [{ path: 'docs/optional.md', required: false }])
    ).resolves.toMatchObject({
      valid: true,
      artifactPaths: [],
    });
  });

  it('fails requires when a mandatory artifact is missing', async () => {
    await expect(
      service.validateRequires(workspacePath, [{ path: 'docs/missing.md' }])
    ).resolves.toMatchObject({
      valid: false,
      error: 'Required artifact is missing: docs/missing.md',
    });
  });

  it('passes produces when a new artifact is created', async () => {
    const before = await service.snapshotProduces(workspacePath, [{ path: 'docs/output.md' }]);
    await writeFile(join(workspacePath, 'docs', 'output.md'), 'fresh output', 'utf8');

    await expect(
      service.validateProduces(workspacePath, [{ path: 'docs/output.md' }], before)
    ).resolves.toMatchObject({
      valid: true,
      artifactPaths: ['docs/output.md'],
    });
  });

  it('passes produces when an existing artifact is updated', async () => {
    const outputPath = join(workspacePath, 'docs', 'output.md');
    await writeFile(outputPath, 'old', 'utf8');
    const before = await service.snapshotProduces(workspacePath, [{ path: 'docs/output.md' }]);
    await delay(20);
    await writeFile(outputPath, 'new content', 'utf8');

    await expect(
      service.validateProduces(workspacePath, [{ path: 'docs/output.md' }], before)
    ).resolves.toMatchObject({
      valid: true,
      artifactPaths: ['docs/output.md'],
    });
  });

  it('fails produces when the artifact was not updated by the run', async () => {
    const outputPath = join(workspacePath, 'docs', 'output.md');
    await writeFile(outputPath, 'stale', 'utf8');
    const before = await service.snapshotProduces(workspacePath, [{ path: 'docs/output.md' }]);

    await expect(
      service.validateProduces(workspacePath, [{ path: 'docs/output.md' }], before)
    ).resolves.toMatchObject({
      valid: false,
      error: 'Expected artifact was not updated by this run: docs/output.md',
    });
  });

  it('rejects artifact paths that escape the workspace', async () => {
    await expect(
      service.validateRequires(workspacePath, [{ path: '../secret.md' }])
    ).rejects.toThrow('Invalid artifact path');
  });
});
