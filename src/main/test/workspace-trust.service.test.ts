import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  normalizeTrustedWorkspacePath,
  WorkspaceTrustService
} from '../services/workspace-trust.service'

describe('WorkspaceTrustService', () => {
  let tempDir: string | null = null

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
      tempDir = null
    }
  })

  async function createService(): Promise<WorkspaceTrustService> {
    tempDir = await mkdtemp(join(tmpdir(), 'fluxion-trust-'))
    return new WorkspaceTrustService(join(tempDir, 'trusted-workspaces.json'))
  }

  it('normalizes trusted workspace paths for stable comparisons', () => {
    expect(normalizeTrustedWorkspacePath('C:\\Workspace\\Project')).toBe(
      normalizeTrustedWorkspacePath('c:/workspace/project')
    )
  })

  it('dedupes trusted workspace paths', async () => {
    const service = await createService()
    const workspacePath = join(tempDir!, 'Project')

    await service.migrateTrustedWorkspaces([workspacePath, workspacePath.toUpperCase()])

    const trustedWorkspaces = await service.listTrustedWorkspaces()
    expect(trustedWorkspaces).toHaveLength(1)
    await expect(service.isWorkspaceTrusted(workspacePath)).resolves.toBe(true)
  })

  it('falls back to an empty trust list when the persisted JSON is corrupt', async () => {
    const service = await createService()
    await writeFile(join(tempDir!, 'trusted-workspaces.json'), '{not-json', 'utf-8')

    await expect(service.listTrustedWorkspaces()).resolves.toEqual([])
    await expect(service.isWorkspaceTrusted(join(tempDir!, 'Project'))).resolves.toBe(false)
  })

  it('persists trusted workspaces under the expected document shape', async () => {
    const service = await createService()
    const workspacePath = join(tempDir!, 'Project')

    await service.markWorkspaceAsTrusted(workspacePath)

    const rawDocument = JSON.parse(
      await readFile(join(tempDir!, 'trusted-workspaces.json'), 'utf-8')
    )
    expect(rawDocument.trustedWorkspaces).toEqual([normalizeTrustedWorkspacePath(workspacePath)])
    expect(typeof rawDocument.updatedAt).toBe('string')
  })
})
