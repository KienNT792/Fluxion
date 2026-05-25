import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { MemoryIndexSchema } from '@core'
import matter from 'gray-matter'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryManager } from '../services/memory-manager'

describe('MemoryManager', () => {
  let workspacePath: string

  beforeEach(async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-memory-'))
    await memoryManager.initWorkspace(workspacePath)
  })

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true })
  })

  it('initializes an empty memory index file for the workspace', async () => {
    const indexPath = join(workspacePath, '.fluxion', 'memory', 'index.json')
    const parsed = MemoryIndexSchema.parse(JSON.parse(await readFile(indexPath, 'utf8')) as unknown)

    expect(parsed).toEqual({
      schemaVersion: 1,
      entries: []
    })
  })

  it('writes V2 frontmatter for completed node outputs', async () => {
    const outputPath = await memoryManager.saveNodeOutput(workspacePath, 'workflow-1', {
      runId: 'run-1',
      nodeId: 'node-a',
      runner: 'codex',
      model: 'gpt-5.5',
      status: 'completed',
      startedAt: '2026-05-06T00:00:00.000Z',
      completedAt: '2026-05-06T00:00:01.000Z',
      exitCode: 0,
      runnerSessionId: 'session-1',
      provider: 'openai',
      content: 'Final answer'
    })

    const parsed = matter(await readFile(outputPath, 'utf8'))
    expect(parsed.data).toMatchObject({
      schemaVersion: '2.0',
      nodeId: 'node-a',
      runId: 'run-1',
      runner: 'codex',
      model: 'gpt-5.5',
      status: 'completed',
      startedAt: '2026-05-06T00:00:00.000Z',
      completedAt: '2026-05-06T00:00:01.000Z',
      exitCode: 0,
      runnerSessionId: 'session-1',
      provider: 'openai'
    })
    expect(parsed.content.trimEnd()).toBe('Final answer')
  })

  it('writes attempt history while preserving the latest output path', async () => {
    const latestPath = await memoryManager.saveNodeOutput(workspacePath, 'workflow-1', {
      runId: 'run-1',
      nodeId: 'node-a',
      attempt: 1,
      runner: 'codex',
      model: 'gpt-5.5',
      status: 'completed',
      startedAt: '2026-05-06T00:00:00.000Z',
      completedAt: '2026-05-06T00:00:01.000Z',
      content: 'First attempt'
    })
    await memoryManager.saveNodeOutput(workspacePath, 'workflow-1', {
      runId: 'run-1',
      nodeId: 'node-a',
      attempt: 2,
      runner: 'codex',
      model: 'gpt-5.5',
      status: 'completed',
      startedAt: '2026-05-06T00:00:02.000Z',
      completedAt: '2026-05-06T00:00:03.000Z',
      content: 'Second attempt'
    })

    const attemptOnePath = join(
      workspacePath,
      '.fluxion',
      'memory',
      'short-term',
      'workflow-1',
      '.history',
      'run-1',
      'node-a',
      'attempt-1.md'
    )
    const attemptTwoPath = join(
      workspacePath,
      '.fluxion',
      'memory',
      'short-term',
      'workflow-1',
      '.history',
      'run-1',
      'node-a',
      'attempt-2.md'
    )

    expect(await readFile(latestPath, 'utf8')).toContain('Second attempt')
    expect(await readFile(attemptOnePath, 'utf8')).toContain('First attempt')
    expect(await readFile(attemptTwoPath, 'utf8')).toContain('Second attempt')
    expect(matter(await readFile(attemptTwoPath, 'utf8')).data).toMatchObject({ attempt: 2 })

    const indexPath = join(workspacePath, '.fluxion', 'memory', 'index.json')
    const index = MemoryIndexSchema.parse(JSON.parse(await readFile(indexPath, 'utf8')) as unknown)

    expect(index.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'raw_output:workflow-1:run-1:node-a:1',
          type: 'raw_output',
          workflowId: 'workflow-1',
          runId: 'run-1',
          nodeId: 'node-a',
          sourcePath: '.fluxion/memory/short-term/workflow-1/.history/run-1/node-a/attempt-1.md',
          latestSourcePath: '.fluxion/memory/short-term/workflow-1/node-a.md',
          createdAt: '2026-05-06T00:00:01.000Z',
          attempt: 1
        }),
        expect.objectContaining({
          id: 'raw_output:workflow-1:run-1:node-a:2',
          type: 'raw_output',
          workflowId: 'workflow-1',
          runId: 'run-1',
          nodeId: 'node-a',
          sourcePath: '.fluxion/memory/short-term/workflow-1/.history/run-1/node-a/attempt-2.md',
          latestSourcePath: '.fluxion/memory/short-term/workflow-1/node-a.md',
          createdAt: '2026-05-06T00:00:03.000Z',
          attempt: 2
        })
      ])
    )
  })

  it('removes latest output evidence from the memory index while preserving attempt history', async () => {
    const latestPath = await memoryManager.saveNodeOutput(workspacePath, 'workflow-1', {
      runId: 'run-1',
      nodeId: 'node-a',
      attempt: 1,
      runner: 'codex',
      model: 'gpt-5.5',
      status: 'completed',
      startedAt: '2026-05-06T00:00:00.000Z',
      completedAt: '2026-05-06T00:00:01.000Z',
      content: 'First attempt'
    })
    const attemptOnePath = join(
      workspacePath,
      '.fluxion',
      'memory',
      'short-term',
      'workflow-1',
      '.history',
      'run-1',
      'node-a',
      'attempt-1.md'
    )

    await memoryManager.deleteNodeOutput(workspacePath, 'workflow-1', 'node-a')

    await expect(readFile(latestPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(attemptOnePath, 'utf8')).toContain('First attempt')

    const indexPath = join(workspacePath, '.fluxion', 'memory', 'index.json')
    const index = MemoryIndexSchema.parse(JSON.parse(await readFile(indexPath, 'utf8')) as unknown)
    expect(index.entries).toEqual([])
  })

  it('compiles context from both V1 and V2 short-term memory files', async () => {
    const shortTermDir = join(workspacePath, '.fluxion', 'memory', 'short-term', 'workflow-2')
    await mkdir(shortTermDir, { recursive: true })
    const v1Content = matter.stringify('Legacy node output', {
      schemaVersion: '1.0',
      nodeId: 'node-v1',
      provider: 'openai',
      model: 'gpt-4.1',
      status: 'completed',
      timestamp: 123
    })
    await writeFile(join(shortTermDir, 'node-v1.md'), v1Content, 'utf8')

    await memoryManager.saveNodeOutput(workspacePath, 'workflow-2', {
      runId: 'run-2',
      nodeId: 'node-v2',
      runner: 'codex',
      model: 'gpt-5.5',
      status: 'completed',
      startedAt: '2026-05-06T00:00:00.000Z',
      completedAt: '2026-05-06T00:00:01.000Z',
      provider: 'openai',
      content: 'Modern node output'
    })

    const context = await memoryManager.compileContext(workspacePath, 'workflow-2', [
      'node-v1',
      'node-v2'
    ])

    expect(context).toContain('Output from Node node-v1 (openai / gpt-4.1)')
    expect(context).toContain('Legacy node output')
    expect(context).toContain('Output from Node node-v2 (codex / gpt-5.5)')
    expect(context).toContain('Modern node output')
  })

  it('reports context sources and a stable compiled context hash', async () => {
    await memoryManager.saveNodeOutput(workspacePath, 'workflow-3', {
      runId: 'run-3',
      nodeId: 'node-a',
      runner: 'codex',
      model: 'gpt-5.5',
      status: 'completed',
      startedAt: '2026-05-06T00:00:00.000Z',
      completedAt: '2026-05-06T00:00:01.000Z',
      content: 'Source output'
    })

    const report = await memoryManager.compileContextWithSources(workspacePath, 'workflow-3', [
      'node-a'
    ])
    const repeatReport = await memoryManager.compileContextWithSources(
      workspacePath,
      'workflow-3',
      ['node-a']
    )

    expect(report.compiledContext).toContain('Source output')
    expect(report.contextHash).toBe(repeatReport.contextHash)
    expect(report.contextBytes).toBe(Buffer.byteLength(report.compiledContext, 'utf8'))
    expect(report.contextChars).toBe(report.compiledContext.length)
    expect(report.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'global',
          path: '.fluxion/memory/global-context.md',
          included: true,
          bytes: expect.any(Number),
          hash: expect.any(String)
        }),
        expect.objectContaining({
          type: 'short-term',
          path: '.fluxion/memory/short-term/workflow-3/node-a.md',
          included: true,
          nodeId: 'node-a',
          runId: 'run-3',
          bytes: expect.any(Number),
          hash: expect.any(String)
        }),
        expect.objectContaining({
          type: 'long-term',
          path: '.fluxion/memory/long-term/index.md',
          included: false,
          warning: expect.any(String)
        })
      ])
    )
  })

  it('excludes global context when frontmatter is invalid', async () => {
    const globalPath = join(workspacePath, '.fluxion', 'memory', 'global-context.md')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await writeFile(globalPath, 'No frontmatter\n', 'utf8')

    try {
      const report = await memoryManager.compileContextWithSources(workspacePath, 'workflow-4', [])

      expect(report.compiledContext).not.toContain('No frontmatter')
      expect(report.sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'global',
            path: '.fluxion/memory/global-context.md',
            included: false,
            warning: expect.stringContaining('Invalid global context frontmatter')
          })
        ])
      )
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid global context frontmatter')
      )
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('excludes short-term context when node output frontmatter is invalid', async () => {
    const shortTermDir = join(workspacePath, '.fluxion', 'memory', 'short-term', 'workflow-4')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await mkdir(shortTermDir, { recursive: true })
    await writeFile(
      join(shortTermDir, 'node-a.md'),
      matter.stringify('Partial output must not be injected', {
        schemaVersion: '2.0',
        nodeId: 'node-a',
        runId: 'run-4',
        runner: 'codex',
        model: 'gpt-5.5',
        status: 'aborted',
        startedAt: '2026-05-06T00:00:00.000Z',
        completedAt: '2026-05-06T00:00:01.000Z'
      }),
      'utf8'
    )

    try {
      const report = await memoryManager.compileContextWithSources(workspacePath, 'workflow-4', [
        'node-a'
      ])

      expect(report.compiledContext).not.toContain('Partial output must not be injected')
      expect(report.sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'short-term',
            path: '.fluxion/memory/short-term/workflow-4/node-a.md',
            included: false,
            nodeId: 'node-a',
            warning: expect.stringContaining('Invalid short-term context frontmatter')
          })
        ])
      )
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid short-term context frontmatter for node node-a')
      )
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('rebuilds an invalid memory index with a warning when saving node output', async () => {
    const indexPath = join(workspacePath, '.fluxion', 'memory', 'index.json')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await writeFile(indexPath, '{not-json}\n', 'utf8')

    try {
      await memoryManager.saveNodeOutput(workspacePath, 'workflow-4', {
        runId: 'run-4',
        nodeId: 'node-a',
        runner: 'codex',
        model: 'gpt-5.5',
        status: 'completed',
        startedAt: '2026-05-06T00:00:00.000Z',
        completedAt: '2026-05-06T00:00:01.000Z',
        content: 'Recovered output'
      })

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not parse memory index'),
        expect.anything()
      )

      const parsed = MemoryIndexSchema.parse(
        JSON.parse(await readFile(indexPath, 'utf8')) as unknown
      )
      expect(parsed.entries).toEqual([
        expect.objectContaining({
          id: 'raw_output:workflow-4:run-4:node-a:0',
          type: 'raw_output',
          workflowId: 'workflow-4',
          runId: 'run-4',
          nodeId: 'node-a',
          sourcePath: '.fluxion/memory/short-term/workflow-4/node-a.md',
          createdAt: '2026-05-06T00:00:01.000Z'
        })
      ])
    } finally {
      warnSpy.mockRestore()
    }
  })
})
