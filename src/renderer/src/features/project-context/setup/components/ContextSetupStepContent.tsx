import React from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react'
import {
  AgentConfigExportPreview,
  AgentConfigExporterId,
  AgentConfigExporterSummary,
  ContextScanResult,
  kickoffIntentLabel,
  ProjectContextDraft
} from '@shared'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { StatusChip, StatusChipTone } from '@renderer/components/ui/StatusChip'
import { Textarea } from '@renderer/components/ui/Textarea'
import { EvidenceBadge } from './EvidenceBadge'
import { LineListTextarea } from './LineListTextarea'
import { ListEditor } from './ListEditor'
import {
  ContextStepId,
  fieldLabel,
  getWorkspaceTypeDescription,
  getWorkspaceTypeLabel,
  KICKOFF_INTENTS
} from '../lib/context-setup-model'

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
  const renderDetectStep = (): React.ReactNode => (
    <div className="space-y-5">
      <div
        className="rounded-lg px-4 py-4"
        style={{
          background: 'var(--color-canvas-soft)',
          border: '1px solid var(--color-hairline)'
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={statusState.tone} label={statusState.label} />
          <StatusChip tone="idle" label={getWorkspaceTypeLabel(draft.workspaceType)} />
        </div>
        <h3
          className="mt-3 text-base font-semibold"
          style={{ color: 'var(--color-ink)', letterSpacing: '-0.2px' }}
        >
          {draft.projectName || workspaceName}
        </h3>
        <p className="mt-2 text-sm leading-6" style={{ color: 'var(--color-body)' }}>
          {getWorkspaceTypeDescription(draft.workspaceType)}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
            Project name
          </label>
          <Input
            value={draft.projectName}
            onChange={(event) => updateDraft({ projectName: event.target.value })}
            placeholder="Fluxion"
            surface="canvas"
          />
        </div>

        {draft.workspaceType === 'blank' ? (
          <div className="space-y-3">
            <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
              Kickoff intent
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {KICKOFF_INTENTS.map((intent) => {
                const isActive = draft.kickoffIntent === intent.value
                return (
                  <button
                    key={intent.value}
                    type="button"
                    onClick={() => updateDraft({ kickoffIntent: intent.value })}
                    className="rounded-lg px-3 py-3 text-left transition-colors"
                    style={{
                      background: isActive
                        ? 'var(--color-surface-card)'
                        : 'var(--color-canvas-soft)',
                      border: `1px solid ${isActive ? 'var(--color-hairline-strong)' : 'var(--color-hairline)'}`
                    }}
                  >
                    <div className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                      {kickoffIntentLabel(intent.value)}
                    </div>
                    <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                      {intent.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      {(scanResult?.scannedFiles ?? []).length > 0 ||
      (scanResult?.discoveredPaths ?? []).length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {(scanResult?.scannedFiles ?? []).length > 0 ? (
            <details
              className="group rounded-lg"
              style={{
                background: 'var(--color-surface-card)',
                border: '1px solid var(--color-hairline)'
              }}
            >
              <summary
                className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3"
                style={{ listStyle: 'none' }}
              >
                <div className="flex items-center gap-2">
                  <ChevronDown
                    size={14}
                    className="transition-transform group-open:rotate-180"
                    style={{ color: 'var(--color-muted)' }}
                  />
                  <span
                    className="text-[11px] uppercase tracking-[0.08em]"
                    style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                  >
                    Scanned files
                  </span>
                </div>
                <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                  {(scanResult?.scannedFiles ?? []).length} found
                </span>
              </summary>
              <div className="flex flex-wrap gap-2 px-4 pb-4 pt-1">
                {(scanResult?.scannedFiles ?? []).map((filePath) => (
                  <span
                    key={filePath}
                    className="rounded-full px-2.5 py-1 text-[11px]"
                    style={{
                      background: 'var(--color-canvas-soft)',
                      border: '1px solid var(--color-hairline)',
                      color: 'var(--color-ink)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    {filePath}
                  </span>
                ))}
              </div>
            </details>
          ) : (
            <div />
          )}

          {(scanResult?.discoveredPaths ?? []).length > 0 ? (
            <details
              className="group rounded-lg"
              style={{
                background: 'var(--color-surface-card)',
                border: '1px solid var(--color-hairline)'
              }}
            >
              <summary
                className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3"
                style={{ listStyle: 'none' }}
              >
                <div className="flex items-center gap-2">
                  <ChevronDown
                    size={14}
                    className="transition-transform group-open:rotate-180"
                    style={{ color: 'var(--color-muted)' }}
                  />
                  <span
                    className="text-[11px] uppercase tracking-[0.08em]"
                    style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                  >
                    Discovered paths
                  </span>
                </div>
                <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                  {(scanResult?.discoveredPaths ?? []).length} found
                </span>
              </summary>
              <div className="flex flex-wrap gap-2 px-4 pb-4 pt-1">
                {(scanResult?.discoveredPaths ?? []).map((entry) => (
                  <span
                    key={entry}
                    className="rounded-full px-2.5 py-1 text-[11px]"
                    style={{
                      background: 'var(--color-canvas-soft)',
                      border: '1px solid var(--color-hairline)',
                      color: 'var(--color-ink)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    {entry}
                  </span>
                ))}
              </div>
            </details>
          ) : (
            <div />
          )}
        </div>
      ) : null}

      {scanResult?.sourceEvidence.length ? (
        <div className="space-y-3">
          <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
            Evidence behind the draft
          </label>
          <div className="grid gap-3">
            {scanResult.sourceEvidence.map((evidence) => (
              <EvidenceBadge
                key={`${evidence.field}-${evidence.sourcePath}`}
                sourcePath={`${fieldLabel(evidence.field)} · ${evidence.sourcePath}`}
                confidence={evidence.confidence}
                note={evidence.note}
              />
            ))}
          </div>
        </div>
      ) : null}

      {(scanResult?.unresolvedFields ?? []).length > 0 ? (
        <div
          className="rounded-lg px-4 py-4"
          style={{
            background: '#fff8f2',
            border: '1px solid var(--color-hairline)'
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} style={{ color: 'var(--color-timeline-done)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                Unknown is better than guessed
              </p>
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
                Fluxion could not confidently infer these fields yet:
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(scanResult?.unresolvedFields ?? []).map((field) => (
                  <span
                    key={field}
                    className="rounded-full px-2.5 py-1 text-[11px]"
                    style={{
                      background: 'var(--color-surface-card)',
                      border: '1px solid var(--color-hairline)',
                      color: 'var(--color-ink)'
                    }}
                  >
                    {fieldLabel(field)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )

  const renderRulesStep = (): React.ReactNode => (
    <div className="space-y-5">
      <ListEditor
        label="Primary stack"
        values={draft.primaryStack}
        placeholder="TypeScript"
        suggestions={scanResult?.detectedFields.primaryStack}
        onChange={(values) => updateDraft({ primaryStack: values })}
      />

      <ListEditor
        label="Languages"
        values={draft.languages}
        placeholder="Java"
        suggestions={scanResult?.detectedFields.languages}
        onChange={(values) => updateDraft({ languages: values })}
      />

      <ListEditor
        label="Frameworks"
        values={draft.frameworks}
        placeholder="Spring Boot"
        suggestions={scanResult?.detectedFields.frameworks}
        onChange={(values) => updateDraft({ frameworks: values })}
      />

      <ListEditor
        label="Package managers"
        values={draft.packageManagers}
        placeholder="Maven"
        suggestions={scanResult?.detectedFields.packageManagers}
        onChange={(values) => updateDraft({ packageManagers: values })}
      />

      <ListEditor
        label="Verification commands"
        values={draft.verificationCommands}
        placeholder="npm run typecheck"
        hint="These commands should be safe defaults before agents claim done."
        suggestions={scanResult?.detectedFields.verificationCommands}
        monospace
        onChange={(values) => updateDraft({ verificationCommands: values })}
      />

      <LineListTextarea
        label="Stable rules"
        values={draft.stableRules}
        placeholder={
          'One rule per line.\nPrefer Windows-safe commands.\nKeep runtime logic out of the renderer.'
        }
        hint="Rules that agents should consistently follow."
        rows={5}
        onChange={(values) => updateDraft({ stableRules: values })}
      />
    </div>
  )

  const renderBriefStep = (): React.ReactNode => (
    <div className="space-y-5">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
          Project goal
        </label>
        <Textarea
          value={draft.projectGoal}
          onChange={(event) => updateDraft({ projectGoal: event.target.value })}
          rows={4}
          placeholder="What is this project trying to achieve?"
          surface="canvas"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
          Target users
        </label>
        <Textarea
          value={draft.targetUsers}
          onChange={(event) => updateDraft({ targetUsers: event.target.value })}
          rows={3}
          placeholder="Who will use or review this project?"
          surface="canvas"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
          Architecture summary
        </label>
        <Textarea
          value={draft.architectureSummary}
          onChange={(event) => updateDraft({ architectureSummary: event.target.value })}
          rows={4}
          placeholder="How is the project structured at a high level?"
          surface="canvas"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
          First milestone
        </label>
        <Textarea
          value={draft.firstMilestone}
          onChange={(event) => updateDraft({ firstMilestone: event.target.value })}
          rows={3}
          placeholder="What should the first usable milestone deliver?"
          surface="canvas"
        />
      </div>

      <LineListTextarea
        label="Non-goals"
        values={draft.nonGoals}
        placeholder={'One non-goal per line.\nDo not add cloud sync in the first milestone.'}
        rows={4}
        onChange={(values) => updateDraft({ nonGoals: values })}
      />
    </div>
  )

  const renderFocusStep = (): React.ReactNode => (
    <div className="space-y-5">
      <ListEditor
        label="Important paths"
        values={draft.importantPaths}
        placeholder="src/main"
        suggestions={scanResult?.discoveredPaths}
        monospace
        onChange={(values) => updateDraft({ importantPaths: values })}
      />

      <ListEditor
        label="Entrypoints"
        values={draft.entrypoints}
        placeholder="src/main/java/com/example/Application.java"
        suggestions={scanResult?.detectedFields.entrypoints}
        monospace
        onChange={(values) => updateDraft({ entrypoints: values })}
      />

      <ListEditor
        label="Current focus areas"
        values={draft.focusAreas}
        placeholder="workflow execution"
        onChange={(values) => updateDraft({ focusAreas: values })}
      />

      <LineListTextarea
        label="Risk flags"
        values={draft.riskFlags}
        placeholder={'One risk per line.\nMultiple app entrypoints were detected.'}
        rows={4}
        onChange={(values) => updateDraft({ riskFlags: values })}
      />

      <LineListTextarea
        label="Recommended first actions"
        values={draft.recommendedFirstActions}
        placeholder={'One action per line.\nReview duplicate bootstraps before feature work.'}
        rows={4}
        onChange={(values) => updateDraft({ recommendedFirstActions: values })}
      />

      <LineListTextarea
        label="Open questions"
        values={draft.openQuestions}
        placeholder={'One question per line.\nWhich runtime should be treated as default?'}
        rows={5}
        onChange={(values) => updateDraft({ openQuestions: values })}
      />
    </div>
  )

  const renderReviewStep = (): React.ReactNode => (
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
        <div
          className="rounded-lg px-4 py-4"
          style={{
            background: '#fff8f2',
            border: '1px solid var(--color-hairline)'
          }}
        >
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
        <div
          className="rounded-lg px-4 py-4"
          style={{
            background: '#f5fbf7',
            border: '1px solid var(--color-hairline)'
          }}
        >
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

      <div
        className="rounded-lg px-4 py-4"
        style={{
          background: 'var(--color-canvas-soft)',
          border: '1px solid var(--color-hairline)'
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              Agent config export
            </p>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
              Export Fluxion context into agent-specific workspace files after the canonical context
              is saved.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => void handleCreateAgentConfigPreview('codex', false)}
              disabled={!canExportAgentConfig || isCreatingAgentConfigPreview}
            >
              Codex AGENTS.md
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleCreateAgentConfigPreview('codex', true)}
              disabled={!canExportAgentConfig || isCreatingAgentConfigPreview}
            >
              Codex Advanced
            </Button>
          </div>
        </div>

        {agentConfigExporters.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {agentConfigExporters
              .filter((exporter) => exporter.id !== 'codex')
              .map((exporter) => (
                <Button
                  key={exporter.id}
                  variant="ghost"
                  onClick={() => void handleCreateAgentConfigPreview(exporter.id)}
                  disabled={!canExportAgentConfig || isCreatingAgentConfigPreview}
                >
                  {exporter.label} {exporter.status === 'notImplemented' ? '(scaffold)' : ''}
                </Button>
              ))}
          </div>
        ) : null}

        {agentConfigError ? (
          <p className="mt-3 text-xs" style={{ color: 'var(--color-semantic-error)' }}>
            {agentConfigError}
          </p>
        ) : null}

        {agentConfigPreview ? (
          <div className="mt-4 space-y-3">
            {agentConfigPreview.warnings.length > 0 ? (
              <div className="rounded-md px-3 py-3" style={{ background: '#fff8f2' }}>
                {agentConfigPreview.warnings.map((warning) => (
                  <p
                    key={warning}
                    className="text-xs leading-5"
                    style={{ color: 'var(--color-body)' }}
                  >
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}

            {agentConfigPreview.operations.length > 0 ? (
              <div className="space-y-3">
                {agentConfigPreview.operations.map((operation) => (
                  <div
                    key={`${operation.action}:${operation.relativePath}`}
                    className="rounded-md px-3 py-3"
                    style={{
                      background: 'var(--color-surface-card)',
                      border: '1px solid var(--color-hairline)'
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
                        {operation.action} {operation.relativePath}
                      </span>
                      <StatusChip tone="idle" label={operation.action} />
                    </div>
                    <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                      {operation.description}
                    </p>
                    <pre
                      className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md px-3 py-3 text-[11px] leading-5"
                      style={{
                        background: 'var(--color-canvas-soft)',
                        color: 'var(--color-ink)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {operation.content}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                No file operations are available for this exporter yet.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={clearAgentConfigPreview}
                disabled={isApplyingAgentConfigPreview}
              >
                Clear Preview
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleApplyAgentConfigPreview()}
                disabled={
                  isApplyingAgentConfigPreview || agentConfigPreview.operations.length === 0
                }
              >
                {isApplyingAgentConfigPreview ? 'Applying...' : 'Apply Export'}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )

  const renderStepContent = (): React.ReactNode => {
    switch (currentStep) {
      case 'rules':
        return renderRulesStep()
      case 'brief':
        return renderBriefStep()
      case 'focus':
        return renderFocusStep()
      case 'review':
        return renderReviewStep()
      default:
        return renderDetectStep()
    }
  }
  return <>{renderStepContent()}</>
}
