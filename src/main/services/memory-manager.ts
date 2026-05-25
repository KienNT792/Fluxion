import * as fs from 'fs/promises'
import * as path from 'path'
import { createHash } from 'crypto'
import matter from 'gray-matter'
import {
  formatZodError,
  GlobalMemoryFrontmatterSchema,
  MemoryIndexSchema,
  NodeMemoryFrontmatterSchema
} from '@core'
import type { NodeMemoryFrontmatter } from '@core'
import { NodeId } from '../../shared/workflow.types'
import {
  CompiledMemoryContext,
  MemoryIndex,
  MemoryIndexEntry,
  MemoryContextSource,
  SaveNodeOutputParams
} from '../../shared/memory.types'

export class MemoryManager {
  private static instance: MemoryManager

  private constructor() {
    // Singleton
  }

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager()
    }
    return MemoryManager.instance
  }

  /**
   * Initializes the tiered memory directories in the workspace.
   */
  public async initWorkspace(workspacePath: string): Promise<void> {
    const memoryDir = path.join(workspacePath, '.fluxion', 'memory')
    const shortTermDir = path.join(memoryDir, 'short-term')
    const longTermDir = path.join(memoryDir, 'long-term')
    const indexPath = this.getMemoryIndexPath(workspacePath)

    await fs.mkdir(shortTermDir, { recursive: true })
    await fs.mkdir(longTermDir, { recursive: true })

    // Initialize global-context.md if it doesn't exist
    const globalContextPath = path.join(memoryDir, 'global-context.md')
    try {
      await fs.access(globalContextPath)
    } catch {
      const defaultGlobalContext = matter.stringify(
        '# Global Workspace Rules\n\nAdd your system rules here.',
        { type: 'global', version: '1.0' }
      )
      await fs.writeFile(globalContextPath, defaultGlobalContext, 'utf-8')
    }

    try {
      await fs.access(indexPath)
    } catch {
      await this.writeMemoryIndex(workspacePath, this.createEmptyMemoryIndex())
    }
  }

  /**
   * Injects the context for a specific node execution.
   * Compiles Global Context + Short-term Context + Long-term Context.
   */
  public async compileContext(
    workspacePath: string,
    workflowId: string,
    previousNodeIds: NodeId[]
  ): Promise<string> {
    return (await this.compileContextWithSources(workspacePath, workflowId, previousNodeIds))
      .compiledContext
  }

  public async compileContextWithSources(
    workspacePath: string,
    workflowId: string,
    previousNodeIds: NodeId[]
  ): Promise<CompiledMemoryContext> {
    const memoryDir = path.join(workspacePath, '.fluxion', 'memory')
    let context = ''
    const sources: MemoryContextSource[] = []

    // 1. Read Global Context
    const globalPath = path.join(memoryDir, 'global-context.md')
    try {
      const globalContent = await fs.readFile(globalPath, 'utf-8')
      const parsedGlobal = matter(globalContent)
      const frontmatter = GlobalMemoryFrontmatterSchema.safeParse(parsedGlobal.data)
      if (!frontmatter.success) {
        const warning = `Invalid global context frontmatter: ${formatZodError(frontmatter.error)}`
        console.warn(warning)
        sources.push({
          type: 'global',
          path: this.toWorkspaceRelative(workspacePath, globalPath),
          included: false,
          warning
        })
      } else {
        const section = `[GLOBAL CONTEXT]\n${parsedGlobal.content}\n\n`
        context += section
        sources.push(
          this.createIncludedSource(workspacePath, 'global', globalPath, parsedGlobal.content)
        )
      }
    } catch (e) {
      console.warn('Could not read global context', e)
      sources.push({
        type: 'global',
        path: this.toWorkspaceRelative(workspacePath, globalPath),
        included: false,
        warning: 'Could not read global context.'
      })
    }

    // 2. Read Short-term Context from previous nodes
    if (previousNodeIds.length > 0) {
      context += `[SHORT-TERM CONTEXT]\n`
      for (const nodeId of previousNodeIds) {
        const nodePath = path.join(memoryDir, 'short-term', workflowId, `${nodeId}.md`)
        try {
          const nodeContent = await fs.readFile(nodePath, 'utf-8')
          const parsedNode = matter(nodeContent)
          const frontmatter = NodeMemoryFrontmatterSchema.safeParse(parsedNode.data)
          if (!frontmatter.success) {
            const warning = `Invalid short-term context frontmatter for node ${nodeId}: ${formatZodError(frontmatter.error)}`
            console.warn(warning)
            sources.push({
              type: 'short-term',
              path: this.toWorkspaceRelative(workspacePath, nodePath),
              included: false,
              nodeId,
              warning
            })
            continue
          }

          const source = this.getNodeSourceLabel(frontmatter.data)
          const runId =
            frontmatter.data.schemaVersion === '2.0' ? frontmatter.data.runId : undefined

          context += `--- Output from Node ${nodeId} (${source}) ---\n`
          context += `${parsedNode.content}\n\n`
          sources.push({
            ...this.createIncludedSource(workspacePath, 'short-term', nodePath, parsedNode.content),
            nodeId,
            runId
          })
        } catch (e) {
          console.warn(`Could not read short-term context for node ${nodeId}`, e)
          sources.push({
            type: 'short-term',
            path: this.toWorkspaceRelative(workspacePath, nodePath),
            included: false,
            nodeId,
            warning: `Could not read short-term context for node ${nodeId}.`
          })
        }
      }
    }

    // 3. Read Long-term Context (Summarized history)
    const longTermPath = path.join(memoryDir, 'long-term', 'index.md')
    try {
      const longTermIndex = await fs.readFile(longTermPath, 'utf-8')
      context += `[LONG-TERM CONTEXT]\n${longTermIndex}\n\n`
      sources.push(
        this.createIncludedSource(workspacePath, 'long-term', longTermPath, longTermIndex)
      )
    } catch {
      // It's ok if long-term index doesn't exist yet
      sources.push({
        type: 'long-term',
        path: this.toWorkspaceRelative(workspacePath, longTermPath),
        included: false,
        warning: 'Optional long-term context index was not found.'
      })
    }

    return {
      compiledContext: context,
      sources,
      contextHash: this.hashContent(context),
      contextBytes: Buffer.byteLength(context, 'utf8'),
      contextChars: context.length
    }
  }

  /**
   * Saves the output of a node execution to the short-term memory.
   */
  public async saveNodeOutput(
    workspacePath: string,
    workflowId: string,
    params: SaveNodeOutputParams
  ): Promise<string> {
    const memoryDir = this.getWorkflowShortTermDir(workspacePath, workflowId)

    // Ensure directory exists
    await fs.mkdir(memoryDir, { recursive: true })

    const frontmatter: Record<string, unknown> = {
      schemaVersion: '2.0',
      nodeId: params.nodeId,
      runId: params.runId,
      runner: params.runner,
      model: params.model,
      status: params.status,
      startedAt: params.startedAt,
      completedAt: params.completedAt
    }

    if (params.attempt !== undefined) {
      frontmatter.attempt = params.attempt
    }
    if (params.exitCode !== undefined) {
      frontmatter.exitCode = params.exitCode
    }
    if (params.runnerSessionId !== undefined) {
      frontmatter.runnerSessionId = params.runnerSessionId
    }
    if (params.provider !== undefined) {
      frontmatter.provider = params.provider
    }

    const mdContent = matter.stringify(params.content, frontmatter)

    const outputPath = path.join(memoryDir, `${params.nodeId}.md`)
    await fs.writeFile(outputPath, mdContent, 'utf-8')
    if (params.attempt !== undefined) {
      const historyPath = this.getNodeOutputHistoryPath(
        workspacePath,
        workflowId,
        params.runId,
        params.nodeId,
        params.attempt
      )
      await fs.mkdir(path.dirname(historyPath), { recursive: true })
      await fs.writeFile(historyPath, mdContent, 'utf-8')
    }
    await this.upsertNodeOutputMemoryIndex(workspacePath, workflowId, params, outputPath)
    return outputPath
  }

  public getNodeOutputPath(workspacePath: string, workflowId: string, nodeId: NodeId): string {
    return path.join(this.getWorkflowShortTermDir(workspacePath, workflowId), `${nodeId}.md`)
  }

  public getNodeOutputHistoryPath(
    workspacePath: string,
    workflowId: string,
    runId: string,
    nodeId: NodeId,
    attempt: number
  ): string {
    return path.join(
      this.getWorkflowShortTermDir(workspacePath, workflowId),
      '.history',
      runId,
      nodeId,
      `attempt-${attempt}.md`
    )
  }

  public async deleteNodeOutput(
    workspacePath: string,
    workflowId: string,
    nodeId: NodeId
  ): Promise<void> {
    const outputPath = this.getNodeOutputPath(workspacePath, workflowId, nodeId)
    await fs.rm(outputPath, { force: true })

    const outputRelativePath = this.toWorkspaceRelative(workspacePath, outputPath)
    const index = await this.readMemoryIndex(workspacePath)
    const nextEntries = index.entries.filter((entry) => {
      if (entry.type !== 'raw_output') {
        return true
      }

      if (entry.workflowId !== workflowId || entry.nodeId !== nodeId) {
        return true
      }

      return entry.sourcePath !== outputRelativePath && entry.latestSourcePath !== outputRelativePath
    })

    if (nextEntries.length !== index.entries.length) {
      await this.writeMemoryIndex(workspacePath, {
        ...index,
        entries: nextEntries
      })
    }
  }

  private getNodeSourceLabel(frontmatter: NodeMemoryFrontmatter): string {
    const runner = frontmatter.schemaVersion === '2.0' ? frontmatter.runner : ''
    const provider = frontmatter.provider ?? ''
    const model = frontmatter.model
    const owner = runner || provider || 'Unknown'

    return model ? `${owner} / ${model}` : owner
  }

  private getWorkflowShortTermDir(workspacePath: string, workflowId: string): string {
    return path.join(workspacePath, '.fluxion', 'memory', 'short-term', workflowId)
  }

  private getMemoryIndexPath(workspacePath: string): string {
    return path.join(workspacePath, '.fluxion', 'memory', 'index.json')
  }

  private createEmptyMemoryIndex(): MemoryIndex {
    return {
      schemaVersion: 1,
      entries: []
    }
  }

  private async readMemoryIndex(workspacePath: string): Promise<MemoryIndex> {
    const indexPath = this.getMemoryIndexPath(workspacePath)

    try {
      const raw = await fs.readFile(indexPath, 'utf-8')
      return MemoryIndexSchema.parse(JSON.parse(raw) as unknown)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.createEmptyMemoryIndex()
      }

      console.warn(
        `Could not parse memory index at ${indexPath}. Rebuilding from an empty index.`,
        error
      )
      return this.createEmptyMemoryIndex()
    }
  }

  private async writeMemoryIndex(workspacePath: string, index: MemoryIndex): Promise<void> {
    const indexPath = this.getMemoryIndexPath(workspacePath)
    await fs.mkdir(path.dirname(indexPath), { recursive: true })
    await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf-8')
  }

  private async upsertNodeOutputMemoryIndex(
    workspacePath: string,
    workflowId: string,
    params: SaveNodeOutputParams,
    outputPath: string
  ): Promise<void> {
    const index = await this.readMemoryIndex(workspacePath)
    const historyPath =
      params.attempt !== undefined
        ? this.getNodeOutputHistoryPath(
            workspacePath,
            workflowId,
            params.runId,
            params.nodeId,
            params.attempt
          )
        : undefined
    const entry = this.createRawOutputMemoryIndexEntry(
      workspacePath,
      workflowId,
      params,
      outputPath,
      historyPath
    )
    const existingIndex = index.entries.findIndex((candidate) => candidate.id === entry.id)

    if (existingIndex >= 0) {
      index.entries[existingIndex] = entry
    } else {
      index.entries.push(entry)
    }

    await this.writeMemoryIndex(workspacePath, index)
  }

  private createRawOutputMemoryIndexEntry(
    workspacePath: string,
    workflowId: string,
    params: SaveNodeOutputParams,
    outputPath: string,
    historyPath?: string
  ): MemoryIndexEntry {
    return {
      id: this.getRawOutputMemoryIndexEntryId(
        workflowId,
        params.runId,
        params.nodeId,
        params.attempt
      ),
      type: 'raw_output',
      workflowId,
      runId: params.runId,
      nodeId: params.nodeId,
      sourcePath: this.toWorkspaceRelative(workspacePath, historyPath ?? outputPath),
      latestSourcePath:
        historyPath !== undefined ? this.toWorkspaceRelative(workspacePath, outputPath) : undefined,
      createdAt: params.completedAt,
      attempt: params.attempt
    }
  }

  private getRawOutputMemoryIndexEntryId(
    workflowId: string,
    runId: string,
    nodeId: NodeId,
    attempt?: number
  ): string {
    return ['raw_output', workflowId, runId, nodeId, String(attempt ?? 0)].join(':')
  }

  private createIncludedSource(
    workspacePath: string,
    type: MemoryContextSource['type'],
    absolutePath: string,
    content: string
  ): MemoryContextSource {
    return {
      type,
      path: this.toWorkspaceRelative(workspacePath, absolutePath),
      included: true,
      bytes: Buffer.byteLength(content, 'utf8'),
      hash: this.hashContent(content)
    }
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex')
  }

  private toWorkspaceRelative(workspacePath: string, absolutePath: string): string {
    return path.relative(workspacePath, absolutePath).replaceAll(path.sep, '/')
  }
}

export const memoryManager = MemoryManager.getInstance()
