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
  SummaryMemoryIndexEntry,
  SaveNodeOutputParams
} from '../../shared/memory.types'
import { CompiledContextDiagnostics, CompiledContextSourceBreakdown } from '../../shared/workflow.types'

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

  private estimateTokens(content: string): number {
    if (!content) {
      return 0
    }

    return Math.max(1, Math.ceil(Buffer.byteLength(content, 'utf8') / 4))
  }

  private buildDiagnostics(
    compiledContext: string,
    sources: MemoryContextSource[],
    options: {
      model?: string
      modelContextWindow?: number
      autoCompactTokenLimit?: number
      previousNodeIds?: NodeId[]
      staleAttemptNodeIds?: NodeId[]
      includesExternalContext?: boolean
      memoriesDisableOnExternalContext?: boolean
      contextHash?: string
    } = {}
  ): CompiledContextDiagnostics {
    const aggregated = new Map<CompiledContextSourceBreakdown['id'], CompiledContextSourceBreakdown>()

    const ensureBucket = (
      id: CompiledContextSourceBreakdown['id'],
      label: string
    ): CompiledContextSourceBreakdown => {
      const existing = aggregated.get(id)
      if (existing) {
        return existing
      }

      const created: CompiledContextSourceBreakdown = {
        id,
        label,
        bytes: 0,
        estimatedTokens: 0
      }
      aggregated.set(id, created)
      return created
    }

    for (const source of sources) {
      if (!source.included) {
        continue
      }

      const bytes = source.bytes ?? 0
      const estimatedTokens = Math.max(1, Math.ceil(bytes / 4))
      if (source.type === 'global') {
        const bucket = ensureBucket('global-context', 'Global context')
        bucket.bytes += bytes
        bucket.estimatedTokens += estimatedTokens
        continue
      }

      if (source.type === 'short-term') {
        const bucket = ensureBucket('short-term-memory', 'Short-term memory')
        bucket.bytes += bytes
        bucket.estimatedTokens += estimatedTokens
        continue
      }

      if (source.type === 'long-term') {
        const bucket = ensureBucket('long-term-memory', 'Long-term memory')
        bucket.bytes += bytes
        bucket.estimatedTokens += estimatedTokens
        continue
      }

      const bucket = ensureBucket('other', 'Other')
      bucket.bytes += bytes
      bucket.estimatedTokens += estimatedTokens
    }

    const totalBytes = Buffer.byteLength(compiledContext, 'utf8')
    const totalTokens = this.estimateTokens(compiledContext)

    const pressure =
      typeof options.modelContextWindow === 'number' && options.modelContextWindow > 0
        ? totalTokens >= options.modelContextWindow
          ? 'over-limit'
          : totalTokens >= Math.floor(options.modelContextWindow * 0.8)
            ? 'high'
            : totalTokens >= Math.floor(options.modelContextWindow * 0.5)
              ? 'medium'
              : 'low'
        : totalTokens > 32000
          ? 'high'
          : totalTokens > 12000
            ? 'medium'
            : 'low'

    const warnings: string[] = []
    const staleAttemptNodeIds = [...new Set(options.staleAttemptNodeIds ?? [])]
    const compactCandidateSourceIds = [...aggregated.values()]
      .filter((bucket) => bucket.id === 'short-term-memory' || bucket.id === 'long-term-memory')
      .sort((a, b) => b.estimatedTokens - a.estimatedTokens)
      .map((bucket) => bucket.id)
    let compactSuggested = false
    let compactReason: string | undefined
    let compactPriority: CompiledContextDiagnostics['compactPriority'] = 'none'
    if (typeof options.autoCompactTokenLimit === 'number' && totalTokens >= options.autoCompactTokenLimit) {
      warnings.push('Compiled context is above the configured auto-compaction threshold.')
      compactSuggested = compactCandidateSourceIds.length > 0
      compactPriority = compactCandidateSourceIds.length > 0 ? 'high' : 'medium'
      compactReason =
        compactCandidateSourceIds.length > 0
          ? 'Short-term or long-term memory is large enough that a semantic compaction pass should be considered before reruns.'
          : 'Context is above the configured auto-compaction threshold.'
    }
    if (pressure === 'high' || pressure === 'over-limit') {
      warnings.push('Compiled context is large enough that model pressure should be reviewed before reruns.')
      if (!compactSuggested) {
        compactSuggested = compactCandidateSourceIds.length > 0
        compactPriority = compactCandidateSourceIds.length > 0 ? 'high' : 'medium'
        compactReason =
          compactCandidateSourceIds.length > 0
            ? 'Context pressure is high enough that compacting memory-heavy sections would likely improve rerun efficiency.'
            : 'Context pressure is high enough that rerun inputs should be reduced.'
      } else if (compactPriority !== 'high') {
        compactPriority = 'high'
      }
    }
    if (staleAttemptNodeIds.length > 0) {
      warnings.push(
        `Context still includes upstream outputs from retried nodes: ${staleAttemptNodeIds.join(', ')}. Review whether downstream evidence is stale before reruns.`
      )
      if (!compactSuggested) {
        compactSuggested = true
        compactPriority = 'medium'
        compactReason =
          'Upstream retries are still represented in the compiled context. Compacting to a semantic summary can reduce stale carry-over risk before reruns.'
      } else if (compactPriority === 'none') {
        compactPriority = 'medium'
      }
    }
    if (options.includesExternalContext && options.memoriesDisableOnExternalContext) {
      warnings.push(
        'This context includes external inputs and the active Codex config disables memory generation for such threads.'
      )
    }

    const memoryGenerationEligible =
      options.includesExternalContext && options.memoriesDisableOnExternalContext ? false : true
    const memoryEligibilityReason = memoryGenerationEligible
      ? options.includesExternalContext
        ? 'External context is present, but the active Codex config still allows memory generation.'
        : 'No external context was detected, so this thread remains eligible for memory generation.'
      : 'External context is present and the active Codex config disables memory generation for such threads.'

    return {
      model: options.model,
      modelContextWindow: options.modelContextWindow,
      autoCompactTokenLimit: options.autoCompactTokenLimit,
      estimatedTotalBytes: totalBytes,
      estimatedTotalTokens: totalTokens,
      pressure,
      breakdown: [...aggregated.values()],
      contextHash: options.contextHash,
      previousNodeIds: options.previousNodeIds,
      staleSourceNodeIds: staleAttemptNodeIds,
      staleAttemptNodeIds,
      includesExternalContext: options.includesExternalContext,
      memoriesDisableOnExternalContext: options.memoriesDisableOnExternalContext,
      memoryGenerationEligible,
      memoryEligibilityReason,
      compactPriority,
      compactSuggested,
      compactReason,
      compactCandidateSourceIds:
        compactSuggested && compactCandidateSourceIds.length > 0
          ? compactCandidateSourceIds
          : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
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
    previousNodeIds: NodeId[],
    options: {
      model?: string
      modelContextWindow?: number
      autoCompactTokenLimit?: number
      staleAttemptNodeIds?: NodeId[]
      includesExternalContext?: boolean
      memoriesDisableOnExternalContext?: boolean
    } = {}
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
      context += `[LONG-TERM CONTEXT]\n${longTermIndex}\n`
      sources.push({
        ...this.createIncludedSource(workspacePath, 'long-term', longTermPath, longTermIndex),
        summaryKind: 'index'
      })

      const memoryIndex = await this.readMemoryIndex(workspacePath)
      const longTermSummaries = memoryIndex.entries.filter(
        (entry): entry is SummaryMemoryIndexEntry =>
          entry.type === 'summary' && entry.workflowId === workflowId
      )

      for (const summaryEntry of longTermSummaries) {
        const summaryPath = path.join(workspacePath, summaryEntry.sourcePath)
        try {
          const summaryContent = await fs.readFile(summaryPath, 'utf-8')
          context += `\n--- Summary from Run ${summaryEntry.runId} (${summaryEntry.sourceNodeIds.join(', ')}) ---\n`
          context += `${summaryContent}\n`
          sources.push({
            ...this.createIncludedSource(workspacePath, 'long-term', summaryPath, summaryContent),
            runId: summaryEntry.runId,
            sourceNodeIds: [...summaryEntry.sourceNodeIds],
            summaryKind: 'summary'
          })
        } catch (error) {
          console.warn(`Could not read long-term summary ${summaryEntry.sourcePath}`, error)
          sources.push({
            type: 'long-term',
            path: summaryEntry.sourcePath,
            included: false,
            warning: `Could not read long-term summary ${summaryEntry.sourcePath}.`
          })
        }
      }

      context += '\n'
    } catch {
      // It's ok if long-term index doesn't exist yet
      sources.push({
        type: 'long-term',
        path: this.toWorkspaceRelative(workspacePath, longTermPath),
        included: false,
        warning: 'Optional long-term context index was not found.'
      })
    }

    const contextHash = this.hashContent(context)

    return {
      compiledContext: context,
      sources,
      contextHash,
      contextBytes: Buffer.byteLength(context, 'utf8'),
      contextChars: context.length,
      previousNodeIds: [...previousNodeIds],
      diagnostics: this.buildDiagnostics(context, sources, options)
        ? this.buildDiagnostics(context, sources, {
            ...options,
            previousNodeIds,
            contextHash
          })
        : undefined
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

  public async compactWorkflowMemory(params: {
    workspacePath: string
    workflowId: string
    runId: string
    sourceNodeIds: NodeId[]
    summary: string
    createdAt: string
  }): Promise<{ summaryPath: string; indexEntry: SummaryMemoryIndexEntry }> {
    const existingIndex = await this.readMemoryIndex(params.workspacePath)
    const normalizedSourceNodeIds = [...params.sourceNodeIds].sort()
    const existingEntry = existingIndex.entries.find(
      (entry): entry is SummaryMemoryIndexEntry =>
        entry.type === 'summary' &&
        entry.workflowId === params.workflowId &&
        entry.runId === params.runId &&
        [...entry.sourceNodeIds].sort().join('|') === normalizedSourceNodeIds.join('|')
    )

    if (existingEntry) {
      return {
        summaryPath: path.join(params.workspacePath, existingEntry.sourcePath),
        indexEntry: existingEntry
      }
    }

    const longTermDir = path.join(params.workspacePath, '.fluxion', 'memory', 'long-term', params.workflowId)
    await fs.mkdir(longTermDir, { recursive: true })

    const summaryFilename = `${params.runId}-summary.md`
    const summaryPath = path.join(longTermDir, summaryFilename)
    const summaryBody = [
      '# Workflow Memory Summary',
      '',
      `Run: ${params.runId}`,
      `Nodes: ${params.sourceNodeIds.join(', ')}`,
      '',
      params.summary.trim()
    ].join('\n')
    await fs.writeFile(summaryPath, `${summaryBody}\n`, 'utf-8')

    const longTermIndexPath = path.join(params.workspacePath, '.fluxion', 'memory', 'long-term', 'index.md')
    const longTermIndexContent = [
      `- ${params.createdAt} | workflow ${params.workflowId} | run ${params.runId} | nodes ${params.sourceNodeIds.join(', ')} | ${this.toWorkspaceRelative(params.workspacePath, summaryPath)}`
    ]
    let existingLongTermIndex = ''
    try {
      existingLongTermIndex = await fs.readFile(longTermIndexPath, 'utf-8')
    } catch {
      existingLongTermIndex = ''
    }
    const mergedLongTermIndex = [longTermIndexContent[0], existingLongTermIndex.trim()].filter(Boolean).join('\n')
    await fs.mkdir(path.dirname(longTermIndexPath), { recursive: true })
    await fs.writeFile(longTermIndexPath, `${mergedLongTermIndex}\n`, 'utf-8')

    const replacedPaths = params.sourceNodeIds.map((nodeId) =>
      this.toWorkspaceRelative(
        params.workspacePath,
        this.getNodeOutputPath(params.workspacePath, params.workflowId, nodeId)
      )
    )
    const indexEntry: SummaryMemoryIndexEntry = {
      id: ['summary', params.workflowId, params.runId, params.createdAt].join(':'),
      type: 'summary',
      workflowId: params.workflowId,
      runId: params.runId,
      sourcePath: this.toWorkspaceRelative(params.workspacePath, summaryPath),
      createdAt: params.createdAt,
      sourceNodeIds: [...params.sourceNodeIds],
      replacedPaths
    }

    existingIndex.entries.push(indexEntry as MemoryIndexEntry)
    await this.writeMemoryIndex(params.workspacePath, existingIndex)

    return { summaryPath, indexEntry }
  }

  public buildSuggestedCompactSummary(params: {
    runId: string
    sourceNodeIds: NodeId[]
    diagnostics?: Pick<
      CompiledContextDiagnostics,
      | 'estimatedTotalTokens'
      | 'pressure'
      | 'compactPriority'
      | 'compactReason'
      | 'memoryEligibilityReason'
      | 'compactCandidateSourceIds'
      | 'previousNodeIds'
      | 'staleAttemptNodeIds'
      | 'includesExternalContext'
      | 'memoriesDisableOnExternalContext'
    >
  }): string {
    const lines = [
      '## Why this summary exists',
      params.diagnostics?.compactReason ??
        'Compiled context was flagged as a compaction candidate before reruns.',
      '',
      '## Covered nodes',
      params.sourceNodeIds.map((nodeId) => `- ${nodeId}`).join('\n'),
      '',
      '## Context signals',
      typeof params.diagnostics?.estimatedTotalTokens === 'number'
        ? `- Estimated tokens: ${params.diagnostics.estimatedTotalTokens}`
        : null,
      params.diagnostics?.pressure ? `- Pressure: ${params.diagnostics.pressure}` : null,
      params.diagnostics?.compactPriority
        ? `- Compact priority: ${params.diagnostics.compactPriority}`
        : null,
      params.diagnostics?.compactCandidateSourceIds?.length
        ? `- Memory-heavy sections: ${params.diagnostics.compactCandidateSourceIds.join(', ')}`
        : null,
      params.diagnostics?.staleAttemptNodeIds?.length
        ? `- Stale retry risk from: ${params.diagnostics.staleAttemptNodeIds.join(', ')}`
        : null,
      typeof params.diagnostics?.includesExternalContext === 'boolean'
        ? `- External context: ${params.diagnostics.includesExternalContext ? 'present' : 'not detected'}`
        : null,
      typeof params.diagnostics?.memoriesDisableOnExternalContext === 'boolean'
        ? `- Memory on external context: ${params.diagnostics.memoriesDisableOnExternalContext ? 'disabled' : 'allowed'}`
        : null,
      params.diagnostics?.memoryEligibilityReason
        ? `- Memory policy: ${params.diagnostics.memoryEligibilityReason}`
        : null,
      '',
      '## Reuse guidance',
      'Reuse this summary before re-injecting all raw upstream outputs during reruns or review retries.',
      'Preserve artifact references and only pull full node outputs back in when the summary is insufficient.'
    ].filter(Boolean)

    return lines.join('\n')
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

  public async getNodeAttemptHistory(
    workspacePath: string,
    workflowId: string,
    nodeId: NodeId
  ): Promise<number[]> {
    const index = await this.readMemoryIndex(workspacePath)

    return [...new Set(
      index.entries
        .filter(
          (entry): entry is Extract<MemoryIndexEntry, { type: 'raw_output' }> =>
            entry.type === 'raw_output' &&
            entry.workflowId === workflowId &&
            entry.nodeId === nodeId &&
            typeof entry.attempt === 'number' &&
            entry.attempt > 0
        )
        .map((entry) => entry.attempt as number)
    )].sort((a, b) => a - b)
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
