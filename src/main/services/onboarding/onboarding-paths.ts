import * as path from 'path'
export { assertWorkspaceBound } from '../workspace-boundary'

export function normalizeWorkspacePath(workspacePath: string): string {
  return path.resolve(workspacePath)
}

export function normalizeOnboardingRelativePath(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || path.isAbsolute(trimmed)) {
    return null
  }
  const slashNormalized = trimmed.replaceAll('\\', '/')
  if (
    slashNormalized === '..' ||
    slashNormalized.startsWith('../') ||
    slashNormalized.includes('/../')
  ) {
    return null
  }

  const normalized = path
    .normalize(slashNormalized)
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  if (
    !normalized ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.includes('/../')
  ) {
    return null
  }

  return normalized
}

export function shouldSkipOnboardingPath(relativePath: string): boolean {
  const normalized = relativePath.toLowerCase().replaceAll('\\', '/')
  const segments = normalized.split('/').filter(Boolean)
  const name = segments[segments.length - 1] ?? normalized

  return (
    name === '.env' ||
    name.startsWith('.env.') ||
    normalized.includes('secret') ||
    normalized.includes('credential') ||
    normalized.includes('private-key') ||
    normalized.endsWith('.pem') ||
    normalized.endsWith('.key') ||
    normalized.endsWith('id_rsa') ||
    segments.includes('vendor') ||
    segments.includes('node_modules') ||
    segments.includes('dist') ||
    segments.includes('build') ||
    segments.includes('coverage')
  )
}
