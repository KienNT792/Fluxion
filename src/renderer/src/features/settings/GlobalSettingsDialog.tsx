import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { KeyRound } from 'lucide-react'
import { ProviderSettingsSummaryPayload } from '@shared'
import { getCodexReadinessBadgeState } from '@renderer/lib/provider-capabilities'
import { useModalFocusTrap } from '@renderer/lib/use-modal-focus-trap'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { Button } from '@renderer/components/ui/Button'
import { CodexCliSettingsSection } from './components/CodexCliSettingsSection'
import { OpenAiApiKeySection } from './components/OpenAiApiKeySection'
import { WorkflowPolicySection } from './components/WorkflowPolicySection'
import { CommandRow, getCodexCopy, getStatusCopy } from './lib/settings-copy'

interface GlobalSettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export const GlobalSettingsDialog: React.FC<GlobalSettingsDialogProps> = ({ isOpen, onClose }) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const fetchProviderCapabilities = useWorkflowStore((state) => state.fetchProviderCapabilities)
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities)
  const isProviderCapabilitiesLoading = useWorkflowStore(
    (state) => state.isProviderCapabilitiesLoading
  )
  const reviewModel = useWorkflowStore((state) => state.reviewModel)
  const serviceTier = useWorkflowStore((state) => state.serviceTier)
  const modelVerbosity = useWorkflowStore((state) => state.modelVerbosity)
  const modelReasoningSummary = useWorkflowStore((state) => state.modelReasoningSummary)
  const hideAgentReasoning = useWorkflowStore((state) => state.hideAgentReasoning)
  const showRawAgentReasoning = useWorkflowStore((state) => state.showRawAgentReasoning)
  const modelAutoCompactTokenLimit = useWorkflowStore((state) => state.modelAutoCompactTokenLimit)
  const modelContextWindow = useWorkflowStore((state) => state.modelContextWindow)
  const setWorkflowReviewModel = useWorkflowStore((state) => state.setWorkflowReviewModel)
  const setWorkflowServiceTier = useWorkflowStore((state) => state.setWorkflowServiceTier)
  const setWorkflowModelVerbosity = useWorkflowStore((state) => state.setWorkflowModelVerbosity)
  const setWorkflowModelReasoningSummary = useWorkflowStore(
    (state) => state.setWorkflowModelReasoningSummary
  )
  const setWorkflowHideAgentReasoning = useWorkflowStore(
    (state) => state.setWorkflowHideAgentReasoning
  )
  const setWorkflowShowRawAgentReasoning = useWorkflowStore(
    (state) => state.setWorkflowShowRawAgentReasoning
  )
  const setWorkflowModelAutoCompactTokenLimit = useWorkflowStore(
    (state) => state.setWorkflowModelAutoCompactTokenLimit
  )
  const setWorkflowModelContextWindow = useWorkflowStore(
    (state) => state.setWorkflowModelContextWindow
  )

  const [summary, setSummary] = useState<ProviderSettingsSummaryPayload | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCodexCommands, setShowCodexCommands] = useState(false)
  const [isApiKeyEditorOpen, setIsApiKeyEditorOpen] = useState(false)
  const [copiedCommandId, setCopiedCommandId] = useState<string | null>(null)

  const statusCopy = getStatusCopy(summary)
  const codexReadiness = getCodexReadinessBadgeState(providerCapabilities, [])
  const codexCopy = getCodexCopy(codexReadiness.tone, codexReadiness.detail)
  const modelOptions = (providerCapabilities.codex?.models ?? [])
    .filter((model) => model.visibility !== 'hide')
    .map((model) => ({
      id: model.id,
      label: model.displayName
    }))
  const canClearStoredKey = summary?.openaiApiKeySource === 'stored'
  const apiKeyActionLabel = summary?.openaiApiKeyConfigured ? 'Replace Key' : 'Add API Key'

  useEffect(() => {
    if (!isOpen) {
      const resetId = window.setTimeout(() => {
        setApiKeyInput('')
        setError(null)
        setIsApiKeyEditorOpen(false)
        setCopiedCommandId(null)
      }, 0)

      return () => window.clearTimeout(resetId)
    }

    let isCancelled = false

    const loadSummary = async (): Promise<void> => {
      if (!window.api?.getProviderSettingsSummary) {
        setSummary(null)
        setError('Settings API is not available.')
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const nextSummary = await window.api.getProviderSettingsSummary()
        if (!isCancelled) {
          setSummary(nextSummary)
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'Failed to load provider settings.'
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadSummary()

    return () => {
      isCancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      const syncId = window.setTimeout(() => {
        setShowCodexCommands(codexReadiness.blocking)
      }, 0)

      return () => window.clearTimeout(syncId)
    }

    return undefined
  }, [codexReadiness.blocking, isOpen])

  useModalFocusTrap(isOpen, dialogRef)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (isApiKeyEditorOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isApiKeyEditorOpen])

  if (!isOpen || typeof document === 'undefined') {
    return null
  }

  const handleRefreshCodex = async (): Promise<void> => {
    await fetchProviderCapabilities(true)
  }

  const handleCopyCommand = async (command: CommandRow): Promise<void> => {
    try {
      await navigator.clipboard.writeText(command.command)
      setCopiedCommandId(command.id)
      window.setTimeout(() => setCopiedCommandId(null), 1200)
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : 'Failed to copy command.')
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!window.api?.setOpenAIApiKey) {
      setError('Settings API is not available.')
      return
    }

    const normalizedApiKey = apiKeyInput.trim()
    if (!normalizedApiKey) {
      setError('Paste an OpenAI API key before saving.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const nextSummary = await window.api.setOpenAIApiKey(normalizedApiKey)
      setSummary(nextSummary)
      setApiKeyInput('')
      setIsApiKeyEditorOpen(false)
      await fetchProviderCapabilities()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Failed to save the OpenAI API key.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleClearStoredKey = async (): Promise<void> => {
    if (!window.api?.setOpenAIApiKey || !canClearStoredKey) {
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const nextSummary = await window.api.setOpenAIApiKey(null)
      setSummary(nextSummary)
      setApiKeyInput('')
      setIsApiKeyEditorOpen(false)
      await fetchProviderCapabilities()
    } catch (clearError) {
      setError(
        clearError instanceof Error
          ? clearError.message
          : 'Failed to clear the stored OpenAI API key.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center px-4 py-4"
      style={{ background: 'rgba(38, 37, 30, 0.4)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Global Settings"
        tabIndex={-1}
        className="flex max-h-[calc(100vh-32px)] w-full max-w-lg flex-col overflow-hidden rounded-lg"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)'
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-start gap-3 px-4 py-3 sm:px-5 sm:py-4"
          style={{ borderBottom: '1px solid var(--color-hairline)' }}
        >
          <div
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
            style={{
              background: 'var(--color-canvas-soft)',
              border: '1px solid var(--color-hairline)',
              color: 'var(--color-primary)'
            }}
          >
            <KeyRound size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              Global Settings
            </h3>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
              Codex CLI is the runtime for Fluxion workflows. OpenAI API credentials are optional
              and only needed for API provider features.
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
          <CodexCliSettingsSection
            codexCopy={codexCopy}
            codexReadiness={codexReadiness}
            copiedCommandId={copiedCommandId}
            isProviderCapabilitiesLoading={isProviderCapabilitiesLoading}
            isSaving={isSaving}
            showCodexCommands={showCodexCommands}
            setShowCodexCommands={setShowCodexCommands}
            onCopyCommand={(command) => void handleCopyCommand(command)}
            onRefreshCodex={() => void handleRefreshCodex()}
          />

          <WorkflowPolicySection
            reviewModel={reviewModel}
            serviceTier={serviceTier}
            modelVerbosity={modelVerbosity}
            modelReasoningSummary={modelReasoningSummary}
            hideAgentReasoning={hideAgentReasoning}
            showRawAgentReasoning={showRawAgentReasoning}
            modelAutoCompactTokenLimit={modelAutoCompactTokenLimit}
            modelContextWindow={modelContextWindow}
            modelOptions={modelOptions}
            onReviewModelChange={setWorkflowReviewModel}
            onServiceTierChange={setWorkflowServiceTier}
            onModelVerbosityChange={setWorkflowModelVerbosity}
            onModelReasoningSummaryChange={setWorkflowModelReasoningSummary}
            onHideAgentReasoningChange={setWorkflowHideAgentReasoning}
            onShowRawAgentReasoningChange={setWorkflowShowRawAgentReasoning}
            onModelAutoCompactTokenLimitChange={setWorkflowModelAutoCompactTokenLimit}
            onModelContextWindowChange={setWorkflowModelContextWindow}
          />

          <OpenAiApiKeySection
            apiKeyActionLabel={apiKeyActionLabel}
            apiKeyInput={apiKeyInput}
            canClearStoredKey={canClearStoredKey}
            inputRef={inputRef}
            isApiKeyEditorOpen={isApiKeyEditorOpen}
            isLoading={isLoading}
            isSaving={isSaving}
            statusCopy={statusCopy}
            summary={summary}
            setApiKeyInput={setApiKeyInput}
            setError={setError}
            setIsApiKeyEditorOpen={setIsApiKeyEditorOpen}
            onClearStoredKey={() => void handleClearStoredKey()}
            onSave={() => void handleSave()}
          />
          {error && (
            <div
              className="rounded-md px-3 py-2 text-xs"
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: 'var(--color-semantic-error)'
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          className="flex shrink-0 items-center justify-end gap-2 px-4 py-3 sm:px-5 sm:py-4"
          style={{ borderTop: '1px solid var(--color-hairline)' }}
        >
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
