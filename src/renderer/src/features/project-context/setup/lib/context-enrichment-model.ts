import type { ContextEnrichmentField, ContextEnrichmentResult, ProjectContextDraft } from '@shared'

export const CONTEXT_ENRICHMENT_FIELDS: ContextEnrichmentField[] = [
  'projectGoal',
  'targetUsers',
  'architectureSummary',
  'stableRules',
  'focusAreas',
  'openQuestions',
  'recommendedFirstActions'
]

export const CONTEXT_ENRICHMENT_FIELD_LABELS: Record<ContextEnrichmentField, string> = {
  projectGoal: 'Project goal',
  targetUsers: 'Target users',
  architectureSummary: 'Architecture summary',
  stableRules: 'Stable rules',
  focusAreas: 'Focus areas',
  openQuestions: 'Open questions',
  recommendedFirstActions: 'Recommended first actions'
}

const LIST_FIELDS = new Set<ContextEnrichmentField>([
  'stableRules',
  'focusAreas',
  'openQuestions',
  'recommendedFirstActions'
])

export interface ContextEnrichmentChange {
  field: ContextEnrichmentField
  label: string
  currentValue: string
  suggestedValue: string
  isListField: boolean
}

function uniqueList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function valuesMatch(left: string, right: string): boolean {
  return left.trim().replace(/\r\n/g, '\n') === right.trim().replace(/\r\n/g, '\n')
}

function formatValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map((item) => `- ${item}`).join('\n') : ''
  }

  return value?.trim() ?? ''
}

function isListField(field: ContextEnrichmentField): boolean {
  return LIST_FIELDS.has(field)
}

function getDraftValue(
  draft: ProjectContextDraft,
  field: ContextEnrichmentField
): string | string[] {
  return draft[field]
}

export function getContextEnrichmentChanges(
  draft: ProjectContextDraft,
  result: ContextEnrichmentResult | null
): ContextEnrichmentChange[] {
  if (!result) {
    return []
  }

  return CONTEXT_ENRICHMENT_FIELDS.flatMap((field) => {
    const suggested = result.suggestedFields[field]
    if (suggested === undefined) {
      return []
    }

    const currentValue = formatValue(getDraftValue(draft, field))
    const suggestedValue = formatValue(suggested)
    if (!suggestedValue || valuesMatch(currentValue, suggestedValue)) {
      return []
    }

    return [
      {
        field,
        label: CONTEXT_ENRICHMENT_FIELD_LABELS[field],
        currentValue,
        suggestedValue,
        isListField: isListField(field)
      }
    ]
  })
}

export function buildContextEnrichmentPatch(
  draft: ProjectContextDraft,
  result: ContextEnrichmentResult,
  fields: ContextEnrichmentField[]
): Partial<ProjectContextDraft> {
  const fieldSet = new Set(fields)
  const patch: Partial<ProjectContextDraft> = {}

  for (const field of CONTEXT_ENRICHMENT_FIELDS) {
    if (!fieldSet.has(field)) {
      continue
    }

    const suggested = result.suggestedFields[field]
    if (suggested === undefined) {
      continue
    }

    if (Array.isArray(suggested)) {
      const current = getDraftValue(draft, field)
      const currentList = Array.isArray(current) ? current : []
      patch[field] = uniqueList([...currentList, ...suggested]) as never
      continue
    }

    const normalized = suggested.trim()
    if (normalized) {
      patch[field] = normalized as never
    }
  }

  const acceptedEvidence = result.sourceEvidence.filter((evidence) =>
    fieldSet.has(evidence.field as ContextEnrichmentField)
  )
  if (acceptedEvidence.length > 0) {
    const seen = new Set(draft.sourceEvidence.map((evidence) => evidence.id ?? ''))
    patch.sourceEvidence = [
      ...draft.sourceEvidence,
      ...acceptedEvidence.filter((evidence) => {
        if (!evidence.id || seen.has(evidence.id)) {
          return false
        }
        seen.add(evidence.id)
        return true
      })
    ]
  }

  return patch
}

export function removeContextEnrichmentFields(
  result: ContextEnrichmentResult,
  fields: ContextEnrichmentField[]
): ContextEnrichmentResult | null {
  const fieldSet = new Set(fields)
  const suggestedFields = { ...result.suggestedFields }

  for (const field of fields) {
    delete suggestedFields[field]
  }

  const hasRemainingFields = Object.values(suggestedFields).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value?.trim())
  )
  if (!hasRemainingFields) {
    return null
  }

  return {
    ...result,
    suggestedFields,
    sourceEvidence: result.sourceEvidence.filter(
      (evidence) => !fieldSet.has(evidence.field as ContextEnrichmentField)
    )
  }
}
