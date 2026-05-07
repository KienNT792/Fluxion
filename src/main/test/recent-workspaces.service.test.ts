import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { RecentWorkspacesService } from '../services/recent-workspaces.service';

describe('RecentWorkspacesService', () => {
  let tempDir: string | null = null;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  async function createService(): Promise<RecentWorkspacesService> {
    tempDir = await mkdtemp(join(tmpdir(), 'fluxion-recent-'));
    return new RecentWorkspacesService(join(tempDir, 'recent-workspaces.json'));
  }

  it('removes a recent workspace by normalized path', async () => {
    const service = await createService();
    const workspacePath = join(tempDir!, 'Project');

    await service.recordWorkspaceOpened(workspacePath);
    await service.recordWorkspaceOpened(join(tempDir!, 'Other'));

    const recentWorkspaces = await service.removeRecentWorkspace(workspacePath.toUpperCase());

    expect(recentWorkspaces.map((entry) => entry.path)).toEqual([join(tempDir!, 'Other')]);
  });

  it('preserves unrelated recent workspaces', async () => {
    const service = await createService();
    const firstPath = join(tempDir!, 'First');
    const secondPath = join(tempDir!, 'Second');
    const thirdPath = join(tempDir!, 'Third');

    await service.recordWorkspaceOpened(firstPath);
    await service.recordWorkspaceOpened(secondPath);
    await service.recordWorkspaceOpened(thirdPath);

    const recentWorkspaces = await service.removeRecentWorkspace(secondPath);

    expect(recentWorkspaces.map((entry) => entry.path)).toEqual([thirdPath, firstPath]);
  });

  it('returns the current capped recent workspace list after removal', async () => {
    const service = await createService();
    const workspacePaths = Array.from({ length: 6 }, (_, index) =>
      join(tempDir!, `Project-${index + 1}`)
    );

    for (const workspacePath of workspacePaths) {
      await service.recordWorkspaceOpened(workspacePath);
    }

    const cappedBeforeRemove = await service.listRecentWorkspaces();
    const recentWorkspaces = await service.removeRecentWorkspace(workspacePaths[0]!);

    expect(cappedBeforeRemove).toHaveLength(5);
    expect(recentWorkspaces).toHaveLength(5);
    expect(recentWorkspaces.map((entry) => entry.path)).toEqual(
      cappedBeforeRemove.map((entry) => entry.path)
    );

    const rawDocument = JSON.parse(
      await readFile(join(tempDir!, 'recent-workspaces.json'), 'utf-8')
    );
    expect(rawDocument.recentWorkspaces).toHaveLength(5);
    expect(typeof rawDocument.updatedAt).toBe('string');
  });
});
