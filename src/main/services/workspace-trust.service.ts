import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'

interface TrustedWorkspacesDocument {
  trustedWorkspaces?: string[]
  updatedAt?: string
}

export function normalizeTrustedWorkspacePath(workspacePath: string): string {
  return path.resolve(workspacePath).replace(/\\/g, '/').trim().toLowerCase()
}

export class WorkspaceTrustService {
  private static instance: WorkspaceTrustService

  public constructor(private readonly trustFilePath?: string) {}

  public static getInstance(): WorkspaceTrustService {
    if (!WorkspaceTrustService.instance) {
      WorkspaceTrustService.instance = new WorkspaceTrustService()
    }

    return WorkspaceTrustService.instance
  }

  private getTrustFilePath(): string {
    return this.trustFilePath ?? path.join(app.getPath('userData'), 'trusted-workspaces.json')
  }

  private async readDocument(): Promise<TrustedWorkspacesDocument> {
    try {
      const rawContent = await fs.readFile(this.getTrustFilePath(), 'utf-8')
      const parsed = JSON.parse(rawContent) as TrustedWorkspacesDocument
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  private async writeDocument(document: TrustedWorkspacesDocument): Promise<void> {
    const filePath = this.getTrustFilePath()
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(document, null, 2), 'utf-8')
  }

  public async listTrustedWorkspaces(): Promise<string[]> {
    const document = await this.readDocument()
    return Array.isArray(document.trustedWorkspaces)
      ? document.trustedWorkspaces.filter((entry): entry is string => typeof entry === 'string')
      : []
  }

  public async isWorkspaceTrusted(workspacePath: string): Promise<boolean> {
    const normalizedPath = normalizeTrustedWorkspacePath(workspacePath)
    const trustedWorkspaces = await this.listTrustedWorkspaces()
    return trustedWorkspaces.includes(normalizedPath)
  }

  public async markWorkspaceAsTrusted(workspacePath: string): Promise<void> {
    await this.migrateTrustedWorkspaces([workspacePath])
  }

  public async migrateTrustedWorkspaces(workspacePaths: string[]): Promise<void> {
    const existing = await this.listTrustedWorkspaces()
    const trustedWorkspaces = new Set(existing)

    for (const workspacePath of workspacePaths) {
      if (typeof workspacePath !== 'string' || workspacePath.trim().length === 0) {
        continue
      }

      trustedWorkspaces.add(normalizeTrustedWorkspacePath(workspacePath))
    }

    await this.writeDocument({
      trustedWorkspaces: [...trustedWorkspaces],
      updatedAt: new Date().toISOString()
    })
  }
}

export const workspaceTrustService = WorkspaceTrustService.getInstance()
