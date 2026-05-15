import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FlowContextDocument } from '@core'
import { FlowContextStore } from '../services/flow-context-store'

describe('FlowContextStore', () => {
  let workspacePath: string
  let store: FlowContextStore

  beforeEach(async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-flow-context-'))
    store = new FlowContextStore()
  })

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true })
  })

  it('initializes and reads a run-local flow context document', async () => {
    const context = await store.initializeRunContext({
      workspacePath,
      runId: 'run-1',
      workflowId: 'workflow-1',
      flowContextId: 'run-1',
      createdAt: '2026-05-15T00:00:00.000Z'
    })

    expect(context).toMatchObject({
      schemaVersion: 1,
      runId: 'run-1',
      flowContextId: 'run-1',
      workflowId: 'workflow-1',
      version: 1,
      createdAt: '2026-05-15T00:00:00.000Z',
      updatedAt: '2026-05-15T00:00:00.000Z',
      latestSnapshot: {
        runStateRef: '.fluxion/runs/run-1.json',
        semanticSummary: ''
      },
      deltas: []
    })

    const persisted = JSON.parse(
      await readFile(store.getContextPath(workspacePath, 'run-1'), 'utf8')
    ) as FlowContextDocument
    expect(persisted.latestSnapshot.runStateRef).toBe('.fluxion/runs/run-1.json')

    const reloaded = await store.readRunContext(workspacePath, 'run-1')
    expect(reloaded).toEqual(context)
  })

  it('returns an existing valid context document without overwriting it', async () => {
    const initial = await store.initializeRunContext({
      workspacePath,
      runId: 'run-1',
      workflowId: 'workflow-1',
      flowContextId: 'run-1',
      createdAt: '2026-05-15T00:00:00.000Z'
    })

    const updatedDocument: FlowContextDocument = {
      ...initial,
      version: 2,
      updatedAt: '2026-05-15T00:01:00.000Z',
      latestSnapshot: {
        ...initial.latestSnapshot,
        semanticSummary: 'Node A completed'
      }
    }
    await writeFile(
      store.getContextPath(workspacePath, 'run-1'),
      `${JSON.stringify(updatedDocument, null, 2)}\n`,
      'utf8'
    )

    const reinitialized = await store.initializeRunContext({
      workspacePath,
      runId: 'run-1',
      workflowId: 'workflow-1',
      flowContextId: 'run-1',
      createdAt: '2026-05-15T00:02:00.000Z'
    })

    expect(reinitialized.version).toBe(2)
    expect(reinitialized.latestSnapshot.semanticSummary).toBe('Node A completed')
  })

  it('rejects invalid JSON and schema-invalid context documents', async () => {
    await mkdir(join(workspacePath, '.fluxion', 'runs'), { recursive: true })
    await writeFile(join(workspacePath, '.fluxion', 'runs', 'bad-json.context.json'), '{', 'utf8')
    await writeFile(
      join(workspacePath, '.fluxion', 'runs', 'bad-schema.context.json'),
      `${JSON.stringify({
        schemaVersion: 1,
        flowContextId: 'run-2',
        runId: 'run-2',
        workflowId: 'workflow-1',
        version: 0,
        createdAt: '2026-05-15T00:00:00.000Z',
        updatedAt: '2026-05-15T00:00:00.000Z',
        latestSnapshot: {
          memorySourceRefs: [],
          artifactRefs: [],
          runStateRef: '.fluxion/runs/run-2.json',
          providerState: {},
          semanticSummary: ''
        },
        deltas: []
      })}\n`,
      'utf8'
    )

    await expect(store.readRunContext(workspacePath, 'bad-json')).rejects.toThrow()
    await expect(store.readRunContext(workspacePath, 'bad-schema')).rejects.toThrow()
  })

  it('fails initialization when an existing context file is corrupted', async () => {
    await mkdir(join(workspacePath, '.fluxion', 'runs'), { recursive: true })
    await writeFile(join(workspacePath, '.fluxion', 'runs', 'run-1.context.json'), '{', 'utf8')

    await expect(
      store.initializeRunContext({
        workspacePath,
        runId: 'run-1',
        workflowId: 'workflow-1',
        flowContextId: 'run-1'
      })
    ).rejects.toThrow()
  })
})
