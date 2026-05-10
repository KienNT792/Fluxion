import { useCallback, useState } from 'react'
import type {
  ContextScanResult,
  OnboardingGenerationMode,
  OnboardingPacket,
  ProjectContextDraft,
  RepoOnboardingSkillPreview
} from '@shared'
import { buildOnboardingContextPatch } from '../lib/onboarding-packet-model'

type OnboardingProgressStage = 'idle' | 'reading' | 'mapping' | 'reviewing' | 'done'

interface UseOnboardingPacketOptions {
  draft: ProjectContextDraft
  scanResult: ContextScanResult | null
  updateDraft: (patch: Partial<ProjectContextDraft>) => void
  workspacePath: string
}

interface UseOnboardingPacketResult {
  applyRepoSkillError: string | null
  createdOnboardingWorkflowPath: string | null
  isApplyingRepoSkillPreview: boolean
  isCreatingOnboardingWorkflow: boolean
  isCreatingRepoSkillPreview: boolean
  isGeneratingOnboardingPacket: boolean
  isSavingOnboardingPacket: boolean
  onboardingPacket: OnboardingPacket | null
  onboardingPacketError: string | null
  onboardingProgressStage: OnboardingProgressStage
  repoSkillPreview: RepoOnboardingSkillPreview | null
  savedOnboardingPacketPath: string | null
  clearOnboardingPacket: () => void
  clearRepoSkillPreview: () => void
  handleApplyOnboardingSuggestions: () => void
  handleApplyRepoSkillPreview: () => Promise<void>
  handleCreateOnboardingWorkflow: () => Promise<void>
  handleCreateRepoSkillPreview: () => Promise<void>
  handleGenerateOnboardingPacket: (mode: OnboardingGenerationMode) => Promise<void>
  handleSaveOnboardingPacket: () => Promise<void>
}

const PRELOAD_BRIDGE_MISSING_MESSAGE =
  'Onboarding is not available in the current app session. Restart Fluxion to load the updated preload bridge.'

function hasOnboardingBridge(): boolean {
  return (
    typeof (window.api as { generateOnboardingPacket?: unknown } | undefined)
      ?.generateOnboardingPacket === 'function'
  )
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function useOnboardingPacket({
  draft,
  scanResult,
  updateDraft,
  workspacePath
}: UseOnboardingPacketOptions): UseOnboardingPacketResult {
  const [onboardingPacket, setOnboardingPacket] = useState<OnboardingPacket | null>(null)
  const [onboardingPacketError, setOnboardingPacketError] = useState<string | null>(null)
  const [onboardingProgressStage, setOnboardingProgressStage] =
    useState<OnboardingProgressStage>('idle')
  const [isGeneratingOnboardingPacket, setIsGeneratingOnboardingPacket] = useState(false)
  const [isSavingOnboardingPacket, setIsSavingOnboardingPacket] = useState(false)
  const [savedOnboardingPacketPath, setSavedOnboardingPacketPath] = useState<string | null>(null)
  const [isCreatingOnboardingWorkflow, setIsCreatingOnboardingWorkflow] = useState(false)
  const [createdOnboardingWorkflowPath, setCreatedOnboardingWorkflowPath] = useState<string | null>(
    null
  )
  const [isCreatingRepoSkillPreview, setIsCreatingRepoSkillPreview] = useState(false)
  const [isApplyingRepoSkillPreview, setIsApplyingRepoSkillPreview] = useState(false)
  const [repoSkillPreview, setRepoSkillPreview] = useState<RepoOnboardingSkillPreview | null>(null)
  const [applyRepoSkillError, setApplyRepoSkillError] = useState<string | null>(null)

  const clearOnboardingPacket = useCallback(() => {
    setOnboardingPacket(null)
    setOnboardingPacketError(null)
    setOnboardingProgressStage('idle')
    setSavedOnboardingPacketPath(null)
  }, [])

  const clearRepoSkillPreview = useCallback(() => {
    setRepoSkillPreview(null)
    setApplyRepoSkillError(null)
  }, [])

  const handleGenerateOnboardingPacket = useCallback(
    async (mode: OnboardingGenerationMode) => {
      if (!hasOnboardingBridge()) {
        setOnboardingPacketError(PRELOAD_BRIDGE_MISSING_MESSAGE)
        return
      }

      const timers = [
        window.setTimeout(() => setOnboardingProgressStage('mapping'), 800),
        window.setTimeout(() => setOnboardingProgressStage('reviewing'), 1800)
      ]

      setIsGeneratingOnboardingPacket(true)
      setOnboardingPacketError(null)
      setOnboardingProgressStage('reading')
      setSavedOnboardingPacketPath(null)

      try {
        const packet = await window.api.generateOnboardingPacket({
          workspacePath,
          draft,
          scanResult,
          mode
        })
        setOnboardingPacket(packet)
        setOnboardingProgressStage('done')
      } catch (error) {
        setOnboardingPacketError(
          getErrorMessage(
            error,
            mode === 'codex-assisted'
              ? 'Codex onboarding failed.'
              : 'Failed to build onboarding packet from scan.'
          )
        )
        setOnboardingProgressStage('idle')
      } finally {
        timers.forEach((timer) => window.clearTimeout(timer))
        setIsGeneratingOnboardingPacket(false)
      }
    },
    [draft, scanResult, workspacePath]
  )

  const handleApplyOnboardingSuggestions = useCallback(() => {
    if (!onboardingPacket) {
      return
    }

    updateDraft(buildOnboardingContextPatch(draft, onboardingPacket))
  }, [draft, onboardingPacket, updateDraft])

  const handleSaveOnboardingPacket = useCallback(async () => {
    if (!onboardingPacket) {
      return
    }

    setIsSavingOnboardingPacket(true)
    setOnboardingPacketError(null)

    try {
      const result = await window.api.saveOnboardingPacket({
        workspacePath,
        packet: onboardingPacket
      })
      setSavedOnboardingPacketPath(result.filePath)
    } catch (error) {
      setOnboardingPacketError(getErrorMessage(error, 'Failed to save onboarding packet.'))
    } finally {
      setIsSavingOnboardingPacket(false)
    }
  }, [onboardingPacket, workspacePath])

  const handleCreateOnboardingWorkflow = useCallback(async () => {
    setIsCreatingOnboardingWorkflow(true)
    setOnboardingPacketError(null)

    try {
      const result = await window.api.createOnboardingWorkflow({
        workspacePath,
        packet: onboardingPacket
      })
      setCreatedOnboardingWorkflowPath(result.workflowFilePath)
    } catch (error) {
      setOnboardingPacketError(getErrorMessage(error, 'Failed to create onboarding workflow.'))
    } finally {
      setIsCreatingOnboardingWorkflow(false)
    }
  }, [onboardingPacket, workspacePath])

  const handleCreateRepoSkillPreview = useCallback(async () => {
    if (!onboardingPacket) {
      return
    }

    setIsCreatingRepoSkillPreview(true)
    setApplyRepoSkillError(null)

    try {
      const preview = await window.api.createRepoOnboardingSkillPreview({
        workspacePath,
        packet: onboardingPacket,
        context: draft
      })
      setRepoSkillPreview(preview)
    } catch (error) {
      setApplyRepoSkillError(getErrorMessage(error, 'Failed to preview repo-local skill.'))
    } finally {
      setIsCreatingRepoSkillPreview(false)
    }
  }, [draft, onboardingPacket, workspacePath])

  const handleApplyRepoSkillPreview = useCallback(async () => {
    if (!repoSkillPreview) {
      return
    }

    setIsApplyingRepoSkillPreview(true)
    setApplyRepoSkillError(null)

    try {
      await window.api.applyRepoOnboardingSkillPreview({ preview: repoSkillPreview })
      setRepoSkillPreview(null)
    } catch (error) {
      setApplyRepoSkillError(getErrorMessage(error, 'Failed to apply repo-local skill preview.'))
    } finally {
      setIsApplyingRepoSkillPreview(false)
    }
  }, [repoSkillPreview])

  return {
    applyRepoSkillError,
    createdOnboardingWorkflowPath,
    isApplyingRepoSkillPreview,
    isCreatingOnboardingWorkflow,
    isCreatingRepoSkillPreview,
    isGeneratingOnboardingPacket,
    isSavingOnboardingPacket,
    onboardingPacket,
    onboardingPacketError,
    onboardingProgressStage,
    repoSkillPreview,
    savedOnboardingPacketPath,
    clearOnboardingPacket,
    clearRepoSkillPreview,
    handleApplyOnboardingSuggestions,
    handleApplyRepoSkillPreview,
    handleCreateOnboardingWorkflow,
    handleCreateRepoSkillPreview,
    handleGenerateOnboardingPacket,
    handleSaveOnboardingPacket
  }
}
