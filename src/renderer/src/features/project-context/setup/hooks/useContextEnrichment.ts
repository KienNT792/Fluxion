import { useCallback, useState } from 'react'
import type {
  ContextEnrichmentField,
  ContextEnrichmentResult,
  ContextScanResult,
  ProjectContextDraft
} from '@shared'
import {
  buildContextEnrichmentPatch,
  CONTEXT_ENRICHMENT_FIELDS,
  removeContextEnrichmentFields
} from '../lib/context-enrichment-model'

interface UseContextEnrichmentOptions {
  draft: ProjectContextDraft
  scanResult: ContextScanResult | null
  updateDraft: (patch: Partial<ProjectContextDraft>) => void
  workspacePath: string
}

interface UseContextEnrichmentResult {
  clearContextEnrichment: () => void
  contextEnrichmentError: string | null
  contextEnrichmentResult: ContextEnrichmentResult | null
  handleAcceptContextEnrichment: (fields?: ContextEnrichmentField[]) => void
  handleRunContextEnrichment: () => Promise<void>
  isEnrichingContext: boolean
}

export function useContextEnrichment({
  draft,
  scanResult,
  updateDraft,
  workspacePath
}: UseContextEnrichmentOptions): UseContextEnrichmentResult {
  const [contextEnrichmentResult, setContextEnrichmentResult] =
    useState<ContextEnrichmentResult | null>(null)
  const [contextEnrichmentError, setContextEnrichmentError] = useState<string | null>(null)
  const [isEnrichingContext, setIsEnrichingContext] = useState(false)

  const clearContextEnrichment = useCallback(() => {
    setContextEnrichmentResult(null)
    setContextEnrichmentError(null)
  }, [])

  const handleRunContextEnrichment = useCallback(async () => {
    setIsEnrichingContext(true)
    setContextEnrichmentError(null)

    try {
      const result = await window.api.enrichProjectContext({
        workspacePath,
        draft,
        scanResult
      })
      setContextEnrichmentResult(result)
    } catch (error) {
      setContextEnrichmentError(error instanceof Error ? error.message : 'Codex enrichment failed.')
    } finally {
      setIsEnrichingContext(false)
    }
  }, [draft, scanResult, workspacePath])

  const handleAcceptContextEnrichment = useCallback(
    (fields: ContextEnrichmentField[] = CONTEXT_ENRICHMENT_FIELDS) => {
      if (!contextEnrichmentResult) {
        return
      }

      updateDraft(buildContextEnrichmentPatch(draft, contextEnrichmentResult, fields))
      setContextEnrichmentResult(removeContextEnrichmentFields(contextEnrichmentResult, fields))
    },
    [contextEnrichmentResult, draft, updateDraft]
  )

  return {
    clearContextEnrichment,
    contextEnrichmentError,
    contextEnrichmentResult,
    handleAcceptContextEnrichment,
    handleRunContextEnrichment,
    isEnrichingContext
  }
}
