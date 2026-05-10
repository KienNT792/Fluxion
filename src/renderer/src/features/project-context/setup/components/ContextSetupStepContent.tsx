import React from 'react'
import type {
  AgentConfigExportPreview,
  AgentConfigExporterId,
  AgentConfigExporterSummary,
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
  clearAgentConfigPreview: () => void
  currentStep: ContextStepId
  draft: ProjectContextDraft
  handleApplyAgentConfigPreview: () => Promise<void>
  handleCreateAgentConfigPreview: (
    exporterId: AgentConfigExporterId,
    includeAdvancedConfig?: boolean
  ) => Promise<void>
  isApplyingAgentConfigPreview: boolean
  isCreatingAgentConfigPreview: boolean
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
  clearAgentConfigPreview,
  currentStep,
  draft,
  handleApplyAgentConfigPreview,
  handleCreateAgentConfigPreview,
  isApplyingAgentConfigPreview,
  isCreatingAgentConfigPreview,
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
          draft={draft}
          handleApplyAgentConfigPreview={handleApplyAgentConfigPreview}
          handleCreateAgentConfigPreview={handleCreateAgentConfigPreview}
          isApplyingAgentConfigPreview={isApplyingAgentConfigPreview}
          isCreatingAgentConfigPreview={isCreatingAgentConfigPreview}
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
