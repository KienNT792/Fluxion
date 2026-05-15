import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { RecentWorkspaceEntry } from '@shared'

const MAX_RECENT_WORKSPACES = 5

interface RecentWorkspacesDocument {
  recentWorkspaces?: RecentWorkspaceEntry[]
  updatedAt?: string
}

function normalizeRecentWorkspacePath(workspacePath: string): string {
  return path.resolve(workspacePath).replace(/\\/g, '/').trim().toLowerCase()
}

function isRecentWorkspaceEntry(value: unknown): value is RecentWorkspaceEntry {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as RecentWorkspaceEntry
  return (
    typeof candidate.path === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.lastOpenedAt === 'string'
  )
}

export class RecentWorkspacesService {
  private static instance: RecentWorkspacesService

  public constructor(private readonly recentFilePath?: string) {}

  public static getInstance(): RecentWorkspacesService {
    if (!RecentWorkspacesService.instance) {
      RecentWorkspacesService.instance = new RecentWorkspacesService()
    }

    return RecentWorkspacesService.instance
  }

  private getRecentFilePath(): string {
    return this.recentFilePath ?? path.join(app.getPath('userData'), 'recent-workspaces.json')
  }

  private async readDocument(): Promise<RecentWorkspacesDocument> {
    try {
      const rawContent = await fs.readFile(this.getRecentFilePath(), 'utf-8')
      const parsed = JSON.parse(rawContent) as RecentWorkspacesDocument
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  private async writeDocument(document: RecentWorkspacesDocument): Promise<void> {
    const filePath = this.getRecentFilePath()
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(document, null, 2), 'utf-8')
  }

  public async listRecentWorkspaces(): Promise<RecentWorkspaceEntry[]> {
    const document = await this.readDocument()
    return Array.isArray(document.recentWorkspaces)
      ? document.recentWorkspaces.filter(isRecentWorkspaceEntry).slice(0, MAX_RECENT_WORKSPACES)
      : []
  }

  public async recordWorkspaceOpened(workspacePath: string): Promise<void> {
    const resolvedPath = path.resolve(workspacePath)
    const normalizedPath = normalizeRecentWorkspacePath(resolvedPath)
    const existing = await this.listRecentWorkspaces()
    const now = new Date().toISOString()
    const nextEntry: RecentWorkspaceEntry = {
      path: resolvedPath,
      name: path.basename(resolvedPath) || resolvedPath,
      lastOpenedAt: now
    }
    const nextEntries = [
      nextEntry,
      ...existing.filter((entry) => normalizeRecentWorkspacePath(entry.path) !== normalizedPath)
    ].slice(0, MAX_RECENT_WORKSPACES)

    await this.writeDocument({
      recentWorkspaces: nextEntries,
      updatedAt: now
    })
  }

  public async removeRecentWorkspace(workspacePath: string): Promise<RecentWorkspaceEntry[]> {
    const normalizedPath = normalizeRecentWorkspacePath(workspacePath)
    const existing = await this.listRecentWorkspaces()
    const nextEntries = existing.filter(
      (entry) => normalizeRecentWorkspacePath(entry.path) !== normalizedPath
    )

    await this.writeDocument({
      recentWorkspaces: nextEntries,
      updatedAt: new Date().toISOString()
    })

    return nextEntries
  }
}

export const recentWorkspacesService = RecentWorkspacesService.getInstance()
