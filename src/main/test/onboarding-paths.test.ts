import { mkdir, mkdtemp, rm, symlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  assertWorkspaceBound,
  normalizeOnboardingRelativePath,
  shouldSkipOnboardingPath
} from '../services/onboarding/onboarding-paths'

describe('onboarding-paths', () => {
  const cleanupPaths: string[] = []

  async function createTempDir(prefix: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), prefix))
    cleanupPaths.push(dir)
    return dir
  }

  afterEach(async () => {
    await Promise.all(cleanupPaths.map((dir) => rm(dir, { recursive: true, force: true })))
    cleanupPaths.length = 0
  })

  it('normalizes safe relative paths and rejects traversal or absolute paths', () => {
    expect(normalizeOnboardingRelativePath('src\\main\\index.ts')).toBe('src/main/index.ts')
    expect(normalizeOnboardingRelativePath('./README.md')).toBe('README.md')
    expect(normalizeOnboardingRelativePath('../README.md')).toBeNull()
    expect(normalizeOnboardingRelativePath('src/../README.md')).toBeNull()
    expect(normalizeOnboardingRelativePath('src\\..\\README.md')).toBeNull()
    expect(normalizeOnboardingRelativePath(join(process.cwd(), 'README.md'))).toBeNull()
    if (process.platform === 'win32') {
      expect(normalizeOnboardingRelativePath('\\\\server\\share\\README.md')).toBeNull()
    }
  })

  it.each([
    '.env',
    '.env.local',
    'config/secret.json',
    'config/credentials.json',
    'certs/private-key.pem',
    'certs/server.key',
    'keys/id_rsa',
    'vendor/pkg/index.js',
    'node_modules/lib/index.js',
    'dist/app.js',
    'build/app.js',
    'coverage/report.json'
  ])('skips sensitive, generated, or vendor evidence path %s', (relativePath) => {
    expect(shouldSkipOnboardingPath(relativePath)).toBe(true)
  })

  it('rejects write targets outside the workspace', async () => {
    const workspacePath = await createTempDir('fluxion-onboarding-paths-workspace-')
    const outsidePath = await createTempDir('fluxion-onboarding-paths-outside-')
    const insidePath = join(workspacePath, '.agents', 'skills', 'fluxion-onboarding', 'SKILL.md')
    const directOutsidePath = join(outsidePath, 'SKILL.md')

    expect(() => assertWorkspaceBound(workspacePath, insidePath)).not.toThrow()
    expect(() => assertWorkspaceBound(workspacePath, directOutsidePath)).toThrow(
      /outside the workspace/
    )
  })

  it('rejects write targets that escape through a symlink or junction ancestor', async () => {
    const workspacePath = await createTempDir('fluxion-onboarding-paths-workspace-')
    const outsidePath = await createTempDir('fluxion-onboarding-paths-outside-')
    const linkPath = join(workspacePath, '.agents')
    await mkdir(outsidePath, { recursive: true })
    await symlink(outsidePath, linkPath, process.platform === 'win32' ? 'junction' : 'dir')

    const escapedSkillPath = join(linkPath, 'skills', 'fluxion-onboarding', 'SKILL.md')

    expect(() => assertWorkspaceBound(workspacePath, escapedSkillPath)).toThrow(
      /outside the workspace/
    )
  })
})
