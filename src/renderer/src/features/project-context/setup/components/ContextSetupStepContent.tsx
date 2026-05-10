import React from 'react'
import type {
  AgentConfigExportPreview,
  AgentConfigExporterId,
  AgentConfigExporterSummary,
  ContextEnrichmentField,
  ContextEnrichmentResult,
  ContextScanResult,
  ProjectContextDraft
} from '@shared'
import type { StatusChipTone } from '@renderer/components/ui/StatusChip'
import { ContextSetupBriefStep } from './ContextSetupBriefStep'
import { ContextSetupDetectStep } from './ContextSetupDetectStep'
import { ContextSetupFocusStep } from './ContextSetupFocusStep'
import { ContextSetupReviewStep } from './ContextSetupReviewStep'
import { ContextSetupRulesStep } from './ContextSetupRulesStep'
import type { ContextStepId } from '../lib/context-setup-model'

interface ContextSetupStepContentProps {
  agentConfigError: string | null
  agentConfigExporters: AgentConfigExporterSummary[]
  agentConfigPreview: AgentConfigExportPreview | null
  canExportAgentConfig: boolean
  canSaveFinal: boolean
  clearContextEnrichment: () => void
  clearAgentConfigPreview: () => void
  contextEnrichmentError: string | null
  contextEnrichmentResult: ContextEnrichmentResult | null
  currentStep: ContextStepId
  draft: ProjectContextDraft
  handleAcceptContextEnrichment: (fields?: ContextEnrichmentField[]) => void
  handleApplyAgentConfigPreview: () => Promise<void>
  handleCreateAgentConfigPreview: (
    exporterId: AgentConfigExporterId,
    includeAdvancedConfig?: boolean
  ) => Promise<void>
  handleRunContextEnrichment: () => Promise<void>
  isApplyingAgentConfigPreview: boolean
  isContextEnrichmentAvailable: boolean
  isCreatingAgentConfigPreview: boolean
  isEnrichingContext: boolean
  missingRequirements: string[]
  scanResult: ContextScanResult | null
  statusState: {
    detail: string
    label: string
    tone: StatusChipTone
  }
  updateDraft: (patch: Partial<ProjectContextDraft>) => void
  workspaceName: string
}

export function ContextSetupStepContent({
  agentConfigError,
  agentConfigExporters,
  agentConfigPreview,
  canExportAgentConfig,
  canSaveFinal,
  clearContextEnrichment,
  clearAgentConfigPreview,
  contextEnrichmentError,
  contextEnrichmentResult,
  currentStep,
  draft,
  handleAcceptContextEnrichment,
  handleApplyAgentConfigPreview,
  handleCreateAgentConfigPreview,
  handleRunContextEnrichment,
  isApplyingAgentConfigPreview,
  isContextEnrichmentAvailable,
  isCreatingAgentConfigPreview,
  isEnrichingContext,
  missingRequirements,
  scanResult,
  statusState,
  updateDraft,
  workspaceName
}: ContextSetupStepContentProps): React.JSX.Element {
  switch (currentStep) {
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
          contextEnrichmentError={contextEnrichmentError}
          contextEnrichmentResult={contextEnrichmentResult}
          draft={draft}
          handleAcceptContextEnrichment={handleAcceptContextEnrichment}
          handleApplyAgentConfigPreview={handleApplyAgentConfigPreview}
          handleCreateAgentConfigPreview={handleCreateAgentConfigPreview}
          handleRunContextEnrichment={handleRunContextEnrichment}
          isApplyingAgentConfigPreview={isApplyingAgentConfigPreview}
          isContextEnrichmentAvailable={isContextEnrichmentAvailable}
          isCreatingAgentConfigPreview={isCreatingAgentConfigPreview}
          isEnrichingContext={isEnrichingContext}
          missingRequirements={missingRequirements}
          statusState={statusState}
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
