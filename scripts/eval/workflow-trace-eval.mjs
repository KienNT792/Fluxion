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

function check(name, ok, message, details = undefined) {
  return { name, ok, message, details }
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
