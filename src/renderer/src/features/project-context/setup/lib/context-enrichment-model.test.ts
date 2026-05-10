import { describe, expect, it } from 'vitest'
import type { ContextEnrichmentResult } from '@shared'
import { normalizeProjectContextDraft } from '@shared'
import {
  buildContextEnrichmentPatch,
  getContextEnrichmentChanges,
  removeContextEnrichmentFields
} from './context-enrichment-model'

describe('context-enrichment-model', () => {
  const draft = normalizeProjectContextDraft({
    workspaceType: 'existing',
    projectName: 'Fluxion',
    projectGoal: 'Old goal',
    focusAreas: ['runtime'],
    sourceEvidence: []
  })
  const result: ContextEnrichmentResult = {
    suggestedFields: {
      projectGoal: 'Build visual Codex CLI workflows.',
      focusAreas: ['runtime', 'project context']
    },
    sourceEvidence: [
      {
        id: 'codex-enrichment-projectGoal-1',
        field: 'projectGoal',
        sourcePath: 'README.md',
        confidence: 'high',
        detectorId: 'codex-context-enrichment',
        note: 'README describes the goal.'
      },
      {
        id: 'codex-enrichment-focusAreas-2',
        field: 'focusAreas',
        sourcePath: 'README.md',
        confidence: 'medium',
        detectorId: 'codex-context-enrichment',
        note: 'README mentions context setup.'
      }
    ],
    diagnostics: {
      generatedAt: '2026-01-02T00:00:00.000Z',
      model: 'gpt-5.5',
      filesRead: 1,
      truncatedFiles: [],
      warnings: []
    }
  }

  it('builds review changes for fields that differ from the draft', () => {
    const changes = getContextEnrichmentChanges(draft, result)

    expect(changes.map((change) => change.field)).toEqual(['projectGoal', 'focusAreas'])
    expect(changes[1]?.suggestedValue).toContain('- project context')
  })

  it('merges list suggestions while replacing scalar suggestions', () => {
    const patch = buildContextEnrichmentPatch(draft, result, ['projectGoal', 'focusAreas'])

    expect(patch.projectGoal).toBe('Build visual Codex CLI workflows.')
    expect(patch.focusAreas).toEqual(['runtime', 'project context'])
    expect(patch.sourceEvidence).toHaveLength(2)
  })

  it('removes accepted fields from a pending enrichment result', () => {
    const pending = removeContextEnrichmentFields(result, ['projectGoal'])

    expect(pending?.suggestedFields.projectGoal).toBeUndefined()
    expect(pending?.suggestedFields.focusAreas).toEqual(['runtime', 'project context'])
    expect(pending?.sourceEvidence.map((evidence) => evidence.field)).toEqual(['focusAreas'])
  })
})
