import * as fs from 'fs/promises'
import * as path from 'path'
import matter from 'gray-matter'
import { normalizeOnboardingRelativePath, shouldSkipOnboardingPath } from './onboarding-paths'

export interface WorkspaceSkillAsset {
  id: string
  relativePath: string
  title: string
  description: string
}

export interface WorkspaceSkillLibrary {
  assets: WorkspaceSkillAsset[]
  warnings: string[]
}

interface SkillFrontmatter {
  name?: unknown
  description?: unknown
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function buildAsset(relativePath: string, content: string): WorkspaceSkillAsset | null {
  const parsed = matter(content)
  const frontmatter = parsed.data as SkillFrontmatter
  const id = isNonEmptyString(frontmatter.name)
    ? frontmatter.name.trim()
    : path.basename(path.dirname(relativePath))

  if (!id) {
    return null
  }

  const title = isNonEmptyString(frontmatter.name) ? frontmatter.name.trim() : id
  const description = isNonEmptyString(frontmatter.description)
    ? frontmatter.description.trim()
    : parsed.content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0)
        ?.slice(0, 120) ?? 'Workspace skill'

  return { id, relativePath, title, description }
}

async function walkSkills(
  rootPath: string,
  directoryPath: string,
  assets: WorkspaceSkillAsset[],
  warnings: string[]
): Promise<void> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true })

  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name)
    const relativePath = normalizeOnboardingRelativePath(path.relative(rootPath, absolutePath))
    if (!relativePath || shouldSkipOnboardingPath(relativePath)) {
      continue
    }

    if (entry.isDirectory()) {
      await walkSkills(rootPath, absolutePath, assets, warnings)
      continue
    }

    const normalized = relativePath.toLowerCase().replaceAll('\\', '/')
    if (!normalized.endsWith('skill.md') && !normalized.endsWith('prompt.md')) {
      continue
    }

    try {
      const content = await fs.readFile(absolutePath, 'utf8')
      const asset = buildAsset(relativePath, content)
      if (asset) {
        assets.push(asset)
      }
    } catch (error) {
      warnings.push(
        `Failed to read workspace skill asset ${relativePath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }
}

export async function discoverWorkspaceSkillLibrary(workspacePath: string): Promise<WorkspaceSkillLibrary> {
  const resolvedWorkspacePath = path.resolve(workspacePath)
  const assets: WorkspaceSkillAsset[] = []
  const warnings: string[] = []
  const roots = [
    path.join(resolvedWorkspacePath, '.agents', 'skills'),
    path.join(resolvedWorkspacePath, '.fluxion', 'skills'),
    path.join(resolvedWorkspacePath, '.github', 'codex', 'prompts')
  ]

  for (const root of roots) {
    try {
      const stats = await fs.stat(root)
      if (stats.isDirectory()) {
        await walkSkills(root, root, assets, warnings)
      }
    } catch {
      continue
    }
  }

  assets.sort((left, right) => left.id.localeCompare(right.id) || left.relativePath.localeCompare(right.relativePath))

  return { assets, warnings }
}

export function formatWorkspaceSkillLibrary(library: WorkspaceSkillLibrary): string {
  if (library.assets.length === 0) {
    return 'No workspace skill assets were detected.'
  }

  return library.assets
    .map((asset) => `- ${asset.id}: \`${asset.relativePath}\` - ${asset.description}`)
    .join('\n')
}
