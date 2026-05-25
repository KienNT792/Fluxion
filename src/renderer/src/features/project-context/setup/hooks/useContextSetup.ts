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
  initialStep?: ContextStepId
  initialStatus: WorkspaceContextStatus
  onSaved: (payload: WorkspaceContextSavedPayload) => void
  workspacePath: string
}

export function useContextSetup({
  initialContext,
  initialStep = 'detect',
  initialStatus,
  onSaved,
  workspacePath
}: UseContextSetupOptions): {
  currentStep: ContextStepId
  draft: ProjectContextDraft
  globalContext: string
  handleSave: (mode: ContextSaveMode) => Promise<void>
  handleSaveWorkspaceMemory: () => Promise<void>
  isLoading: boolean
  isSaving: boolean
  isSavingWorkspaceMemory: boolean
  loadError: string | null
  longTermIndex: string
  previewTab: PreviewTab
  saveError: string | null
  scanResult: ContextScanResult | null
  setCurrentStep: Dispatch<SetStateAction<ContextStepId>>
  setPreviewTab: Dispatch<SetStateAction<PreviewTab>>
  setGlobalContext: Dispatch<SetStateAction<string>>
  setLongTermIndex: Dispatch<SetStateAction<string>>
  updateDraft: (patch: Partial<ProjectContextDraft>) => void
} {
  const [currentStep, setCurrentStep] = useState<ContextStepId>(initialStep)
  const [previewTab, setPreviewTab] = useState<PreviewTab>('readable')
  const [scanResult, setScanResult] = useState<ContextScanResult | null>(null)
  const [draft, setDraft] = useState<ProjectContextDraft>(() =>
    mergeScanIntoDraft(workspacePath, null, initialContext, initialStatus)
  )
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [globalContext, setGlobalContext] = useState('')
  const [longTermIndex, setLongTermIndex] = useState('')
  const [isSavingWorkspaceMemory, setIsSavingWorkspaceMemory] = useState(false)

  useEffect(() => {
    let isCancelled = false

    const loadContext = async (): Promise<void> => {
      setCurrentStep(initialStep)
      setPreviewTab('readable')
      setIsLoading(true)
      setLoadError(null)
      setSaveError(null)

      try {
        const [nextScanResult, existingContext, memoryFiles] = await Promise.all([
          window.api.scanWorkspaceContext(workspacePath),
          window.api.getContext(workspacePath),
          window.api.readWorkspaceMemoryFiles(workspacePath)
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
        setGlobalContext(memoryFiles.globalContext)
        setLongTermIndex(memoryFiles.longTermIndex)
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
        setGlobalContext('')
        setLongTermIndex('')
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
  }, [initialContext, initialStatus, initialStep, workspacePath])

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

  const handleSaveWorkspaceMemory = useCallback(async () => {
    setIsSavingWorkspaceMemory(true)
    setSaveError(null)

    try {
      await window.api.saveWorkspaceMemoryFiles({
        workspacePath,
        globalContext,
        longTermIndex
      })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save workspace memory.')
    } finally {
      setIsSavingWorkspaceMemory(false)
    }
  }, [globalContext, longTermIndex, workspacePath])

  return {
    currentStep,
    draft,
    handleSave,
    isLoading,
    isSaving,
    loadError,
    globalContext,
    longTermIndex,
    previewTab,
    saveError,
    scanResult,
    setCurrentStep,
    setPreviewTab,
    handleSaveWorkspaceMemory,
    isSavingWorkspaceMemory,
    setGlobalContext,
    setLongTermIndex,
    updateDraft
  }
}
