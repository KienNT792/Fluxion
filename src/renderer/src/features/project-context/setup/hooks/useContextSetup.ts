import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react'
import {
  buildSkippedProjectContextDraft,
  ContextSaveMode,
  ContextScanResult,
  normalizeProjectContextDraft,
  ProjectContextDraft,
  WorkspaceContextSavedPayload,
  WorkspaceContextStatus
} from '@shared'
import { ContextStepId, mergeScanIntoDraft, PreviewTab } from '../lib/context-setup-model'

interface UseContextSetupOptions {
  initialContext: ProjectContextDraft | null
  initialStatus: WorkspaceContextStatus
  onSaved: (payload: WorkspaceContextSavedPayload) => void
  workspacePath: string
}

export function useContextSetup({
  initialContext,
  initialStatus,
  onSaved,
  workspacePath
}: UseContextSetupOptions): {
  currentStep: ContextStepId
  draft: ProjectContextDraft
  handleSave: (mode: ContextSaveMode) => Promise<void>
  isLoading: boolean
  isSaving: boolean
  loadError: string | null
  previewTab: PreviewTab
  saveError: string | null
  scanResult: ContextScanResult | null
  setCurrentStep: Dispatch<SetStateAction<ContextStepId>>
  setPreviewTab: Dispatch<SetStateAction<PreviewTab>>
  updateDraft: (patch: Partial<ProjectContextDraft>) => void
} {
  const [currentStep, setCurrentStep] = useState<ContextStepId>('detect')
  const [previewTab, setPreviewTab] = useState<PreviewTab>('readable')
  const [scanResult, setScanResult] = useState<ContextScanResult | null>(null)
  const [draft, setDraft] = useState<ProjectContextDraft>(() =>
    mergeScanIntoDraft(workspacePath, null, initialContext, initialStatus)
  )
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let isCancelled = false

    const loadContext = async (): Promise<void> => {
      setCurrentStep('detect')
      setPreviewTab('readable')
      setIsLoading(true)
      setLoadError(null)
      setSaveError(null)

      try {
        const [nextScanResult, existingContext] = await Promise.all([
          window.api.scanWorkspaceContext(workspacePath),
          window.api.getContext(workspacePath)
        ])

        if (isCancelled) {
          return
        }

        setScanResult(nextScanResult)
        setDraft(
          mergeScanIntoDraft(
            workspacePath,
            nextScanResult,
            existingContext ?? initialContext,
            existingContext?.contextStatus ?? initialStatus
          )
        )
      } catch (error) {
        if (isCancelled) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Failed to read workspace signals. Switch to manual kickoff mode.'
        )
        setScanResult(null)
        setDraft(mergeScanIntoDraft(workspacePath, null, initialContext, initialStatus))
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadContext()

    return () => {
      isCancelled = true
    }
  }, [initialContext, initialStatus, workspacePath])

  const updateDraft = useCallback((patch: Partial<ProjectContextDraft>) => {
    setDraft((current) => normalizeProjectContextDraft({ ...current, ...patch }))
  }, [])

  const handleSave = useCallback(
    async (mode: ContextSaveMode) => {
      setIsSaving(true)
      setSaveError(null)

      try {
        const skippedAt = new Date().toISOString()
        const payloadDraft =
          mode === 'skip'
            ? normalizeProjectContextDraft({
                ...buildSkippedProjectContextDraft(draft, draft.workspaceType, draft.projectName),
                contextOnboarding: {
                  ...draft.contextOnboarding,
                  initialPromptDismissedAt: skippedAt
                }
              })
            : draft
        const result = await window.api.saveProjectContext(workspacePath, payloadDraft, mode)
        setDraft(result.context)
        onSaved(result)
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Failed to save project context.')
      } finally {
        setIsSaving(false)
      }
    },
    [draft, onSaved, workspacePath]
  )

  return {
    currentStep,
    draft,
    handleSave,
    isLoading,
    isSaving,
    loadError,
    previewTab,
    saveError,
    scanResult,
    setCurrentStep,
    setPreviewTab,
    updateDraft
  }
}
