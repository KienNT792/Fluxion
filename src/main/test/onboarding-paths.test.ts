import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  assertWorkspaceBound,
  normalizeOnboardingRelativePath,
  shouldSkipOnboardingPath
} from '../services/onboarding/onboarding-paths'

describe('onboarding-paths', () => {
  it('normalizes safe relative paths and rejects traversal or absolute paths', () => {
    expect(normalizeOnboardingRelativePath('src\\main\\index.ts')).toBe('src/main/index.ts')
    expect(normalizeOnboardingRelativePath('./README.md')).toBe('README.md')
    expect(normalizeOnboardingRelativePath('../README.md')).toBeNull()
    expect(normalizeOnboardingRelativePath('src/../README.md')).toBeNull()
    expect(normalizeOnboardingRelativePath(join(process.cwd(), 'README.md'))).toBeNull()
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

  it('rejects write targets outside the workspace', () => {
    const workspacePath = join(process.cwd(), 'workspace')
    const insidePath = join(workspacePath, '.agents', 'skills', 'fluxion-onboarding', 'SKILL.md')
    const outsidePath = join(process.cwd(), 'outside', 'SKILL.md')

    expect(() => assertWorkspaceBound(workspacePath, insidePath)).not.toThrow()
    expect(() => assertWorkspaceBound(workspacePath, outsidePath)).toThrow(/outside the workspace/)
  })
})
