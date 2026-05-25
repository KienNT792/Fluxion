#!/usr/bin/env node

import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { z } from 'zod'

const workflowNodeDataSchema = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
    label: z.string().optional(),
    prompt: z.string(),
    systemInstruction: z.string().optional(),
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
    reasoningLevel: z.enum(['low', 'medium', 'high', 'xhigh']).optional()
  })
  .passthrough()

const workflowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  executionMode: z.enum(['auto', 'manual']).optional(),
  fluxionVersion: z.string().optional(),
  nodes: z.array(
    z.object({
      id: z.string().min(1),
      type: z.string().optional(),
      label: z.string().optional(),
      data: workflowNodeDataSchema,
      position: z.object({
        x: z.number(),
        y: z.number()
      })
    })
  ),
  edges: z.array(
    z.object({
      id: z.string().min(1),
      source: z.string().min(1),
      target: z.string().min(1),
      label: z.string().optional()
    })
  ),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

const runStateSchema = z.object({
  schemaVersion: z.number(),
  runId: z.string().min(1),
  flowContextId: z.string().optional(),
  workflowId: z.string().min(1),
  executionMode: z.enum(['auto', 'manual']),
  status: z.string().min(1),
  startedAt: z.string().optional(),
  updatedAt: z.string().min(1),
  completedAt: z.string().optional(),
  currentNodeIds: z.array(z.string()),
  awaitingReviewNodeIds: z.array(z.string()),
  nodes: z.record(z.string(), z.unknown())
})

function printUsage() {
  console.log(`Fluxion CLI

Usage:
  fluxion-cli workflows <workspace>
  fluxion-cli validate <workspace> <workflow-file>
  fluxion-cli run-state <workspace> <run-id>
`)
}

function resolveWorkspacePath(input) {
  return path.resolve(input)
}

function resolveWorkflowPath(workspacePath, input) {
  return path.isAbsolute(input) ? input : path.join(workspacePath, input)
}

async function listWorkflows(workspacePath) {
  const workflowsDir = path.join(workspacePath, '.fluxion', 'workflows')
  const entries = await readdir(workflowsDir, { withFileTypes: true }).catch((error) => {
    if (error?.code === 'ENOENT') {
      return []
    }
    throw error
  })

  return Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map(async (entry) => {
        const filePath = path.join(workflowsDir, entry.name)
        const content = await readFile(filePath, 'utf8')
        const workflow = workflowSchema.parse(JSON.parse(content))
        return {
          id: workflow.id,
          name: workflow.name,
          executionMode: workflow.executionMode ?? 'auto',
          file: path.relative(workspacePath, filePath).replaceAll('\\', '/')
        }
      })
  )
}

async function validateWorkflow(workspacePath, workflowPath) {
  const content = await readFile(workflowPath, 'utf8')
  const parsed = workflowSchema.safeParse(JSON.parse(content))
  if (!parsed.success) {
    return {
      ok: false,
      file: path.relative(workspacePath, workflowPath).replaceAll('\\', '/'),
      issues: parsed.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    }
  }

  return {
    ok: true,
    file: path.relative(workspacePath, workflowPath).replaceAll('\\', '/'),
    workflow: {
      id: parsed.data.id,
      name: parsed.data.name,
      nodes: parsed.data.nodes.length,
      edges: parsed.data.edges.length
    }
  }
}

async function inspectRunState(workspacePath, runId) {
  const runPath = path.join(workspacePath, '.fluxion', 'runs', `${runId}.json`)
  const content = await readFile(runPath, 'utf8')
  const parsed = runStateSchema.safeParse(JSON.parse(content))
  if (!parsed.success) {
    throw new Error(
      `Invalid run state: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ')}`
    )
  }

  return {
    runId: parsed.data.runId,
    workflowId: parsed.data.workflowId,
    status: parsed.data.status,
    executionMode: parsed.data.executionMode,
    currentNodeIds: parsed.data.currentNodeIds,
    awaitingReviewNodeIds: parsed.data.awaitingReviewNodeIds
  }
}

async function main(argv) {
  const [command, workspaceArg, targetArg] = argv

  if (!command || command === '--help' || command === '-h') {
    printUsage()
    return 0
  }

  if (!workspaceArg) {
    throw new Error('Workspace path is required.')
  }

  const workspacePath = resolveWorkspacePath(workspaceArg)

  if (command === 'workflows') {
    const workflows = await listWorkflows(workspacePath)
    console.log(JSON.stringify({ workspacePath, workflows }, null, 2))
    return 0
  }

  if (command === 'validate') {
    if (!targetArg) {
      throw new Error('Workflow file path is required.')
    }

    const workflowPath = resolveWorkflowPath(workspacePath, targetArg)
    const result = await validateWorkflow(workspacePath, workflowPath)
    console.log(JSON.stringify(result, null, 2))
    return result.ok ? 0 : 1
  }

  if (command === 'run-state') {
    if (!targetArg) {
      throw new Error('Run id is required.')
    }

    const result = await inspectRunState(workspacePath, targetArg)
    console.log(JSON.stringify(result, null, 2))
    return 0
  }

  throw new Error(`Unknown command: ${command}`)
}

const isEntry = process.argv[1] ? path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname) : false

if (isEntry) {
  main(process.argv.slice(2))
    .then((exitCode) => {
      process.exitCode = exitCode
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}

export { inspectRunState, listWorkflows, main, validateWorkflow }
