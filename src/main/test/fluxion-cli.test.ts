import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { inspectRunState, listWorkflows, validateWorkflow } from '../../../scripts/cli/fluxion-cli.mjs'

describe('fluxion CLI companion', () => {
  let workspacePath: string

  afterEach(async () => {
    if (workspacePath) {
      await rm(workspacePath, { recursive: true, force: true })
    }
  })

  it('lists workflows and validates a workflow file', async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-cli-'))
    const workflowsDir = join(workspacePath, '.fluxion', 'workflows')
    await mkdir(workflowsDir, { recursive: true })

    const workflowPath = join(workflowsDir, 'sample.fluxion.json')
    await writeFile(
      workflowPath,
      JSON.stringify(
        {
          id: 'workflow-1',
          name: 'Sample Workflow',
          executionMode: 'auto',
          nodes: [
            {
              id: 'node-a',
              type: 'agentNode',
              label: 'Node A',
              data: {
                provider: 'codex',
                model: 'gpt-5.5',
                prompt: 'Do work'
              },
              position: { x: 0, y: 0 }
            }
          ],
          edges: []
        },
        null,
        2
      ),
      'utf8'
    )

    const workflows = await listWorkflows(workspacePath)
    expect(workflows).toEqual([
      {
        id: 'workflow-1',
        name: 'Sample Workflow',
        executionMode: 'auto',
        file: '.fluxion/workflows/sample.fluxion.json'
      }
    ])

    const validated = await validateWorkflow(workspacePath, workflowPath)
    expect(validated).toMatchObject({
      ok: true,
      file: '.fluxion/workflows/sample.fluxion.json',
      workflow: {
        id: 'workflow-1',
        name: 'Sample Workflow',
        nodes: 1,
        edges: 0
      }
    })
  })

  it('inspects run state', async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-cli-run-'))
    const runsDir = join(workspacePath, '.fluxion', 'runs')
    await mkdir(runsDir, { recursive: true })

    await writeFile(
      join(runsDir, 'run-1.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          runId: 'run-1',
          workflowId: 'workflow-1',
          executionMode: 'auto',
          status: 'running',
          updatedAt: '2026-05-24T00:00:00.000Z',
          currentNodeIds: ['node-a'],
          awaitingReviewNodeIds: [],
          nodes: {}
        },
        null,
        2
      ),
      'utf8'
    )

    const result = await inspectRunState(workspacePath, 'run-1')
    expect(result).toMatchObject({
      runId: 'run-1',
      workflowId: 'workflow-1',
      status: 'running',
      currentNodeIds: ['node-a']
    })
  })
})
