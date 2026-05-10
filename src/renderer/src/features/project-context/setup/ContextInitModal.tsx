import React, { useMemo, useRef } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react'
import {
  formatProjectContextMarkdown,
  formatReadableProjectContext,
  isProjectContextReadyForFinalSave,
  ProjectContextDraft,
  WorkspaceContextSavedPayload,
  WorkspaceContextStatus
} from '@shared'
import { useModalFocusTrap } from '@renderer/lib/use-modal-focus-trap'
import { Button } from '@renderer/components/ui/Button'
import { StatusChip } from '@renderer/components/ui/StatusChip'
import { getCodexReadinessBadgeState } from '@renderer/lib/provider-capabilities'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { ContextSetupStepContent } from './components/ContextSetupStepContent'
import { PreviewTabButton } from './components/PreviewTabButton'
import { useAgentConfigPreview } from './hooks/useAgentConfigPreview'
import { useContextEnrichment } from './hooks/useContextEnrichment'
import { useOnboardingPacket } from './hooks/useOnboardingPacket'
import { useContextSetup } from './hooks/useContextSetup'
import {
  getContextStatusState,
  ContextStepId,
  getMissingRequirements,
  getStepState,
  getWorkspaceName,
  STEPS,
  STEP_STATE_TONE
} from './lib/context-setup-model'

interface ContextInitModalProps {
  workspacePath: string
  initialContext: ProjectContextDraft | null
  initialStatus: WorkspaceContextStatus
  initialStep?: ContextStepId
  onSaved: (payload: WorkspaceContextSavedPayload) => void
  onClose: () => void
}
export const ContextInitModal: React.FC<ContextInitModalProps> = ({
  workspacePath,
  initialContext,
  initialStatus,
  initialStep = 'detect',
  onSaved,
  onClose
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  useModalFocusTrap(true, dialogRef)
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities)

  const {
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
  } = useContextSetup({
    initialContext,
    initialStep,
    initialStatus,
    onSaved,
    workspacePath
  })
  const {
    agentConfigError,
    agentConfigExporters,
    agentConfigPreview,
    clearAgentConfigPreview,
    handleApplyAgentConfigPreview,
    handleCreateAgentConfigPreview,
    isApplyingAgentConfigPreview,
    isCreatingAgentConfigPreview
  } = useAgentConfigPreview({ draft, workspacePath })
  const {
    clearContextEnrichment,
    contextEnrichmentError,
    contextEnrichmentResult,
    handleAcceptContextEnrichment,
    handleRunContextEnrichment,
    isContextEnrichmentAvailable,
    isEnrichingContext
  } = useContextEnrichment({
    draft,
    scanResult,
    updateDraft,
    workspacePath
  })
  const {
    applyRepoSkillError,
    createdOnboardingWorkflowPath,
    clearOnboardingPacket,
    clearRepoSkillPreview,
    handleApplyOnboardingSuggestions,
    handleApplyRepoSkillPreview,
    handleCreateOnboardingWorkflow,
    handleCreateRepoSkillPreview,
    handleGenerateOnboardingPacket,
    handleSaveOnboardingPacket,
    isApplyingRepoSkillPreview,
    isCreatingOnboardingWorkflow,
    isCreatingRepoSkillPreview,
    isGeneratingOnboardingPacket,
    isSavingOnboardingPacket,
    onboardingPacket,
    onboardingPacketError,
    onboardingProgressStage,
    repoSkillPreview,
    savedOnboardingPacketPath
  } = useOnboardingPacket({
    draft,
    scanResult,
    updateDraft,
    workspacePath
  })

  const statusState = useMemo(
    () => getContextStatusState(draft.contextStatus),
    [draft.contextStatus]
  )
  const currentStepIndex = useMemo(
    () => STEPS.findIndex((step) => step.id === currentStep),
    [currentStep]
  )
  const missingRequirements = useMemo(() => getMissingRequirements(draft), [draft])
  const canSaveFinal = useMemo(() => isProjectContextReadyForFinalSave(draft), [draft])
  const workspaceName = useMemo(() => getWorkspaceName(workspacePath), [workspacePath])
  const previewMarkdown = useMemo(() => formatProjectContextMarkdown(draft), [draft])
  const previewReadable = useMemo(() => formatReadableProjectContext(draft), [draft])
  const previewJson = useMemo(() => JSON.stringify(draft, null, 2), [draft])
  const showCloseAction = initialStatus !== 'missing' && initialStatus !== 'legacy'
  const canExportAgentConfig = draft.contextStatus === 'ready'
  const saveContextTitle = canSaveFinal
    ? 'Save final project context'
    : missingRequirements.length > 0
      ? `Add ${missingRequirements.join(', ')} before saving final context.`
      : 'Complete required context before saving final context.'
  const codexReadiness = useMemo(
    () => getCodexReadinessBadgeState(providerCapabilities, []),
    [providerCapabilities]
  )
  const isCodexReady = Boolean(providerCapabilities.codex?.available) && !codexReadiness.blocking

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-5"
      style={{ background: 'rgba(38, 37, 30, 0.42)', backdropFilter: 'blur(8px)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Project Context Setup"
        tabIndex={-1}
        className="flex h-full max-h-[calc(100vh-40px)] w-full max-w-[1120px] flex-col overflow-hidden"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        <div
          className="flex shrink-0 items-start justify-between gap-4 px-6 py-5 relative z-10"
          style={{
            background: 'var(--color-canvas-soft)',
            borderBottom: '1px solid var(--color-hairline)'
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)'
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  className="text-lg font-semibold"
                  style={{ color: 'var(--color-ink)', letterSpacing: '-0.24px' }}
                >
                  Project Context Setup
                </h2>
                <StatusChip tone={statusState.tone} label={statusState.label} />
              </div>
              <p className="mt-1 text-sm leading-6" style={{ color: 'var(--color-body)' }}>
                Set the context your agents will actually run with for{' '}
                <span style={{ fontFamily: 'var(--font-mono)' }}>{workspaceName}</span>.
              </p>
            </div>
          </div>

          {showCloseAction ? (
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          ) : null}
        </div>

        <div
          className="grid min-h-0 flex-1 gap-0"
          style={{
            gridTemplateColumns:
              currentStep === 'review' ? '260px minmax(0, 1fr) 360px' : '260px minmax(0, 1fr) 0px',
            transition: 'grid-template-columns 300ms ease'
          }}
        >
          <aside
            className="border-r px-5 py-5"
            style={{ borderColor: 'var(--color-hairline)', background: 'var(--color-canvas)' }}
          >
            <div className="space-y-3">
              {STEPS.map((step, index) => {
                const stepState = getStepState(step.id, currentStep)
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setCurrentStep(step.id)}
                    className="w-full rounded-lg px-3 py-3 text-left transition-colors"
                    style={{
                      background:
                        stepState === 'active' ? 'var(--color-surface-card)' : 'transparent',
                      border: `1px solid ${
                        stepState === 'active' ? 'var(--color-hairline)' : 'transparent'
                      }`
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-full text-[11px]"
                          style={{
                            background: 'var(--color-canvas-soft)',
                            border: '1px solid var(--color-hairline)',
                            color: 'var(--color-ink)',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          {index + 1}
                        </span>
                        <span
                          className="text-sm font-semibold"
                          style={{ color: 'var(--color-ink)' }}
                        >
                          {step.label}
                        </span>
                      </div>
                      <StatusChip tone={STEP_STATE_TONE[stepState]} label={stepState} />
                    </div>
                    <p className="mt-2 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                      {step.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto px-6 pb-24 pt-5">
            {isLoading ? (
              <div className="flex h-full flex-col items-center justify-center gap-5 py-10 text-center">
                <Loader2
                  size={34}
                  className="animate-spin"
                  style={{ color: 'var(--color-primary)' }}
                />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                    Reading workspace signals
                  </p>
                  <p className="mt-2 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                    Fluxion is checking project manifests, source roots, workspace files, and
                    instructions before it drafts agent context.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {loadError ? (
                  <div
                    className="rounded-lg px-4 py-3"
                    style={{
                      background: '#fff8f2',
                      border: '1px solid var(--color-hairline)'
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={16} style={{ color: 'var(--color-timeline-done)' }} />
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                          Manual kickoff mode
                        </p>
                        <p
                          className="mt-1 text-xs leading-5"
                          style={{ color: 'var(--color-body)' }}
                        >
                          {loadError}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <ContextSetupStepContent
                  agentConfigError={agentConfigError}
                  agentConfigExporters={agentConfigExporters}
                  agentConfigPreview={agentConfigPreview}
                  applyRepoSkillError={applyRepoSkillError}
                  canExportAgentConfig={canExportAgentConfig}
                  canSaveFinal={canSaveFinal}
                  clearAgentConfigPreview={clearAgentConfigPreview}
                  clearOnboardingPacket={clearOnboardingPacket}
                  clearRepoSkillPreview={clearRepoSkillPreview}
                  codexReadinessDetail={codexReadiness.detail}
                  codexReadinessLabel={codexReadiness.label}
                  currentStep={currentStep}
                  draft={draft}
                  handleApplyOnboardingSuggestions={handleApplyOnboardingSuggestions}
                  handleApplyRepoSkillPreview={handleApplyRepoSkillPreview}
                  handleApplyAgentConfigPreview={handleApplyAgentConfigPreview}
                  handleAcceptContextEnrichment={handleAcceptContextEnrichment}
                  handleCreateAgentConfigPreview={handleCreateAgentConfigPreview}
                  handleCreateOnboardingWorkflow={handleCreateOnboardingWorkflow}
                  handleCreateRepoSkillPreview={handleCreateRepoSkillPreview}
                  handleGenerateOnboardingPacket={handleGenerateOnboardingPacket}
                  handleRunContextEnrichment={handleRunContextEnrichment}
                  handleSaveOnboardingPacket={handleSaveOnboardingPacket}
                  clearContextEnrichment={clearContextEnrichment}
                  contextEnrichmentError={contextEnrichmentError}
                  contextEnrichmentResult={contextEnrichmentResult}
                  createdOnboardingWorkflowPath={createdOnboardingWorkflowPath}
                  isApplyingAgentConfigPreview={isApplyingAgentConfigPreview}
                  isApplyingRepoSkillPreview={isApplyingRepoSkillPreview}
                  isCodexReady={isCodexReady}
                  isContextEnrichmentAvailable={isContextEnrichmentAvailable}
                  isCreatingOnboardingWorkflow={isCreatingOnboardingWorkflow}
                  isCreatingAgentConfigPreview={isCreatingAgentConfigPreview}
                  isCreatingRepoSkillPreview={isCreatingRepoSkillPreview}
                  isEnrichingContext={isEnrichingContext}
                  isGeneratingOnboardingPacket={isGeneratingOnboardingPacket}
                  isSavingOnboardingPacket={isSavingOnboardingPacket}
                  missingRequirements={missingRequirements}
                  onboardingPacket={onboardingPacket}
                  onboardingPacketError={onboardingPacketError}
                  onboardingProgressStage={onboardingProgressStage}
                  repoSkillPreview={repoSkillPreview}
                  savedOnboardingPacketPath={savedOnboardingPacketPath}
                  scanResult={scanResult}
                  statusState={statusState}
                  updateDraft={updateDraft}
                  workspaceName={workspaceName}
                />
              </div>
            )}
          </section>

          <aside
            className="flex min-h-0 flex-col border-l"
            style={{
              borderColor: currentStep === 'review' ? 'var(--color-hairline)' : 'transparent',
              background: 'var(--color-canvas-soft)',
              overflow: 'hidden',
              opacity: currentStep === 'review' ? 1 : 0,
              transition: 'opacity 300ms ease, border-color 300ms ease',
              pointerEvents: currentStep === 'review' ? 'auto' : 'none'
            }}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div>
                <span
                  className="text-[11px] uppercase tracking-[0.08em]"
                  style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  Agent Preview
                </span>
                <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                  This is the context Fluxion will pass to agents.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-5">
              <PreviewTabButton
                active={previewTab === 'readable'}
                onClick={() => setPreviewTab('readable')}
                label="Readable Brief"
              />
              <PreviewTabButton
                active={previewTab === 'markdown'}
                onClick={() => setPreviewTab('markdown')}
                label="global-context.md"
              />
              <PreviewTabButton
                active={previewTab === 'json'}
                onClick={() => setPreviewTab('json')}
                label="context.json"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {previewTab === 'readable' ? (
                <div
                  className="rounded-lg px-4 py-4"
                  style={{
                    background: 'var(--color-surface-card)',
                    border: '1px solid var(--color-hairline)'
                  }}
                >
                  <pre
                    className="whitespace-pre-wrap text-xs leading-6"
                    style={{ color: 'var(--color-body)', fontFamily: 'inherit' }}
                  >
                    {previewReadable}
                  </pre>
                </div>
              ) : null}

              {previewTab === 'markdown' ? (
                <div
                  className="rounded-lg px-4 py-4"
                  style={{
                    background: 'var(--color-surface-card)',
                    border: '1px solid var(--color-hairline)'
                  }}
                >
                  <pre
                    className="whitespace-pre-wrap text-[11px] leading-6"
                    style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}
                  >
                    {previewMarkdown}
                  </pre>
                </div>
              ) : null}

              {previewTab === 'json' ? (
                <div
                  className="rounded-lg px-4 py-4"
                  style={{
                    background: 'var(--color-surface-card)',
                    border: '1px solid var(--color-hairline)'
                  }}
                >
                  <pre
                    className="whitespace-pre-wrap text-[11px] leading-6"
                    style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}
                  >
                    {previewJson}
                  </pre>
                </div>
              ) : null}
            </div>
          </aside>
        </div>

        <div
          className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 py-4 relative z-10"
          style={{
            background: 'var(--color-surface-card)',
            borderTop: '1px solid var(--color-hairline)'
          }}
        >
          <div className="flex items-center gap-2">
            {currentStepIndex > 0 ? (
              <Button
                variant="secondary"
                onClick={() => setCurrentStep(STEPS[currentStepIndex - 1]?.id ?? 'detect')}
                disabled={isLoading || isSaving}
              >
                <ArrowLeft size={14} />
                Back
              </Button>
            ) : showCloseAction ? (
              <Button variant="secondary" onClick={onClose} disabled={isLoading || isSaving}>
                Close
              </Button>
            ) : null}

            <Button
              variant="ghost"
              onClick={() => void handleSave('skip')}
              disabled={isLoading || isSaving}
            >
              Set up later
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {saveError ? (
              <span className="text-xs" style={{ color: 'var(--color-semantic-error)' }}>
                {saveError}
              </span>
            ) : null}

            <Button
              variant="secondary"
              onClick={() => void handleSave('draft')}
              disabled={isLoading || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>

            <Button
              variant={currentStep === 'review' ? 'primary' : 'secondary'}
              onClick={() => void handleSave('final')}
              disabled={isLoading || isSaving || !canSaveFinal}
              title={saveContextTitle}
            >
              {isSaving ? 'Saving...' : 'Save Context'}
              {currentStep === 'review' ? <ArrowRight size={14} /> : null}
            </Button>

            {currentStep !== 'review' ? (
              <Button
                variant="primary"
                onClick={() => setCurrentStep(STEPS[currentStepIndex + 1]?.id ?? 'review')}
                disabled={isLoading || isSaving}
              >
                Next
                <ArrowRight size={14} />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
