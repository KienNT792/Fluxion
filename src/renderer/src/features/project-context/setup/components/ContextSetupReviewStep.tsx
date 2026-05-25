import React from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type {
  AgentConfigExportPreview,
  AgentConfigExporterId,
  AgentConfigExporterSummary,
  ContextEnrichmentField,
  ContextEnrichmentResult,
  ProjectContextDraft
} from '@shared'
import { StatusChip, StatusChipTone } from '@renderer/components/ui/StatusChip'
import { AgentConfigExportPanel } from './AgentConfigExportPanel'
import { ContextEnrichmentPanel } from './ContextEnrichmentPanel'
import { WorkspaceMemoryEditor } from './WorkspaceMemoryEditor'
import { getWorkspaceTypeLabel } from '../lib/context-setup-model'

interface ContextSetupReviewStepProps {
  agentConfigError: string | null
  agentConfigExporters: AgentConfigExporterSummary[]
  agentConfigPreview: AgentConfigExportPreview | null
  canExportAgentConfig: boolean
  canSaveFinal: boolean
  clearAgentConfigPreview: () => void
  clearContextEnrichment: () => void
  globalContext: string
  contextEnrichmentError: string | null
  contextEnrichmentResult: ContextEnrichmentResult | null
  draft: ProjectContextDraft
  handleAcceptContextEnrichment: (fields?: ContextEnrichmentField[]) => void
  handleApplyAgentConfigPreview: () => Promise<void>
  handleCreateAgentConfigPreview: (
    exporterId: AgentConfigExporterId,
    includeAdvancedConfig?: boolean
  ) => Promise<void>
  handleRunContextEnrichment: () => Promise<void>
  handleSaveWorkspaceMemory: () => Promise<void>
  isApplyingAgentConfigPreview: boolean
  isContextEnrichmentAvailable: boolean
  isCreatingAgentConfigPreview: boolean
  isEnrichingContext: boolean
  isSavingWorkspaceMemory: boolean
  missingRequirements: string[]
  longTermIndex: string
  statusState: {
    detail: string
    label: string
    tone: StatusChipTone
  }
  setGlobalContext: (value: string) => void
  setLongTermIndex: (value: string) => void
}

export const ContextSetupReviewStep: React.FC<ContextSetupReviewStepProps> = ({
  agentConfigError,
  agentConfigExporters,
  agentConfigPreview,
  canExportAgentConfig,
  canSaveFinal,
  clearAgentConfigPreview,
  clearContextEnrichment,
  globalContext,
  contextEnrichmentError,
  contextEnrichmentResult,
  draft,
  handleAcceptContextEnrichment,
  handleApplyAgentConfigPreview,
  handleCreateAgentConfigPreview,
  handleRunContextEnrichment,
  handleSaveWorkspaceMemory,
  isApplyingAgentConfigPreview,
  isContextEnrichmentAvailable,
  isCreatingAgentConfigPreview,
  isEnrichingContext,
  isSavingWorkspaceMemory,
  missingRequirements,
  longTermIndex,
  statusState,
  setGlobalContext,
  setLongTermIndex
}) => (
  <div className="space-y-5">
    <div
      className="rounded-lg px-4 py-4"
      style={{
        background: 'var(--color-canvas-soft)',
        border: '1px solid var(--color-hairline)'
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip
          tone={statusState.tone}
          label={`Will save as ${canSaveFinal ? 'Ready' : 'Incomplete'}`}
        />
        <StatusChip tone="idle" label={getWorkspaceTypeLabel(draft.workspaceType)} />
      </div>
      <p className="mt-3 text-sm leading-6" style={{ color: 'var(--color-body)' }}>
        This is the context Fluxion will pass to agents through{' '}
        <code style={{ fontFamily: 'var(--font-mono)' }}>.fluxion/memory/global-context.md</code>{' '}
        and <code style={{ fontFamily: 'var(--font-mono)' }}>.fluxion/context.json</code>.
      </p>
    </div>

    {missingRequirements.length > 0 ? (
      <div className="rounded-lg px-4 py-4" style={{ background: '#fff8f2' }}>
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} style={{ color: 'var(--color-timeline-done)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              Almost ready
            </p>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
              Add these to save as final context:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {missingRequirements.map((field) => (
                <span
                  key={field}
                  className="rounded-full px-2.5 py-1 text-[11px]"
                  style={{
                    background: 'var(--color-surface-card)',
                    border: '1px solid var(--color-hairline)',
                    color: 'var(--color-ink)'
                  }}
                >
                  {field}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    ) : (
      <div className="rounded-lg px-4 py-4" style={{ background: '#f5fbf7' }}>
        <div className="flex items-start gap-3">
          <CheckCircle2 size={16} style={{ color: 'var(--color-semantic-success)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              Ready for runtime
            </p>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
              The current brief contains the minimum context Fluxion needs to save a ready runtime
              context.
            </p>
          </div>
        </div>
      </div>
    )}

    <ContextEnrichmentPanel
      draft={draft}
      enrichmentError={contextEnrichmentError}
      enrichmentResult={contextEnrichmentResult}
      isAvailable={isContextEnrichmentAvailable}
      isEnriching={isEnrichingContext}
      onAccept={handleAcceptContextEnrichment}
      onClear={clearContextEnrichment}
      onEnrich={handleRunContextEnrichment}
    />

    <WorkspaceMemoryEditor
      globalContext={globalContext}
      isSaving={isSavingWorkspaceMemory}
      longTermIndex={longTermIndex}
      onGlobalContextChange={setGlobalContext}
      onLongTermIndexChange={setLongTermIndex}
      onSave={handleSaveWorkspaceMemory}
    />

    <AgentConfigExportPanel
      agentConfigError={agentConfigError}
      agentConfigExporters={agentConfigExporters}
      agentConfigPreview={agentConfigPreview}
      canExportAgentConfig={canExportAgentConfig}
      clearAgentConfigPreview={clearAgentConfigPreview}
      handleApplyAgentConfigPreview={handleApplyAgentConfigPreview}
      handleCreateAgentConfigPreview={handleCreateAgentConfigPreview}
      isApplyingAgentConfigPreview={isApplyingAgentConfigPreview}
      isCreatingAgentConfigPreview={isCreatingAgentConfigPreview}
    />
  </div>
)
