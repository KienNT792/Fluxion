import { spawn } from 'child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const FLOW_CONTEXT_ID = 'flow-1'

interface EvalResult {
  code: number | null
  stdout: string
  stderr: string
}

interface EvalCheck {
  name: string
  ok: boolean
  message?: string
  details?: Record<string, unknown>
}

interface EvalSummary {
  ok: boolean
  checks: EvalCheck[]
  errors: string[]
  [key: string]: unknown
}

function runEval(workspacePath: string, runId: string): Promise<EvalResult> {
  const scriptPath = join(process.cwd(), 'scripts', 'eval', 'workflow-trace-eval.mjs')
  const child = spawn(process.execPath, [scriptPath, '--workspace', workspacePath, '--run', runId])
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk: Buffer) => {
    stdout += chunk.toString('utf8')
  })
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8')
  })

  return new Promise((resolve) => {
    child.on('close', (code) => {
      resolve({ code, stdout, stderr })
    })
  })
}

async function writeTrace(workspacePath: string, runId: string, events: unknown[]): Promise<void> {
  const runDir = join(workspacePath, '.fluxion', 'runs')
  await mkdir(runDir, { recursive: true })
  await writeFile(
    join(runDir, `${runId}.trace.jsonl`),
    `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
    'utf8'
  )
}

function event(
  type: string,
  nodeId?: string,
  data?: Record<string, unknown>,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const traceEvent: Record<string, unknown> = {
    schemaVersion: 1,
    runId: 'run-1',
    workflowId: 'workflow-1',
    nodeId,
    type,
    timestamp: '2026-05-10T00:00:00.000Z',
    ...overrides
  }

  if (data !== undefined) {
    traceEvent.data = data
  }

  return traceEvent
}

function contextEvent(
  type: string,
  nodeId?: string,
  data: Record<string, unknown> = {},
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return event(type, nodeId, data, { flowContextId: FLOW_CONTEXT_ID, ...overrides })
}

function contextSnapshotData(nodeId: string, snapshotVersion: number): Record<string, unknown> {
  return {
    flowContextId: FLOW_CONTEXT_ID,
    snapshotVersion,
    snapshotHash: `hash-${nodeId}-${snapshotVersion}`,
    memorySourceCount: 0,
    artifactRefCount: 0
  }
}

function completedNodeTrace(
  nodeId: string,
  previousNodeIds: string[],
  snapshotVersion: number,
  contextVersion: number
): Record<string, unknown>[] {
  return [
    contextEvent('node.ready', nodeId, { previousNodeIds }),
    contextEvent('node.running', nodeId),
    contextEvent('node.context_compiled', nodeId, { previousNodeIds }),
    contextEvent(
      'node.context_snapshot_created',
      nodeId,
      contextSnapshotData(nodeId, snapshotVersion)
    ),
    contextEvent('node.execution_started', nodeId),
    contextEvent('node.execution_completed', nodeId, { success: true }),
    contextEvent('node.produces_validated', nodeId, { producesCount: 0, artifactPaths: [] }),
    contextEvent('node.output_saved', nodeId, {
      outputFilePath: `.fluxion/memory/short-term/workflow-1/${nodeId}.md`,
      attempt: 1
    }),
    contextEvent('node.context_delta_committed', nodeId, {
      commitState: 'completed',
      deltaIdempotencyKey: `run-1:${nodeId}:1:completed`,
      contextVersion,
      baseSnapshotVersion: snapshotVersion,
      baseSnapshotHash: `hash-${nodeId}-${snapshotVersion}`
    })
  ]
}

function contextHappyTrace(): Record<string, unknown>[] {
  return [
    event('workflow.started', undefined, undefined, { flowContextId: FLOW_CONTEXT_ID }),
    contextEvent('workflow.context_initialized', undefined, {
      contextFilePath: '.fluxion/runs/run-1.context.json',
      version: 1
    }),
    ...completedNodeTrace('node-a', [], 1, 2),
    ...completedNodeTrace('node-b', ['node-a'], 2, 3),
    event('workflow.completed', undefined, undefined, { flowContextId: FLOW_CONTEXT_ID })
  ]
}

function parallelAdditiveTrace(): Record<string, unknown>[] {
  return [
    event('workflow.started', undefined, undefined, { flowContextId: FLOW_CONTEXT_ID }),
    contextEvent('workflow.context_initialized', undefined, { version: 1 }),
    ...completedNodeTrace('node-a', [], 1, 2),
    ...completedNodeTrace('node-b', [], 1, 3),
    event('workflow.completed', undefined, undefined, { flowContextId: FLOW_CONTEXT_ID })
  ]
}

function conflictHandledTrace(): Record<string, unknown>[] {
  const conflictKey = 'run-1:node-b:1:completed'

  return [
    event('workflow.started', undefined, undefined, { flowContextId: FLOW_CONTEXT_ID }),
    contextEvent('workflow.context_initialized', undefined, { version: 1 }),
    contextEvent('node.ready', 'node-b', { previousNodeIds: [] }),
    contextEvent('node.running', 'node-b'),
    contextEvent('node.context_compiled', 'node-b', { previousNodeIds: [] }),
    contextEvent('node.context_snapshot_created', 'node-b', contextSnapshotData('node-b', 1)),
    contextEvent('node.execution_started', 'node-b'),
    contextEvent('node.execution_completed', 'node-b', { success: true }),
    contextEvent('node.produces_validated', 'node-b', { producesCount: 0, artifactPaths: [] }),
    contextEvent('node.output_saved', 'node-b', {
      outputFilePath: '.fluxion/memory/short-term/workflow-1/node-b.md',
      attempt: 1
    }),
    contextEvent('node.context_delta_conflicted', 'node-b', {
      commitState: 'completed',
      deltaIdempotencyKey: conflictKey,
      baseSnapshotVersion: 1,
      baseSnapshotHash: 'hash-node-b-1',
      currentContextVersion: 2,
      conflictKind: 'provider_state',
      conflictPath: 'providerState.codex.runnerSessionsByNode.node-b',
      conflictReason: 'Conflicting provider state update.'
    }),
    contextEvent('node.failed', 'node-b', { error: 'Flow context merge conflict.' }),
    event('workflow.failed', undefined, undefined, { flowContextId: FLOW_CONTEXT_ID })
  ]
}

function parsedStdout(result: EvalResult): EvalSummary {
  return JSON.parse(result.stdout) as EvalSummary
}

function expectFailedCheck(summary: EvalSummary, name: string): EvalCheck {
  const failedCheck = summary.checks.find((item) => item.name === name && item.ok === false)
  expect(failedCheck).toBeTruthy()
  return failedCheck as EvalCheck
}

function expectCheckDetails(checkResult: EvalCheck): Record<string, unknown> {
  expect(checkResult.details).toBeTruthy()
  return checkResult.details as Record<string, unknown>
}

function expectFirstIssue(checkResult: EvalCheck): Record<string, unknown> {
  const details = expectCheckDetails(checkResult)
  expect(Array.isArray(details.issues)).toBe(true)
  const issues = details.issues as Record<string, unknown>[]
  expect(issues[0]).toBeTruthy()
  return issues[0]
}

describe('workflow-trace-eval', () => {
  let workspacePath: string

  beforeEach(async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-trace-eval-'))
  })

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true })
  })

  it('returns pass for a valid happy-path trace', async () => {
    await writeTrace(workspacePath, 'run-1', [
      event('workflow.started'),
      event('node.ready', 'node-a'),
      event('node.running', 'node-a'),
      event('node.process_spawned', 'node-a'),
      event('node.process_exited', 'node-a'),
      event('node.produces_validated', 'node-a'),
      event('node.output_saved', 'node-a'),
      event('workflow.completed')
    ])

    const result = await runEval(workspacePath, 'run-1')
    const summary = JSON.parse(result.stdout)

    expect(result.code).toBe(0)
    expect(summary).toMatchObject({
      ok: true,
      runId: 'run-1',
      errors: [],
      stats: {
        events: 8,
        nodes: 1
      }
    })
  })

  it('returns deterministic failure for an invalid event order', async () => {
    await writeTrace(workspacePath, 'run-1', [
      event('workflow.started'),
      event('node.ready', 'node-a'),
      event('node.running', 'node-a'),
      event('node.output_saved', 'node-a'),
      event('node.produces_validated', 'node-a'),
      event('workflow.completed')
    ])

    const result = await runEval(workspacePath, 'run-1')
    const summary = JSON.parse(result.stdout)

    expect(result.code).toBe(1)
    expect(summary.ok).toBe(false)
    expect(summary.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'artifact-validation-before-output-save',
          ok: false
        })
      ])
    )
  })

  it('returns pass for a valid context-aware trace', async () => {
    await writeTrace(workspacePath, 'run-1', contextHappyTrace())

    const result = await runEval(workspacePath, 'run-1')
    const summary = parsedStdout(result)

    expect(result.code).toBe(0)
    expect(summary).toMatchObject({
      ok: true,
      errors: []
    })
    expect(summary.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'context-initialized-before-snapshot', ok: true }),
        expect.objectContaining({ name: 'context-downstream-snapshot-freshness', ok: true })
      ])
    )
  })

  it.each([
    [
      'missing',
      () =>
        contextHappyTrace().filter(
          (traceEvent) => traceEvent.type !== 'workflow.context_initialized'
        )
    ],
    [
      'late',
      () => {
        const trace = contextHappyTrace()
        const initIndex = trace.findIndex(
          (traceEvent) => traceEvent.type === 'workflow.context_initialized'
        )
        const [initEvent] = trace.splice(initIndex, 1)
        const snapshotIndex = trace.findIndex(
          (traceEvent) => traceEvent.type === 'node.context_snapshot_created'
        )
        trace.splice(snapshotIndex + 1, 0, initEvent)
        return trace
      }
    ]
  ])('fails when context initialization is %s', async (_name, buildTrace) => {
    await writeTrace(workspacePath, 'run-1', buildTrace())

    const result = await runEval(workspacePath, 'run-1')
    const summary = parsedStdout(result)
    const failedCheck = expectFailedCheck(summary, 'context-initialized-before-snapshot')

    expect(result.code).toBe(1)
    expect(summary.ok).toBe(false)
    expect(expectCheckDetails(failedCheck).firstContextNodeEvent).toMatchObject({
      runId: 'run-1',
      flowContextId: FLOW_CONTEXT_ID,
      nodeId: expect.any(String)
    })
  })

  it.each([
    [
      'snapshot before context compilation',
      () => {
        const trace = contextHappyTrace()
        const snapshotIndex = trace.findIndex(
          (traceEvent) =>
            traceEvent.type === 'node.context_snapshot_created' && traceEvent.nodeId === 'node-a'
        )
        const [snapshotEvent] = trace.splice(snapshotIndex, 1)
        const compileIndex = trace.findIndex(
          (traceEvent) =>
            traceEvent.type === 'node.context_compiled' && traceEvent.nodeId === 'node-a'
        )
        trace.splice(compileIndex, 0, snapshotEvent)
        return trace
      }
    ],
    [
      'snapshot missing required data',
      () => {
        const trace = contextHappyTrace()
        const snapshot = trace.find(
          (traceEvent) =>
            traceEvent.type === 'node.context_snapshot_created' && traceEvent.nodeId === 'node-a'
        )
        delete (snapshot?.data as Record<string, unknown>).snapshotHash
        return trace
      }
    ]
  ])('fails for invalid context snapshot %s', async (_name, buildTrace) => {
    await writeTrace(workspacePath, 'run-1', buildTrace())

    const result = await runEval(workspacePath, 'run-1')
    const summary = parsedStdout(result)
    const failedCheck = expectFailedCheck(summary, 'context-snapshot-order-and-shape')

    expect(result.code).toBe(1)
    expect(expectFirstIssue(failedCheck)).toMatchObject({
      runId: 'run-1',
      flowContextId: FLOW_CONTEXT_ID,
      nodeId: 'node-a'
    })
  })

  it.each([
    [
      'completed commit before output save',
      () => {
        const trace = contextHappyTrace()
        const commitIndex = trace.findIndex(
          (traceEvent) =>
            traceEvent.type === 'node.context_delta_committed' && traceEvent.nodeId === 'node-a'
        )
        const [commitEvent] = trace.splice(commitIndex, 1)
        const outputIndex = trace.findIndex(
          (traceEvent) => traceEvent.type === 'node.output_saved' && traceEvent.nodeId === 'node-a'
        )
        trace.splice(outputIndex, 0, commitEvent)
        return trace
      }
    ],
    [
      'review-approved commit before approval',
      () => [
        event('workflow.started', undefined, undefined, { flowContextId: FLOW_CONTEXT_ID }),
        contextEvent('workflow.context_initialized', undefined, { version: 1 }),
        contextEvent('node.ready', 'node-a', { previousNodeIds: [] }),
        contextEvent('node.running', 'node-a'),
        contextEvent('node.context_compiled', 'node-a', { previousNodeIds: [] }),
        contextEvent('node.context_snapshot_created', 'node-a', contextSnapshotData('node-a', 1)),
        contextEvent('node.execution_started', 'node-a'),
        contextEvent('node.execution_completed', 'node-a', { success: true }),
        contextEvent('node.produces_validated', 'node-a', { producesCount: 0, artifactPaths: [] }),
        contextEvent('node.output_saved', 'node-a', { outputFilePath: 'node-a.md' }),
        contextEvent('node.context_delta_committed', 'node-a', {
          commitState: 'awaiting_review',
          deltaIdempotencyKey: 'run-1:node-a:1:awaiting_review',
          contextVersion: 2
        }),
        contextEvent('node.review_requested', 'node-a', { reviewSource: 'node' }),
        contextEvent('node.context_delta_committed', 'node-a', {
          commitState: 'review_approved',
          deltaIdempotencyKey: 'run-1:node-a:1:review_approved',
          contextVersion: 3
        }),
        contextEvent('node.review_approved', 'node-a'),
        event('workflow.completed', undefined, undefined, { flowContextId: FLOW_CONTEXT_ID })
      ]
    ]
  ])('fails for invalid context delta ordering: %s', async (_name, buildTrace) => {
    await writeTrace(workspacePath, 'run-1', buildTrace())

    const result = await runEval(workspacePath, 'run-1')
    const summary = parsedStdout(result)

    expect(result.code).toBe(1)
    expectFailedCheck(summary, 'context-delta-commit-safe-order')
  })

  it('fails when a downstream snapshot is stale relative to an upstream final commit', async () => {
    const trace = contextHappyTrace()
    const nodeBSnapshot = trace.find(
      (traceEvent) =>
        traceEvent.type === 'node.context_snapshot_created' && traceEvent.nodeId === 'node-b'
    )
    ;(nodeBSnapshot?.data as Record<string, unknown>).snapshotVersion = 1
    await writeTrace(workspacePath, 'run-1', trace)

    const result = await runEval(workspacePath, 'run-1')
    const summary = parsedStdout(result)
    const failedCheck = expectFailedCheck(summary, 'context-downstream-snapshot-freshness')

    expect(result.code).toBe(1)
    expect(expectFirstIssue(failedCheck)).toMatchObject({
      issue: 'staleDownstreamSnapshot',
      upstreamNodeId: 'node-a',
      requiredContextVersion: 2,
      snapshotVersion: 1
    })
  })

  it('returns pass for a parallel additive context trace', async () => {
    await writeTrace(workspacePath, 'run-1', parallelAdditiveTrace())

    const result = await runEval(workspacePath, 'run-1')
    const summary = parsedStdout(result)

    expect(result.code).toBe(0)
    expect(summary.ok).toBe(true)
  })

  it('returns pass for a deterministic context conflict trace', async () => {
    await writeTrace(workspacePath, 'run-1', conflictHandledTrace())

    const result = await runEval(workspacePath, 'run-1')
    const summary = parsedStdout(result)

    expect(result.code).toBe(0)
    expect(summary.ok).toBe(true)
  })

  it('fails for a malformed context conflict', async () => {
    const trace = conflictHandledTrace()
    const conflict = trace.find((traceEvent) => traceEvent.type === 'node.context_delta_conflicted')
    delete (conflict?.data as Record<string, unknown>).currentContextVersion
    await writeTrace(workspacePath, 'run-1', trace)

    const result = await runEval(workspacePath, 'run-1')
    const summary = parsedStdout(result)
    const failedCheck = expectFailedCheck(summary, 'context-conflict-handled-deterministically')

    expect(result.code).toBe(1)
    expect(expectFirstIssue(failedCheck).missingFields).toContain('currentContextVersion')
  })

  it('fails when a conflicted delta is later committed with the same idempotency key', async () => {
    const trace = conflictHandledTrace()
    const workflowFailed = trace.pop()
    trace.push(
      contextEvent('node.context_delta_committed', 'node-b', {
        commitState: 'completed',
        deltaIdempotencyKey: 'run-1:node-b:1:completed',
        contextVersion: 3
      }),
      workflowFailed!
    )
    await writeTrace(workspacePath, 'run-1', trace)

    const result = await runEval(workspacePath, 'run-1')
    const summary = parsedStdout(result)

    expect(result.code).toBe(1)
    expectFailedCheck(summary, 'context-conflict-handled-deterministically')
  })

  it('fails when a conflict-failed node unlocks downstream work', async () => {
    const trace = conflictHandledTrace()
    const workflowFailed = trace.pop()
    trace.push(
      contextEvent('node.ready', 'node-c', { previousNodeIds: ['node-b'] }),
      workflowFailed!
    )
    await writeTrace(workspacePath, 'run-1', trace)

    const result = await runEval(workspacePath, 'run-1')
    const summary = parsedStdout(result)

    expect(result.code).toBe(1)
    expectFailedCheck(summary, 'context-conflict-does-not-unlock-downstream')
  })

  it('returns input error for a missing trace file', async () => {
    const result = await runEval(workspacePath, 'missing-run')
    const summary = JSON.parse(result.stderr)

    expect(result.code).toBe(2)
    expect(summary.ok).toBe(false)
    expect(summary.errors[0]).toContain('no such file')
  })

  it('returns input error for invalid JSONL', async () => {
    const runDir = join(workspacePath, '.fluxion', 'runs')
    await mkdir(runDir, { recursive: true })
    await writeFile(join(runDir, 'run-1.trace.jsonl'), '{bad json}\n', 'utf8')

    const result = await runEval(workspacePath, 'run-1')
    const summary = JSON.parse(result.stderr)

    expect(result.code).toBe(2)
    expect(summary.ok).toBe(false)
    expect(summary.errors[0]).toContain('Invalid JSON on trace line 1')
  })
})
