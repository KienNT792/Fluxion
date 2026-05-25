import type { Edge, Node } from '@xyflow/react'
import type { WorkflowNode } from '@shared'

export interface WorkflowTemplateSummary {
  id: WorkflowTemplateId
  name: string
}

export type WorkflowTemplateId =
  | 'simple-chain'
  | 'review-chain'
  | 'implementation-review'
  | 'triage'
  | 'docs-update'

export interface BuiltWorkflowTemplate {
  nodes: Node<WorkflowNode['data']>[]
  edges: Edge[]
}

export const WORKFLOW_TEMPLATES: WorkflowTemplateSummary[] = [
  { id: 'simple-chain', name: 'Simple Chain' },
  { id: 'review-chain', name: 'Review Chain' },
  { id: 'implementation-review', name: 'Implementation Review' },
  { id: 'triage', name: 'Triage' },
  { id: 'docs-update', name: 'Docs Update' }
]

function node(
  id: string,
  label: string,
  prompt: string,
  model: string,
  position: { x: number; y: number },
  options: Partial<WorkflowNode['data']> = {}
): Node<WorkflowNode['data']> {
  return {
    id,
    type: 'agentNode',
    position,
    data: {
      provider: 'codex',
      model,
      label,
      prompt,
      systemInstruction: '',
      ...options
    }
  }
}

function edge(source: string, target: string): Edge {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
    type: 'animatedEdge'
  }
}

export function buildWorkflowTemplate(
  templateId: WorkflowTemplateId,
  model: string,
  seed = String(Date.now())
): BuiltWorkflowTemplate {
  const id = (suffix: string): string => `template-${templateId}-${seed}-${suffix}`

  switch (templateId) {
    case 'review-chain': {
      const draft = id('draft')
      const review = id('review')
      return {
        nodes: [
          node(
            draft,
            'Draft',
            'Produce the first version of the requested artifact and list assumptions.',
            model,
            { x: -300, y: -70 }
          ),
          node(
            review,
            'Human Review',
            'Review the upstream draft for correctness, missing evidence, and concrete revisions.',
            model,
            { x: 70, y: -70 },
            { humanReview: true }
          )
        ],
        edges: [edge(draft, review)]
      }
    }
    case 'implementation-review': {
      const plan = id('plan')
      const implement = id('implement')
      const review = id('review')
      return {
        nodes: [
          node(
            plan,
            'Plan',
            'Inspect the workspace and produce a scoped implementation plan with verification steps.',
            model,
            { x: -420, y: -90 }
          ),
          node(
            implement,
            'Implement',
            'Execute the accepted plan in the workspace and report changed files plus checks run.',
            model,
            { x: -40, y: -90 }
          ),
          node(
            review,
            'Review',
            'Review the implementation output for regressions, missed tests, and follow-up risk.',
            model,
            { x: 340, y: -90 },
            { humanReview: true }
          )
        ],
        edges: [edge(plan, implement), edge(implement, review)]
      }
    }
    case 'triage': {
      const reproduce = id('reproduce')
      const diagnose = id('diagnose')
      const fixPlan = id('fix')
      return {
        nodes: [
          node(
            reproduce,
            'Reproduce',
            'Inspect the issue context and identify the smallest reliable reproduction path.',
            model,
            { x: -420, y: -90 }
          ),
          node(
            diagnose,
            'Diagnose',
            'Use the reproduction notes to identify likely root causes and affected files.',
            model,
            { x: -40, y: -90 }
          ),
          node(
            fixPlan,
            'Fix Plan',
            'Write a prioritized fix plan with verification commands and rollback notes.',
            model,
            { x: 340, y: -90 }
          )
        ],
        edges: [edge(reproduce, diagnose), edge(diagnose, fixPlan)]
      }
    }
    case 'docs-update': {
      const scan = id('scan')
      const update = id('update')
      const verify = id('verify')
      return {
        nodes: [
          node(
            scan,
            'Scan Docs',
            'Find documentation that should change for the requested code or behavior update.',
            model,
            { x: -420, y: -90 }
          ),
          node(
            update,
            'Update Docs',
            'Draft the documentation update using repository style and cite changed paths.',
            model,
            { x: -40, y: -90 }
          ),
          node(
            verify,
            'Verify',
            'Check the doc update for stale claims, missing commands, and broken references.',
            model,
            { x: 340, y: -90 },
            { humanReview: true }
          )
        ],
        edges: [edge(scan, update), edge(update, verify)]
      }
    }
    case 'simple-chain':
    default: {
      const first = id('analyze')
      const second = id('report')
      return {
        nodes: [
          node(
            first,
            'Analyze',
            'Inspect the workspace context and summarize the next implementation step.',
            model,
            { x: -260, y: -60 }
          ),
          node(
            second,
            'Report',
            'Use the upstream output to write a concise execution report.',
            model,
            { x: 80, y: -60 }
          )
        ],
        edges: [edge(first, second)]
      }
    }
  }
}
