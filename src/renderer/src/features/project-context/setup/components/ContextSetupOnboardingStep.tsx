import React, { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Save, Sparkles, Workflow, X } from 'lucide-react'
import type {
  ContextScanResult,
  OnboardingGenerationMode,
  OnboardingPacket,
  ProjectContextDraft,
  RepoOnboardingSkillPreview
} from '@shared'
import { Button } from '@renderer/components/ui/Button'
import { StatusChip } from '@renderer/components/ui/StatusChip'
import { PreviewTabButton } from './PreviewTabButton'
import type { OnboardingPacketTab } from '../lib/onboarding-packet-model'
import { countOnboardingSuggestions } from '../lib/onboarding-packet-model'

interface ContextSetupOnboardingStepProps {
  applyRepoSkillError: string | null
  codexReadinessDetail: string
  codexReadinessLabel: string
  createdOnboardingWorkflowPath: string | null
  draft: ProjectContextDraft
  isApplyingRepoSkillPreview: boolean
  isCodexReady: boolean
  isCreatingOnboardingWorkflow: boolean
  isCreatingRepoSkillPreview: boolean
  isGeneratingOnboardingPacket: boolean
  isSavingOnboardingPacket: boolean
  onboardingPacket: OnboardingPacket | null
  onboardingPacketError: string | null
  onboardingProgressStage: 'idle' | 'reading' | 'mapping' | 'reviewing' | 'done'
  repoSkillPreview: RepoOnboardingSkillPreview | null
  savedOnboardingPacketPath: string | null
  scanResult: ContextScanResult | null
  clearOnboardingPacket: () => void
  clearRepoSkillPreview: () => void
  handleApplyOnboardingSuggestions: () => void
  handleApplyRepoSkillPreview: () => Promise<void>
  handleCreateOnboardingWorkflow: () => Promise<void>
  handleCreateRepoSkillPreview: () => Promise<void>
  handleGenerateOnboardingPacket: (mode: OnboardingGenerationMode) => Promise<void>
  handleSaveOnboardingPacket: () => Promise<void>
}

function MonoPill({ value }: { value: string }): React.JSX.Element {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11px]"
      style={{
        background: 'var(--color-canvas-soft)',
        border: '1px solid var(--color-hairline)',
        color: 'var(--color-ink)',
        fontFamily: 'var(--font-mono)'
      }}
    >
      {value}
    </span>
  )
}

function BorderedPanel({
  children,
  tone = 'surface'
}: {
  children: React.ReactNode
  tone?: 'surface' | 'soft'
}): React.JSX.Element {
  return (
    <div
      className="rounded-lg px-4 py-4"
      style={{
        background: tone === 'soft' ? 'var(--color-canvas-soft)' : 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline)'
      }}
    >
      {children}
    </div>
  )
}

function EmptyPacketState({
  draft,
  scanResult,
  isCodexReady,
  codexReadinessLabel,
  codexReadinessDetail,
  isGenerating,
  progressStage,
  onGenerate
}: {
  draft: ProjectContextDraft
  scanResult: ContextScanResult | null
  isCodexReady: boolean
  codexReadinessLabel: string
  codexReadinessDetail: string
  isGenerating: boolean
  progressStage: ContextSetupOnboardingStepProps['onboardingProgressStage']
  onGenerate: (mode: OnboardingGenerationMode) => Promise<void>
}): React.JSX.Element {
  const progressLabel =
    progressStage === 'mapping'
      ? 'Mapping'
      : progressStage === 'reviewing'
        ? 'Reviewing'
        : progressStage === 'reading'
          ? 'Reading'
          : 'Ready'

  return (
    <BorderedPanel tone="soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[640px]">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone="idle" label="Deterministic scan ready" />
            <StatusChip tone={isCodexReady ? 'success' : 'warning'} label={codexReadinessLabel} />
            {isGenerating ? <StatusChip tone="running" label={progressLabel} /> : null}
          </div>
          <p className="mt-3 text-sm leading-6" style={{ color: 'var(--color-body)' }}>
            Fluxion already has scan evidence for {draft.projectName || 'this workspace'}. Build a
            packet from scan, or run a read-only Codex pass when Codex readiness is available.
          </p>
          {!isCodexReady ? (
            <p className="mt-2 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
              {codexReadinessDetail}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => void onGenerate('deterministic')}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Build From Scan
          </Button>
          <Button
            variant="primary"
            onClick={() => void onGenerate('codex-assisted')}
            disabled={isGenerating || !isCodexReady}
            title={isCodexReady ? 'Run read-only Codex onboarding' : codexReadinessDetail}
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Run Codex Onboarding
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div>
          <span
            className="text-[11px] uppercase tracking-[0.08em]"
            style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
          >
            Stack
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...(scanResult?.detectedFields.primaryStack ?? []), ...draft.languages]
              .slice(0, 8)
              .map((item) => (
                <MonoPill key={item} value={item} />
              ))}
          </div>
        </div>
        <div>
          <span
            className="text-[11px] uppercase tracking-[0.08em]"
            style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
          >
            Commands
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {draft.verificationCommands.slice(0, 4).map((item) => (
              <MonoPill key={item} value={item} />
            ))}
          </div>
        </div>
        <div>
          <span
            className="text-[11px] uppercase tracking-[0.08em]"
            style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
          >
            Evidence
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {(scanResult?.scannedFiles ?? []).slice(0, 5).map((item) => (
              <MonoPill key={item} value={item} />
            ))}
          </div>
        </div>
      </div>
    </BorderedPanel>
  )
}

function PacketPreview({
  packet,
  activeTab,
  setActiveTab
}: {
  packet: OnboardingPacket
  activeTab: OnboardingPacketTab
  setActiveTab: (tab: OnboardingPacketTab) => void
}): React.JSX.Element {
  return (
    <BorderedPanel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone="success" label={packet.generationMode} />
            <StatusChip tone="idle" label={`${packet.diagnostics.filesRead} files`} />
            {packet.diagnostics.truncatedFiles.length > 0 ? (
              <StatusChip tone="warning" label="truncated" />
            ) : null}
          </div>
          <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
            {packet.projectName}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <PreviewTabButton
          active={activeTab === 'summary'}
          label="Summary"
          onClick={() => setActiveTab('summary')}
        />
        <PreviewTabButton
          active={activeTab === 'architecture'}
          label="Architecture"
          onClick={() => setActiveTab('architecture')}
        />
        <PreviewTabButton
          active={activeTab === 'commands'}
          label="Commands"
          onClick={() => setActiveTab('commands')}
        />
        <PreviewTabButton
          active={activeTab === 'risks'}
          label="Risks"
          onClick={() => setActiveTab('risks')}
        />
        <PreviewTabButton
          active={activeTab === 'evidence'}
          label="Evidence"
          onClick={() => setActiveTab('evidence')}
        />
      </div>

      <div className="mt-4">
        {activeTab === 'summary' ? (
          <div className="space-y-3">
            <p className="text-sm leading-6" style={{ color: 'var(--color-body)' }}>
              {packet.projectSummary || 'No summary generated.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {packet.stack.map((item) => (
                <MonoPill key={item} value={item} />
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === 'architecture' ? (
          <div className="space-y-3">
            {packet.architectureMap.map((item) => (
              <p key={item} className="text-xs leading-5" style={{ color: 'var(--color-body)' }}>
                {item}
              </p>
            ))}
            {packet.components.map((component) => (
              <div
                key={component.id}
                className="rounded-md px-3 py-3"
                style={{
                  background: 'var(--color-canvas-soft)',
                  border: '1px solid var(--color-hairline)'
                }}
              >
                <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                  {component.name}
                </p>
                <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
                  {component.role}
                </p>
                <p
                  className="mt-2 text-[11px]"
                  style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  {component.rootPath}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === 'commands' ? (
          <div className="space-y-3">
            {packet.commands.map((command) => (
              <div
                key={command.id}
                className="rounded-md px-3 py-3"
                style={{
                  background: 'var(--color-canvas-soft)',
                  border: '1px solid var(--color-hairline)'
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
                    {command.label}
                  </p>
                  <StatusChip
                    tone={command.risk === 'safe' ? 'success' : 'warning'}
                    label={command.risk}
                  />
                </div>
                <pre
                  className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] leading-5"
                  style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}
                >
                  {command.command}
                </pre>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === 'risks' ? (
          <div className="space-y-2">
            {[...packet.risks, ...packet.openQuestions].map((item) => (
              <p key={item} className="text-xs leading-5" style={{ color: 'var(--color-body)' }}>
                {item}
              </p>
            ))}
          </div>
        ) : null}

        {activeTab === 'evidence' ? (
          <div className="space-y-2">
            {packet.sourceEvidence.map((evidence) => (
              <details
                key={evidence.id}
                className="rounded-md px-3 py-2"
                style={{
                  background: 'var(--color-canvas-soft)',
                  border: '1px solid var(--color-hairline)'
                }}
              >
                <summary className="cursor-pointer text-xs" style={{ color: 'var(--color-ink)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{evidence.sourcePath}</span> (
                  {evidence.confidence})
                </summary>
                <p className="mt-2 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
                  {evidence.note}
                </p>
              </details>
            ))}
          </div>
        ) : null}
      </div>
    </BorderedPanel>
  )
}

export const ContextSetupOnboardingStep: React.FC<ContextSetupOnboardingStepProps> = ({
  applyRepoSkillError,
  codexReadinessDetail,
  codexReadinessLabel,
  createdOnboardingWorkflowPath,
  draft,
  isApplyingRepoSkillPreview,
  isCodexReady,
  isCreatingOnboardingWorkflow,
  isCreatingRepoSkillPreview,
  isGeneratingOnboardingPacket,
  isSavingOnboardingPacket,
  onboardingPacket,
  onboardingPacketError,
  onboardingProgressStage,
  repoSkillPreview,
  savedOnboardingPacketPath,
  scanResult,
  clearOnboardingPacket,
  clearRepoSkillPreview,
  handleApplyOnboardingSuggestions,
  handleApplyRepoSkillPreview,
  handleCreateOnboardingWorkflow,
  handleCreateRepoSkillPreview,
  handleGenerateOnboardingPacket,
  handleSaveOnboardingPacket
}) => {
  const [activeTab, setActiveTab] = useState<OnboardingPacketTab>('summary')
  const suggestionCount = useMemo(
    () => countOnboardingSuggestions(onboardingPacket),
    [onboardingPacket]
  )

  return (
    <div className="space-y-5">
      {!onboardingPacket ? (
        <EmptyPacketState
          codexReadinessDetail={codexReadinessDetail}
          codexReadinessLabel={codexReadinessLabel}
          draft={draft}
          isCodexReady={isCodexReady}
          isGenerating={isGeneratingOnboardingPacket}
          onGenerate={handleGenerateOnboardingPacket}
          progressStage={onboardingProgressStage}
          scanResult={scanResult}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip tone="success" label="Packet ready" />
              <StatusChip tone="idle" label={`${suggestionCount} suggestions`} />
            </div>
            <Button variant="ghost" onClick={clearOnboardingPacket}>
              <X size={14} />
              Clear Packet
            </Button>
          </div>
          <PacketPreview
            packet={onboardingPacket}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </>
      )}

      {onboardingPacketError ? (
        <div className="rounded-lg px-4 py-3" style={{ background: '#fff8f2' }}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} style={{ color: 'var(--color-timeline-done)' }} />
            <p className="text-xs leading-5" style={{ color: 'var(--color-body)' }}>
              {onboardingPacketError}
            </p>
          </div>
        </div>
      ) : null}

      <BorderedPanel tone="soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              Onboarding actions
            </p>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
              Artifacts are written only after an explicit action.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleApplyOnboardingSuggestions}
              disabled={!onboardingPacket || isGeneratingOnboardingPacket}
            >
              Apply Suggestions
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleSaveOnboardingPacket()}
              disabled={!onboardingPacket || isSavingOnboardingPacket}
            >
              {isSavingOnboardingPacket ? 'Saving...' : 'Save Packet'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleCreateOnboardingWorkflow()}
              disabled={isCreatingOnboardingWorkflow}
            >
              <Workflow size={14} />
              {isCreatingOnboardingWorkflow ? 'Creating...' : 'Create Workflow'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleCreateRepoSkillPreview()}
              disabled={!onboardingPacket || isCreatingRepoSkillPreview}
            >
              Export Repo Skill
            </Button>
          </div>
        </div>

        {savedOnboardingPacketPath || createdOnboardingWorkflowPath ? (
          <div className="mt-3 space-y-2">
            {savedOnboardingPacketPath ? (
              <div className="flex items-start gap-2">
                <CheckCircle2 size={15} style={{ color: 'var(--color-semantic-success)' }} />
                <p
                  className="text-[11px] leading-5"
                  style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  {savedOnboardingPacketPath}
                </p>
              </div>
            ) : null}
            {createdOnboardingWorkflowPath ? (
              <div className="flex items-start gap-2">
                <CheckCircle2 size={15} style={{ color: 'var(--color-semantic-success)' }} />
                <p
                  className="text-[11px] leading-5"
                  style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  {createdOnboardingWorkflowPath}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </BorderedPanel>

      {repoSkillPreview ? (
        <BorderedPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                Repo-local skill preview
              </p>
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
                This writes under{' '}
                <span style={{ fontFamily: 'var(--font-mono)' }}>.agents/skills</span>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={clearRepoSkillPreview}>
                Clear Preview
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleApplyRepoSkillPreview()}
                disabled={isApplyingRepoSkillPreview}
              >
                {isApplyingRepoSkillPreview ? 'Applying...' : 'Apply Skill'}
              </Button>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {repoSkillPreview.warnings.map((warning) => (
              <p
                key={warning}
                className="text-xs leading-5"
                style={{ color: 'var(--color-muted)' }}
              >
                {warning}
              </p>
            ))}
            {repoSkillPreview.operations.map((operation) => (
              <div
                key={operation.relativePath}
                className="rounded-md px-3 py-3"
                style={{
                  background: 'var(--color-canvas-soft)',
                  border: '1px solid var(--color-hairline)'
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
                    {operation.action} {operation.relativePath}
                  </span>
                  <StatusChip tone="idle" label={operation.action} />
                </div>
                <pre
                  className="mt-3 max-h-44 overflow-y-auto whitespace-pre-wrap text-[11px] leading-5"
                  style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}
                >
                  {operation.content}
                </pre>
              </div>
            ))}
          </div>
        </BorderedPanel>
      ) : null}

      {applyRepoSkillError ? (
        <p className="text-xs" style={{ color: 'var(--color-semantic-error)' }}>
          {applyRepoSkillError}
        </p>
      ) : null}
    </div>
  )
}
