import React from 'react'
import type {
  AgentConfigExportPreview,
  AgentConfigExporterId,
  AgentConfigExporterSummary,
  ContextEnrichmentField,
  ContextEnrichmentResult,
  ContextScanResult,
  OnboardingGenerationMode,
  OnboardingPacket,
  ProjectContextDraft
} from '@shared'
import type { StatusChipTone } from '@renderer/components/ui/StatusChip'
import { ContextSetupBriefStep } from './ContextSetupBriefStep'
import { ContextSetupDetectStep } from './ContextSetupDetectStep'
import { ContextSetupFocusStep } from './ContextSetupFocusStep'
import { ContextSetupOnboardingStep } from './ContextSetupOnboardingStep'
import { ContextSetupReviewStep } from './ContextSetupReviewStep'
import { ContextSetupRulesStep } from './ContextSetupRulesStep'
import type { RepoOnboardingSkillPreview } from '@shared'
import type { ContextStepId } from '../lib/context-setup-model'

interface ContextSetupStepContentProps {
  agentConfigError: string | null
  agentConfigExporters: AgentConfigExporterSummary[]
  agentConfigPreview: AgentConfigExportPreview | null
  applyRepoSkillError: string | null
  canExportAgentConfig: boolean
  canSaveFinal: boolean
  clearContextEnrichment: () => void
  clearAgentConfigPreview: () => void
  clearOnboardingPacket: () => void
  clearRepoSkillPreview: () => void
  codexReadinessDetail: string
  codexReadinessLabel: string
  contextEnrichmentError: string | null
  contextEnrichmentResult: ContextEnrichmentResult | null
  createdOnboardingWorkflowPath: string | null
  currentStep: ContextStepId
  draft: ProjectContextDraft
  globalContext: string
  handleApplyOnboardingSuggestions: () => void
  handleApplyRepoSkillPreview: () => Promise<void>
  handleAcceptContextEnrichment: (fields?: ContextEnrichmentField[]) => void
  handleApplyAgentConfigPreview: () => Promise<void>
  handleCreateAgentConfigPreview: (
    exporterId: AgentConfigExporterId,
    includeAdvancedConfig?: boolean
  ) => Promise<void>
  handleCreateOnboardingWorkflow: () => Promise<void>
  handleCreateRepoSkillPreview: () => Promise<void>
  handleGenerateOnboardingPacket: (mode: OnboardingGenerationMode) => Promise<void>
  handleRunContextEnrichment: () => Promise<void>
  handleSaveOnboardingPacket: () => Promise<void>
  handleSaveWorkspaceMemory: () => Promise<void>
  isApplyingAgentConfigPreview: boolean
  isApplyingRepoSkillPreview: boolean
  isCodexReady: boolean
  isContextEnrichmentAvailable: boolean
  isCreatingOnboardingWorkflow: boolean
  isCreatingAgentConfigPreview: boolean
  isCreatingRepoSkillPreview: boolean
  isEnrichingContext: boolean
  isGeneratingOnboardingPacket: boolean
  isSavingOnboardingPacket: boolean
  isSavingWorkspaceMemory: boolean
  missingRequirements: string[]
  onboardingPacket: OnboardingPacket | null
  onboardingPacketError: string | null
  onboardingProgressStage: 'idle' | 'reading' | 'mapping' | 'reviewing' | 'done'
  longTermIndex: string
  repoSkillPreview: RepoOnboardingSkillPreview | null
  savedOnboardingPacketPath: string | null
  scanResult: ContextScanResult | null
  statusState: {
    detail: string
    label: string
    tone: StatusChipTone
  }
  setGlobalContext: (value: string) => void
  setLongTermIndex: (value: string) => void
  updateDraft: (patch: Partial<ProjectContextDraft>) => void
  workspaceName: string
}

export function ContextSetupStepContent({
  agentConfigError,
  agentConfigExporters,
  agentConfigPreview,
  applyRepoSkillError,
  canExportAgentConfig,
  canSaveFinal,
  clearOnboardingPacket,
  clearRepoSkillPreview,
  codexReadinessDetail,
  codexReadinessLabel,
  clearContextEnrichment,
  clearAgentConfigPreview,
  contextEnrichmentError,
  contextEnrichmentResult,
  createdOnboardingWorkflowPath,
  currentStep,
  draft,
  globalContext,
  handleApplyOnboardingSuggestions,
  handleApplyRepoSkillPreview,
  handleAcceptContextEnrichment,
  handleApplyAgentConfigPreview,
  handleCreateAgentConfigPreview,
  handleCreateOnboardingWorkflow,
  handleCreateRepoSkillPreview,
  handleGenerateOnboardingPacket,
  handleRunContextEnrichment,
  handleSaveOnboardingPacket,
  handleSaveWorkspaceMemory,
  isApplyingAgentConfigPreview,
  isApplyingRepoSkillPreview,
  isCodexReady,
  isContextEnrichmentAvailable,
  isCreatingOnboardingWorkflow,
  isCreatingAgentConfigPreview,
  isCreatingRepoSkillPreview,
  isEnrichingContext,
  isGeneratingOnboardingPacket,
  isSavingOnboardingPacket,
  isSavingWorkspaceMemory,
  missingRequirements,
  onboardingPacket,
  onboardingPacketError,
  onboardingProgressStage,
  longTermIndex,
  repoSkillPreview,
  savedOnboardingPacketPath,
  scanResult,
  statusState,
  setGlobalContext,
  setLongTermIndex,
  updateDraft,
  workspaceName
}: ContextSetupStepContentProps): React.JSX.Element {
  switch (currentStep) {
    case 'onboarding':
      return (
        <ContextSetupOnboardingStep
          applyRepoSkillError={applyRepoSkillError}
          clearOnboardingPacket={clearOnboardingPacket}
          clearRepoSkillPreview={clearRepoSkillPreview}
          codexReadinessDetail={codexReadinessDetail}
          codexReadinessLabel={codexReadinessLabel}
          createdOnboardingWorkflowPath={createdOnboardingWorkflowPath}
          draft={draft}
          handleApplyOnboardingSuggestions={handleApplyOnboardingSuggestions}
          handleApplyRepoSkillPreview={handleApplyRepoSkillPreview}
          handleCreateOnboardingWorkflow={handleCreateOnboardingWorkflow}
          handleCreateRepoSkillPreview={handleCreateRepoSkillPreview}
          handleGenerateOnboardingPacket={handleGenerateOnboardingPacket}
          handleSaveOnboardingPacket={handleSaveOnboardingPacket}
          isApplyingRepoSkillPreview={isApplyingRepoSkillPreview}
          isCodexReady={isCodexReady}
          isCreatingOnboardingWorkflow={isCreatingOnboardingWorkflow}
          isCreatingRepoSkillPreview={isCreatingRepoSkillPreview}
          isGeneratingOnboardingPacket={isGeneratingOnboardingPacket}
          isSavingOnboardingPacket={isSavingOnboardingPacket}
          onboardingPacket={onboardingPacket}
          onboardingPacketError={onboardingPacketError}
          onboardingProgressStage={onboardingProgressStage}
          repoSkillPreview={repoSkillPreview}
          savedOnboardingPacketPath={savedOnboardingPacketPath}
          scanResult={scanResult}
        />
      )
    case 'rules':
      return (
        <ContextSetupRulesStep draft={draft} scanResult={scanResult} updateDraft={updateDraft} />
      )
    case 'brief':
      return <ContextSetupBriefStep draft={draft} updateDraft={updateDraft} />
    case 'focus':
      return (
        <ContextSetupFocusStep draft={draft} scanResult={scanResult} updateDraft={updateDraft} />
      )
    case 'review':
      return (
        <ContextSetupReviewStep
          agentConfigError={agentConfigError}
          agentConfigExporters={agentConfigExporters}
          agentConfigPreview={agentConfigPreview}
          canExportAgentConfig={canExportAgentConfig}
          canSaveFinal={canSaveFinal}
          clearAgentConfigPreview={clearAgentConfigPreview}
          clearContextEnrichment={clearContextEnrichment}
          globalContext={globalContext}
          contextEnrichmentError={contextEnrichmentError}
          contextEnrichmentResult={contextEnrichmentResult}
          draft={draft}
          handleAcceptContextEnrichment={handleAcceptContextEnrichment}
          handleApplyAgentConfigPreview={handleApplyAgentConfigPreview}
          handleCreateAgentConfigPreview={handleCreateAgentConfigPreview}
          handleRunContextEnrichment={handleRunContextEnrichment}
          handleSaveWorkspaceMemory={handleSaveWorkspaceMemory}
          isApplyingAgentConfigPreview={isApplyingAgentConfigPreview}
          isContextEnrichmentAvailable={isContextEnrichmentAvailable}
          isCreatingAgentConfigPreview={isCreatingAgentConfigPreview}
          isEnrichingContext={isEnrichingContext}
          isSavingWorkspaceMemory={isSavingWorkspaceMemory}
          missingRequirements={missingRequirements}
          longTermIndex={longTermIndex}
          statusState={statusState}
          setGlobalContext={setGlobalContext}
          setLongTermIndex={setLongTermIndex}
        />
      )
    default:
      return (
        <ContextSetupDetectStep
          draft={draft}
          scanResult={scanResult}
          statusState={statusState}
          updateDraft={updateDraft}
          workspaceName={workspaceName}
        />
      )
  }
}
