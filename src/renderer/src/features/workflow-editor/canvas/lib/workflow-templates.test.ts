import { describe, expect, it } from 'vitest'
import { buildWorkflowTemplate, WORKFLOW_TEMPLATES } from './workflow-templates'

describe('workflow templates', () => {
  it('ships five starter templates', () => {
    expect(WORKFLOW_TEMPLATES.map((template) => template.id)).toEqual([
      'simple-chain',
      'review-chain',
      'implementation-review',
      'triage',
      'docs-update'
    ])
  })

  it('builds deterministic Codex workflow graphs for each template', () => {
    for (const template of WORKFLOW_TEMPLATES) {
      const built = buildWorkflowTemplate(template.id, 'gpt-5.5', 'test')

      expect(built.nodes.length).toBeGreaterThanOrEqual(2)
      expect(built.edges.length).toBe(built.nodes.length - 1)
      expect(built.nodes.every((node) => node.data.provider === 'codex')).toBe(true)
      expect(built.nodes.every((node) => node.data.model === 'gpt-5.5')).toBe(true)
      expect(new Set(built.nodes.map((node) => node.id)).size).toBe(built.nodes.length)
      expect(
        built.edges.every((edge) => {
          const nodeIds = new Set(built.nodes.map((node) => node.id))
          return nodeIds.has(edge.source) && nodeIds.has(edge.target)
        })
      ).toBe(true)
    }
  })

  it('marks review-oriented templates with human review checkpoints', () => {
    const reviewTemplates = ['review-chain', 'implementation-review', 'docs-update'] as const

    for (const templateId of reviewTemplates) {
      const built = buildWorkflowTemplate(templateId, 'gpt-5.5', 'test')
      expect(built.nodes.some((node) => node.data.humanReview === true)).toBe(true)
    }
  })
})
