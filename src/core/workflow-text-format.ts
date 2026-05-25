import matter from 'gray-matter'
import { z } from 'zod'
import {
  AgentNodeData,
  Workflow,
  WorkflowNode,
  WorkflowSchema,
  WorkflowNodeSchema
} from './schema/workflow.schema'

export const FLUXION_WORKFLOW_TEXT_FORMAT = 'fluxion-workflow' as const
export const FLUXION_WORKFLOW_TEXT_SCHEMA = '1.0' as const

export const workflowTextFrontmatterSchema = z.object({
  format: z.literal(FLUXION_WORKFLOW_TEXT_FORMAT),
  schema: z.literal(FLUXION_WORKFLOW_TEXT_SCHEMA),
  workflowId: z.string().min(1),
  name: z.string().min(1),
  executionMode: z.enum(['auto', 'manual']).optional(),
  fluxionVersion: z.string().optional(),
  generatedAt: z.string()
})

export const workflowTextUnsupportedFields = [
  'layout metadata other than node position',
  'custom node data fields that are not part of the persisted workflow contract',
  'non-JSON text comments inside the embedded workflow payload'
] as const

export function sortWorkflowForExport(workflow: Workflow): Workflow {
  return {
    ...workflow,
    nodes: [...workflow.nodes].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...workflow.edges].sort((a, b) => a.id.localeCompare(b.id))
  }
}

function normalizeWorkflowNodeData(data: AgentNodeData): AgentNodeData {
  return {
    ...data,
    runner: data.runner ?? 'codex',
    codex: data.codex ?? {
      json: true,
      sandboxMode: 'workspace-write',
      approvalPolicy: 'on-request'
    },
    requires: data.requires ?? [],
    produces: data.produces ?? [],
    humanReview: data.humanReview ?? false
  }
}

function normalizeWorkflowNode(node: WorkflowNode): WorkflowNode {
  return WorkflowNodeSchema.parse({
    ...node,
    type: node.type ?? 'agentNode',
    label: node.label ?? '',
    data: normalizeWorkflowNodeData(node.data)
  })
}

export function renderWorkflowTextExport(workflow: Workflow): string {
  const canonicalWorkflow = sortWorkflowForExport(normalizeWorkflowForTextRoundTrip(workflow))
  const frontmatter = matter.stringify(JSON.stringify(canonicalWorkflow, null, 2), {
    format: FLUXION_WORKFLOW_TEXT_FORMAT,
    schema: FLUXION_WORKFLOW_TEXT_SCHEMA,
    workflowId: canonicalWorkflow.id,
    name: canonicalWorkflow.name,
    executionMode: canonicalWorkflow.executionMode,
    fluxionVersion: canonicalWorkflow.fluxionVersion ?? FLUXION_WORKFLOW_TEXT_SCHEMA,
    generatedAt: new Date().toISOString()
  })

  return `${frontmatter.trimEnd()}\n`
}

export function parseWorkflowTextExport(raw: string): Workflow {
  const parsed = matter(raw)
  const frontmatter = workflowTextFrontmatterSchema.parse(parsed.data)
  const workflow = normalizeWorkflowForTextRoundTrip(WorkflowSchema.parse(JSON.parse(parsed.content)))

  if (workflow.id !== frontmatter.workflowId || workflow.name !== frontmatter.name) {
    throw new Error('Workflow export metadata does not match the embedded workflow payload.')
  }

  return {
    ...workflow,
    fluxionVersion: workflow.fluxionVersion ?? frontmatter.fluxionVersion ?? FLUXION_WORKFLOW_TEXT_SCHEMA
  }
}

export function normalizeWorkflowForTextRoundTrip(workflow: Workflow): Workflow {
  return {
    ...workflow,
    executionMode: workflow.executionMode ?? 'auto',
    fluxionVersion: workflow.fluxionVersion ?? FLUXION_WORKFLOW_TEXT_SCHEMA,
    nodes: workflow.nodes.map((node) => normalizeWorkflowNode(node))
  }
}
