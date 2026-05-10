import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { validateWorkflowGraph } from '../dag/dag.validation'
import { WorkflowSchema } from '../schema/workflow.schema'

const dogfoodWorkflowDir = path.resolve(process.cwd(), 'docs', 'dogfood', 'workflows')

describe('dogfood workflows', () => {
  it('parses all versioned dogfood workflows with the current schema', () => {
    const workflowFiles = readdirSync(dogfoodWorkflowDir)
      .filter((fileName) => fileName.endsWith('.fluxion.json'))
      .sort()

    expect(workflowFiles).toHaveLength(5)

    for (const fileName of workflowFiles) {
      const raw = readFileSync(path.join(dogfoodWorkflowDir, fileName), 'utf8')
      const workflow = WorkflowSchema.parse(JSON.parse(raw))
      const graphValidation = validateWorkflowGraph(workflow)

      expect(graphValidation.errors, fileName).toEqual([])
      expect(graphValidation.valid, fileName).toBe(true)
      expect(
        workflow.nodes.every((node) => node.data.runner === 'codex'),
        fileName
      ).toBe(true)
      expect(
        workflow.nodes.every((node) => node.data.codex.approvalPolicy === 'never'),
        fileName
      ).toBe(true)
    }
  })
})
