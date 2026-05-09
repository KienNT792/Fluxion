import { useCallback, useEffect, useState } from 'react'
import {
  AgentConfigExportPreview,
  AgentConfigExporterId,
  AgentConfigExporterSummary,
  ProjectContextDraft
} from '@shared'

interface UseAgentConfigPreviewOptions {
  draft: ProjectContextDraft
  workspacePath: string
}

export function useAgentConfigPreview({ draft, workspacePath }: UseAgentConfigPreviewOptions): {
  agentConfigError: string | null
  agentConfigExporters: AgentConfigExporterSummary[]
  agentConfigPreview: AgentConfigExportPreview | null
  clearAgentConfigPreview: () => void
  handleApplyAgentConfigPreview: () => Promise<void>
  handleCreateAgentConfigPreview: (
    exporterId: AgentConfigExporterId,
    includeAdvancedConfig?: boolean
  ) => Promise<void>
  isApplyingAgentConfigPreview: boolean
  isCreatingAgentConfigPreview: boolean
} {
  const [agentConfigExporters, setAgentConfigExporters] = useState<AgentConfigExporterSummary[]>([])
  const [agentConfigPreview, setAgentConfigPreview] = useState<AgentConfigExportPreview | null>(
    null
  )
  const [agentConfigError, setAgentConfigError] = useState<string | null>(null)
  const [isCreatingAgentConfigPreview, setIsCreatingAgentConfigPreview] = useState(false)
  const [isApplyingAgentConfigPreview, setIsApplyingAgentConfigPreview] = useState(false)

  useEffect(() => {
    let isCancelled = false

    const loadExporters = async (): Promise<void> => {
      try {
        const exporters = await window.api.listAgentConfigExporters()
        if (!isCancelled) {
          setAgentConfigExporters(exporters)
        }
      } catch {
        if (!isCancelled) {
          setAgentConfigExporters([])
        }
      }
    }

    void loadExporters()

    return () => {
      isCancelled = true
    }
  }, [])

  const handleCreateAgentConfigPreview = useCallback(
    async (exporterId: AgentConfigExporterId, includeAdvancedConfig = false) => {
      setIsCreatingAgentConfigPreview(true)
      setAgentConfigError(null)

      try {
        const preview = await window.api.createAgentConfigPreview({
          workspacePath,
          exporterId,
          context: draft,
          options: { includeAdvancedConfig }
        })
        setAgentConfigPreview(preview)
      } catch (error) {
        setAgentConfigError(
          error instanceof Error ? error.message : 'Failed to create agent config preview.'
        )
      } finally {
        setIsCreatingAgentConfigPreview(false)
      }
    },
    [draft, workspacePath]
  )

  const handleApplyAgentConfigPreview = useCallback(async () => {
    if (!agentConfigPreview) {
      return
    }

    setIsApplyingAgentConfigPreview(true)
    setAgentConfigError(null)

    try {
      await window.api.applyAgentConfigPreview({ preview: agentConfigPreview })
      setAgentConfigPreview(null)
    } catch (error) {
      setAgentConfigError(
        error instanceof Error ? error.message : 'Failed to apply agent config preview.'
      )
    } finally {
      setIsApplyingAgentConfigPreview(false)
    }
  }, [agentConfigPreview])

  return {
    agentConfigError,
    agentConfigExporters,
    agentConfigPreview,
    clearAgentConfigPreview: () => setAgentConfigPreview(null),
    handleApplyAgentConfigPreview,
    handleCreateAgentConfigPreview,
    isApplyingAgentConfigPreview,
    isCreatingAgentConfigPreview
  }
}
