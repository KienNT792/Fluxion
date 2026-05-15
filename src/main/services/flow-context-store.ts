import * as fs from 'fs/promises'
import * as path from 'path'
import { FlowContextDocument, FlowContextDocumentSchema } from '@core'

export interface InitializeRunContextOptions {
  workspacePath: string
  runId: string
  workflowId: string
  flowContextId: string
  createdAt?: string
}

type WriteOperation<T> = () => Promise<T>

function nowIso(): string {
  return new Date().toISOString()
}

function runStateRef(runId: string): string {
  return `.fluxion/runs/${runId}.json`
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

export class FlowContextStore {
  private readonly writeQueues = new Map<string, Promise<unknown>>()

  public getContextPath(workspacePath: string, runId: string): string {
    return path.join(workspacePath, '.fluxion', 'runs', `${runId}.context.json`)
  }

  public async initializeRunContext(
    options: InitializeRunContextOptions
  ): Promise<FlowContextDocument> {
    try {
      const existing = await this.readRunContext(options.workspacePath, options.runId)
      if (
        existing.runId !== options.runId ||
        existing.flowContextId !== options.flowContextId ||
        existing.workflowId !== options.workflowId
      ) {
        throw new Error(
          `Flow context file for run ${options.runId} does not match the requested run identity.`
        )
      }
      return existing
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error
      }
    }

    const createdAt = options.createdAt ?? nowIso()
    const document = FlowContextDocumentSchema.parse({
      schemaVersion: 1,
      flowContextId: options.flowContextId,
      runId: options.runId,
      workflowId: options.workflowId,
      version: 1,
      createdAt,
      updatedAt: createdAt,
      latestSnapshot: {
        memorySourceRefs: [],
        artifactRefs: [],
        runStateRef: runStateRef(options.runId),
        providerState: {},
        semanticSummary: ''
      },
      deltas: []
    })

    return this.writeRunContext(options.workspacePath, document)
  }

  public async readRunContext(workspacePath: string, runId: string): Promise<FlowContextDocument> {
    const contextPath = this.getContextPath(workspacePath, runId)
    const content = await fs.readFile(contextPath, 'utf8')
    return structuredClone(
      FlowContextDocumentSchema.parse(JSON.parse(content) as unknown)
    ) as FlowContextDocument
  }

  private async writeDocument(contextPath: string, document: FlowContextDocument): Promise<void> {
    const directory = path.dirname(contextPath)
    const tempPath = `${contextPath}.tmp`
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(tempPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')

    try {
      await fs.rename(tempPath, contextPath)
    } catch {
      await fs.rm(contextPath, { force: true })
      await fs.rename(tempPath, contextPath)
    }
  }

  private enqueue<T>(contextPath: string, operation: WriteOperation<T>): Promise<T> {
    const queueKey = path.resolve(contextPath)
    const previous = this.writeQueues.get(queueKey) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(operation)
    this.writeQueues.set(
      queueKey,
      next.catch(() => undefined)
    )
    return next
  }

  private async writeRunContext(
    workspacePath: string,
    document: FlowContextDocument
  ): Promise<FlowContextDocument> {
    const parsed = FlowContextDocumentSchema.parse(document)
    const contextPath = this.getContextPath(workspacePath, parsed.runId)

    return this.enqueue(contextPath, async () => {
      await this.writeDocument(contextPath, parsed)
      return structuredClone(parsed) as FlowContextDocument
    })
  }
}

export const flowContextStore = new FlowContextStore()
