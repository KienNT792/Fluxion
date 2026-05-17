import { readFile } from 'node:fs/promises'
import path from 'node:path'

const FINAL_WORKFLOW_TYPES = new Set([
  'workflow.completed',
  'workflow.failed',
  'workflow.aborted',
  'workflow.rejected'
])

const NODE_TERMINAL_TYPES = new Set([
  'node.output_saved',
  'node.failed',
  'node.aborted',
  'node.review_requested'
])

const CONTEXT_EVENT_TYPES = new Set([
  'workflow.context_initialized',
  'node.context_snapshot_created',
  'node.context_delta_committed',
  'node.context_delta_conflicted'
])

const CONTEXT_NODE_EVENT_TYPES = new Set([
  'node.context_snapshot_created',
  'node.context_delta_committed',
  'node.context_delta_conflicted'
])

const FINAL_CONTEXT_COMMIT_STATES = new Set(['completed', 'review_approved'])

function parseArgs(argv) {
  const args = new Map()
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      continue
    }
    const key = token.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) {
      args.set(key, true)
      continue
    }
    args.set(key, value)
    index += 1
  }
  return args
}

function keyFor(event) {
  return `${event.nodeId ?? 'workflow'}:${event.type}`
}

function indexOfEvent(events, predicate, startIndex = 0) {
  for (let index = startIndex; index < events.length; index += 1) {
    if (predicate(events[index])) {
      return index
    }
  }
  return -1
}

function lastIndexOfEvent(events, predicate, startIndex = events.length - 1) {
  for (let index = Math.min(startIndex, events.length - 1); index >= 0; index -= 1) {
    if (predicate(events[index])) {
      return index
    }
  }
  return -1
}

function check(name, ok, message, details = undefined) {
  return { name, ok, message, details }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function eventData(event) {
  return isRecord(event.data) ? event.data : {}
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function indexedEvents(events, predicate) {
  return events
    .map((event, index) => ({ event, index, data: eventData(event) }))
    .filter(({ event, data }) => predicate(event, data))
}

function eventDetails(event, index, extra = {}) {
  const data = eventData(event)
  return {
    eventIndex: index,
    type: event.type,
    runId: event.runId,
    flowContextId: event.flowContextId,
    nodeId: event.nodeId,
    snapshotVersion: data.snapshotVersion,
    contextVersion: data.contextVersion ?? data.currentContextVersion,
    deltaIdempotencyKey: data.deltaIdempotencyKey,
    ...extra
  }
}

function buildStats(events) {
  const eventCounts = {}
  const nodes = new Set()
  for (const event of events) {
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1
    if (event.nodeId) {
      nodes.add(event.nodeId)
    }
  }
  return {
    events: events.length,
    nodes: nodes.size,
    eventCounts
  }
}

function addContextInitializedBeforeSnapshotCheck(events, checks, workflowStartIndexes) {
  const contextNodeEvents = indexedEvents(events, (event) =>
    CONTEXT_NODE_EVENT_TYPES.has(event.type)
  )
  const initEvents = indexedEvents(events, (event) => event.type === 'workflow.context_initialized')
  const firstContextNodeEvent = contextNodeEvents[0]
  const initIndex = initEvents[0]?.index ?? -1
  const workflowStartIndex = workflowStartIndexes[0] ?? -1
  const ok =
    contextNodeEvents.length === 0
      ? initEvents.length <= 1 && (initEvents.length === 0 || workflowStartIndex < initIndex)
      : initEvents.length === 1 &&
        workflowStartIndex >= 0 &&
        workflowStartIndex < initIndex &&
        initIndex < firstContextNodeEvent.index

  checks.push(
    check(
      'context-initialized-before-snapshot',
      ok,
      'Flow context must be initialized after workflow start and before node context events.',
      {
        workflowStartIndexes,
        initIndexes: initEvents.map(({ index }) => index),
        firstContextNodeEvent: firstContextNodeEvent
          ? eventDetails(firstContextNodeEvent.event, firstContextNodeEvent.index)
          : undefined
      }
    )
  )
}

function addContextFlowContextConsistencyCheck(events, checks) {
  const contextEvents = indexedEvents(events, (event) => CONTEXT_EVENT_TYPES.has(event.type))
  const initEvents = contextEvents.filter(
    ({ event }) => event.type === 'workflow.context_initialized'
  )
  const expectedFlowContextId =
    initEvents.length === 1 ? initEvents[0].event.flowContextId : undefined
  const issues = []

  for (const { event, index } of contextEvents) {
    if (!isNonEmptyString(event.flowContextId)) {
      issues.push(eventDetails(event, index, { issue: 'missingFlowContextId' }))
      continue
    }
    if (expectedFlowContextId && event.flowContextId !== expectedFlowContextId) {
      issues.push(
        eventDetails(event, index, {
          issue: 'mismatchedFlowContextId',
          expectedFlowContextId
        })
      )
    }
  }

  checks.push(
    check(
      'context-flow-context-consistency',
      issues.length === 0,
      'All context trace events must carry the initialized flowContextId.',
      { expectedFlowContextId, issues }
    )
  )
}

function addContextSnapshotOrderAndShapeCheck(events, checks) {
  const issues = []
  const snapshots = indexedEvents(events, (event) => event.type === 'node.context_snapshot_created')

  for (const { event, index, data } of snapshots) {
    const compileIndex = lastIndexOfEvent(
      events,
      (candidate) =>
        candidate.nodeId === event.nodeId && candidate.type === 'node.context_compiled',
      index - 1
    )
    const executionStartedIndex = indexOfEvent(
      events,
      (candidate) =>
        candidate.nodeId === event.nodeId && candidate.type === 'node.execution_started',
      index + 1
    )
    const missingFields = []
    if (!isFiniteNumber(data.snapshotVersion)) {
      missingFields.push('snapshotVersion')
    }
    if (!isNonEmptyString(data.snapshotHash)) {
      missingFields.push('snapshotHash')
    }
    if (!isNonEmptyString(data.flowContextId)) {
      missingFields.push('flowContextId')
    }
    if (!isFiniteNumber(data.memorySourceCount)) {
      missingFields.push('memorySourceCount')
    }
    if (!isFiniteNumber(data.artifactRefCount)) {
      missingFields.push('artifactRefCount')
    }

    if (compileIndex < 0 || executionStartedIndex < 0 || missingFields.length > 0) {
      issues.push(
        eventDetails(event, index, {
          issue: 'invalidSnapshotOrderOrShape',
          compileIndex,
          executionStartedIndex,
          missingFields
        })
      )
    }
  }

  checks.push(
    check(
      'context-snapshot-order-and-shape',
      issues.length === 0,
      'Each context snapshot must occur after context compilation, before execution start, and include required snapshot data.',
      { issues }
    )
  )
}

function addContextDeltaCommitSafeOrderCheck(events, checks) {
  const issues = []
  const commits = indexedEvents(events, (event) => event.type === 'node.context_delta_committed')

  for (const { event, index, data } of commits) {
    const commitState = data.commitState
    if (!isNonEmptyString(commitState)) {
      issues.push(eventDetails(event, index, { issue: 'missingCommitState' }))
      continue
    }

    if (commitState === 'completed') {
      const outputSavedIndex = lastIndexOfEvent(
        events,
        (candidate) => candidate.nodeId === event.nodeId && candidate.type === 'node.output_saved',
        index - 1
      )
      if (outputSavedIndex < 0) {
        issues.push(eventDetails(event, index, { issue: 'completedCommitBeforeOutputSaved' }))
      }
      continue
    }

    if (commitState === 'awaiting_review') {
      const outputSavedIndex = lastIndexOfEvent(
        events,
        (candidate) => candidate.nodeId === event.nodeId && candidate.type === 'node.output_saved',
        index - 1
      )
      const reviewRequestedIndex = indexOfEvent(
        events,
        (candidate) =>
          candidate.nodeId === event.nodeId && candidate.type === 'node.review_requested',
        index + 1
      )
      if (outputSavedIndex < 0 || reviewRequestedIndex < 0) {
        issues.push(
          eventDetails(event, index, {
            issue: 'awaitingReviewCommitOutsideReviewWindow',
            outputSavedIndex,
            reviewRequestedIndex
          })
        )
      }
      continue
    }

    if (commitState === 'review_approved') {
      const reviewApprovedIndex = lastIndexOfEvent(
        events,
        (candidate) =>
          candidate.nodeId === event.nodeId && candidate.type === 'node.review_approved',
        index - 1
      )
      if (reviewApprovedIndex < 0) {
        issues.push(eventDetails(event, index, { issue: 'reviewApprovedCommitBeforeApproval' }))
      }
      continue
    }

    issues.push(eventDetails(event, index, { issue: 'unsupportedCommitState', commitState }))
  }

  checks.push(
    check(
      'context-delta-commit-safe-order',
      issues.length === 0,
      'Context delta commits must occur only after their commit-safe lifecycle event.',
      { issues }
    )
  )
}

function addContextNoSuccessCommitAfterTerminalNodeFailureCheck(events, checks) {
  const issues = []
  const terminalFailures = indexedEvents(
    events,
    (event) => event.type === 'node.failed' || event.type === 'node.aborted'
  )

  for (const { event, index } of terminalFailures) {
    const laterCommitIndex = indexOfEvent(
      events,
      (candidate) =>
        candidate.nodeId === event.nodeId && candidate.type === 'node.context_delta_committed',
      index + 1
    )
    if (laterCommitIndex >= 0) {
      issues.push(
        eventDetails(events[laterCommitIndex], laterCommitIndex, {
          issue: 'successCommitAfterTerminalNodeFailure',
          terminalFailureIndex: index
        })
      )
    }
  }

  checks.push(
    check(
      'context-no-success-commit-after-terminal-node-failure',
      issues.length === 0,
      'Failed or aborted nodes must not emit successful context delta commits afterwards.',
      { issues }
    )
  )
}

function findLatestFinalCommitBefore(events, nodeId, beforeIndex) {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    const event = events[index]
    const data = eventData(event)
    if (
      event.nodeId === nodeId &&
      event.type === 'node.context_delta_committed' &&
      FINAL_CONTEXT_COMMIT_STATES.has(data.commitState) &&
      isFiniteNumber(data.contextVersion)
    ) {
      return { event, index, data }
    }
  }
  return undefined
}

function addContextDownstreamSnapshotFreshnessCheck(events, checks) {
  const issues = []
  const readyEvents = indexedEvents(events, (event) => event.type === 'node.ready')

  for (const { event, index, data } of readyEvents) {
    if (!Array.isArray(data.previousNodeIds) || data.previousNodeIds.length === 0) {
      continue
    }

    const snapshotIndex = indexOfEvent(
      events,
      (candidate) =>
        candidate.nodeId === event.nodeId && candidate.type === 'node.context_snapshot_created',
      index + 1
    )
    if (snapshotIndex < 0) {
      issues.push(eventDetails(event, index, { issue: 'missingDownstreamSnapshot' }))
      continue
    }

    const snapshotEvent = events[snapshotIndex]
    const snapshotData = eventData(snapshotEvent)
    if (!isFiniteNumber(snapshotData.snapshotVersion)) {
      issues.push(
        eventDetails(snapshotEvent, snapshotIndex, { issue: 'missingDownstreamSnapshotVersion' })
      )
      continue
    }

    for (const previousNodeId of data.previousNodeIds) {
      if (!isNonEmptyString(previousNodeId)) {
        continue
      }

      const upstreamCommit = findLatestFinalCommitBefore(events, previousNodeId, snapshotIndex)
      if (!upstreamCommit) {
        issues.push(
          eventDetails(snapshotEvent, snapshotIndex, {
            issue: 'missingUpstreamFinalCommit',
            upstreamNodeId: previousNodeId
          })
        )
        continue
      }

      if (snapshotData.snapshotVersion < upstreamCommit.data.contextVersion) {
        issues.push(
          eventDetails(snapshotEvent, snapshotIndex, {
            issue: 'staleDownstreamSnapshot',
            upstreamNodeId: previousNodeId,
            requiredContextVersion: upstreamCommit.data.contextVersion,
            upstreamCommitIndex: upstreamCommit.index
          })
        )
      }
    }
  }

  checks.push(
    check(
      'context-downstream-snapshot-freshness',
      issues.length === 0,
      'Downstream snapshots must be at least as fresh as final upstream context commits.',
      { issues }
    )
  )
}

function addContextConflictHandledDeterministicallyCheck(events, checks) {
  const issues = []
  const conflicts = indexedEvents(events, (event) => event.type === 'node.context_delta_conflicted')

  for (const { event, index, data } of conflicts) {
    const missingFields = []
    if (!isNonEmptyString(data.deltaIdempotencyKey)) {
      missingFields.push('deltaIdempotencyKey')
    }
    if (!isFiniteNumber(data.baseSnapshotVersion)) {
      missingFields.push('baseSnapshotVersion')
    }
    if (!isNonEmptyString(data.baseSnapshotHash)) {
      missingFields.push('baseSnapshotHash')
    }
    if (!isFiniteNumber(data.currentContextVersion)) {
      missingFields.push('currentContextVersion')
    }
    if (
      !isNonEmptyString(data.conflictKind) &&
      !isNonEmptyString(data.conflictPath) &&
      !isNonEmptyString(data.conflictReason)
    ) {
      missingFields.push('conflictKind|conflictPath|conflictReason')
    }

    const nodeFailureIndex = indexOfEvent(
      events,
      (candidate) => candidate.nodeId === event.nodeId && candidate.type === 'node.failed',
      index + 1
    )
    const laterCommitWithSameKeyIndex = isNonEmptyString(data.deltaIdempotencyKey)
      ? indexOfEvent(
          events,
          (candidate) =>
            candidate.nodeId === event.nodeId &&
            candidate.type === 'node.context_delta_committed' &&
            eventData(candidate).deltaIdempotencyKey === data.deltaIdempotencyKey,
          index + 1
        )
      : -1

    if (missingFields.length > 0 || nodeFailureIndex < 0 || laterCommitWithSameKeyIndex >= 0) {
      issues.push(
        eventDetails(event, index, {
          issue: 'invalidConflictHandling',
          missingFields,
          nodeFailureIndex,
          laterCommitWithSameKeyIndex
        })
      )
    }
  }

  checks.push(
    check(
      'context-conflict-handled-deterministically',
      issues.length === 0,
      'Context delta conflicts must include structured evidence, fail the node, and never later commit the same delta.',
      { issues }
    )
  )
}

function addContextConflictDoesNotUnlockDownstreamCheck(events, checks) {
  const issues = []
  const conflicts = indexedEvents(events, (event) => event.type === 'node.context_delta_conflicted')

  for (const { event, index } of conflicts) {
    if (!isNonEmptyString(event.nodeId)) {
      continue
    }

    for (let candidateIndex = index + 1; candidateIndex < events.length; candidateIndex += 1) {
      const candidate = events[candidateIndex]
      const candidateData = eventData(candidate)
      if (
        candidate.type === 'node.ready' &&
        Array.isArray(candidateData.previousNodeIds) &&
        candidateData.previousNodeIds.includes(event.nodeId)
      ) {
        issues.push(
          eventDetails(candidate, candidateIndex, {
            issue: 'downstreamReadyAfterConflict',
            conflictNodeId: event.nodeId,
            conflictIndex: index
          })
        )
      }
    }
  }

  checks.push(
    check(
      'context-conflict-does-not-unlock-downstream',
      issues.length === 0,
      'A conflict-failed node must not unlock downstream nodes.',
      { issues }
    )
  )
}

function addContextLifecycleChecks(events, checks, workflowStartIndexes) {
  const hasContextEvents = events.some((event) => CONTEXT_EVENT_TYPES.has(event.type))
  if (!hasContextEvents) {
    return
  }

  addContextInitializedBeforeSnapshotCheck(events, checks, workflowStartIndexes)
  addContextFlowContextConsistencyCheck(events, checks)
  addContextSnapshotOrderAndShapeCheck(events, checks)
  addContextDeltaCommitSafeOrderCheck(events, checks)
  addContextNoSuccessCommitAfterTerminalNodeFailureCheck(events, checks)
  addContextDownstreamSnapshotFreshnessCheck(events, checks)
  addContextConflictHandledDeterministicallyCheck(events, checks)
  addContextConflictDoesNotUnlockDownstreamCheck(events, checks)
}

function evaluate(events) {
  const checks = []
  const workflowStartIndexes = events
    .map((event, index) => (event.type === 'workflow.started' ? index : -1))
    .filter((index) => index >= 0)
  const workflowFinalIndexes = events
    .map((event, index) => (FINAL_WORKFLOW_TYPES.has(event.type) ? index : -1))
    .filter((index) => index >= 0)

  checks.push(
    check(
      'workflow-start-final-consistency',
      workflowStartIndexes.length === 1 &&
        workflowFinalIndexes.length === 1 &&
        workflowStartIndexes[0] < workflowFinalIndexes[0],
      'Trace must contain exactly one workflow.started before exactly one terminal workflow event.',
      { workflowStartIndexes, workflowFinalIndexes }
    )
  )

  if (workflowFinalIndexes.length > 0) {
    const finalIndex = workflowFinalIndexes[0]
    checks.push(
      check(
        'no-events-after-terminal-workflow-final',
        finalIndex === events.length - 1,
        'Terminal workflow event must be the last trace event.',
        { finalIndex, trailingEvents: events.slice(finalIndex + 1).map(keyFor) }
      )
    )
  }

  const runningEvents = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.type === 'node.running')
  const nodeStartIssues = []
  for (const { event, index } of runningEvents) {
    const terminalIndex = indexOfEvent(
      events,
      (candidate) => candidate.nodeId === event.nodeId && NODE_TERMINAL_TYPES.has(candidate.type),
      index + 1
    )
    if (terminalIndex < 0) {
      nodeStartIssues.push({ nodeId: event.nodeId, runningIndex: index })
    }
  }
  checks.push(
    check(
      'node-start-end-consistency',
      nodeStartIssues.length === 0,
      'Every node.running event must be followed by an output, failure, abort, or review request event for the same node.',
      { issues: nodeStartIssues }
    )
  )

  const processIssues = []
  for (const [index, event] of events.entries()) {
    if (event.type !== 'node.process_spawned') {
      continue
    }
    const exitIndex = indexOfEvent(
      events,
      (candidate) => candidate.nodeId === event.nodeId && candidate.type === 'node.process_exited',
      index + 1
    )
    if (exitIndex < 0) {
      processIssues.push({ nodeId: event.nodeId, processSpawnedIndex: index })
    }
  }
  checks.push(
    check(
      'process-spawned-before-exited',
      processIssues.length === 0,
      'Every node.process_spawned event must be followed by node.process_exited for the same node.',
      { issues: processIssues }
    )
  )

  const outputIssues = []
  for (const [index, event] of events.entries()) {
    if (event.type !== 'node.output_saved') {
      continue
    }
    const producesIndex = indexOfEvent(
      events,
      (candidate) =>
        candidate.nodeId === event.nodeId && candidate.type === 'node.produces_validated',
      0
    )
    if (producesIndex < 0 || producesIndex > index) {
      outputIssues.push({ nodeId: event.nodeId, outputSavedIndex: index, producesIndex })
    }
  }
  checks.push(
    check(
      'artifact-validation-before-output-save',
      outputIssues.length === 0,
      'Every node.output_saved event must occur after node.produces_validated for the same node.',
      { issues: outputIssues }
    )
  )

  const reviewIssues = []
  for (const [index, event] of events.entries()) {
    if (event.type !== 'node.review_approved' && event.type !== 'node.review_rejected') {
      continue
    }
    const requestIndex = indexOfEvent(
      events,
      (candidate) =>
        candidate.nodeId === event.nodeId && candidate.type === 'node.review_requested',
      0
    )
    if (requestIndex < 0 || requestIndex > index) {
      reviewIssues.push({ nodeId: event.nodeId, reviewEventIndex: index, requestIndex })
    }
  }
  checks.push(
    check(
      'review-requested-before-decision',
      reviewIssues.length === 0,
      'Every review approval/rejection must occur after node.review_requested for the same node.',
      { issues: reviewIssues }
    )
  )

  addContextLifecycleChecks(events, checks, workflowStartIndexes)

  const ok = checks.every((item) => item.ok)
  return {
    ok,
    checks,
    errors: checks.filter((item) => !item.ok).map((item) => item.message)
  }
}

async function readTrace(tracePath) {
  const content = await readFile(tracePath, 'utf8')
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        throw new Error(`Invalid JSON on trace line ${index + 1}: ${error.message}`)
      }
    })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const workspace = args.get('workspace')
  const runId = args.get('run')

  if (typeof workspace !== 'string' || typeof runId !== 'string') {
    console.error(
      JSON.stringify({
        ok: false,
        errors: ['Usage: npm run eval:workflow -- --workspace <path> --run <runId>']
      })
    )
    process.exitCode = 2
    return
  }

  const tracePath = path.join(workspace, '.fluxion', 'runs', `${runId}.trace.jsonl`)
  try {
    const events = await readTrace(tracePath)
    const result = evaluate(events)
    console.log(
      JSON.stringify(
        {
          ok: result.ok,
          runId,
          tracePath,
          checks: result.checks,
          stats: buildStats(events),
          errors: result.errors
        },
        null,
        2
      )
    )
    process.exitCode = result.ok ? 0 : 1
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          runId,
          tracePath,
          checks: [],
          stats: { events: 0, nodes: 0, eventCounts: {} },
          errors: [error instanceof Error ? error.message : String(error)]
        },
        null,
        2
      )
    )
    process.exitCode = 2
  }
}

await main()
