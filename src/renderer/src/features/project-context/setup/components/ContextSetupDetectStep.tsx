import React from 'react'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import type { ContextScanResult, ProjectContextDraft } from '@shared'
import { kickoffIntentLabel } from '@shared'
import { Input } from '@renderer/components/ui/Input'
import { StatusChip, StatusChipTone } from '@renderer/components/ui/StatusChip'
import { EvidenceBadge } from './EvidenceBadge'
import {
  fieldLabel,
  getWorkspaceTypeDescription,
  getWorkspaceTypeLabel,
  KICKOFF_INTENTS
} from '../lib/context-setup-model'

interface ContextSetupDetectStepProps {
  draft: ProjectContextDraft
  scanResult: ContextScanResult | null
  statusState: {
    detail: string
    label: string
    tone: StatusChipTone
  }
  updateDraft: (patch: Partial<ProjectContextDraft>) => void
  workspaceName: string
}

function SignalPill({ value, mono = false }: { value: string; mono?: boolean }): React.JSX.Element {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11px]"
      style={{
        background: 'var(--color-canvas-soft)',
        border: '1px solid var(--color-hairline)',
        color: 'var(--color-ink)',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit'
      }}
    >
      {value}
    </span>
  )
}

export const ContextSetupDetectStep: React.FC<ContextSetupDetectStepProps> = ({
  draft,
  scanResult,
  statusState,
  updateDraft,
  workspaceName
}) => {
  const stackAndToolingSignals = [
    ...draft.primaryStack.map((item, index) => ({ key: `primaryStack-${index}-${item}`, value: item })),
    ...draft.languages.map((item, index) => ({ key: `languages-${index}-${item}`, value: item })),
    ...draft.frameworks.map((item, index) => ({ key: `frameworks-${index}-${item}`, value: item })),
    ...draft.packageManagers.map((item, index) => ({
      key: `packageManagers-${index}-${item}`,
      value: item
    })),
    ...draft.buildSystems.map((item, index) => ({ key: `buildSystems-${index}-${item}`, value: item })),
    ...draft.testFrameworks.map((item, index) => ({
      key: `testFrameworks-${index}-${item}`,
      value: item
    }))
  ].slice(0, 16)

  return (
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
      <h3 className="mt-3 text-base font-semibold" style={{ color: 'var(--color-ink)' }}>
        {draft.projectName || workspaceName}
      </h3>
      <p className="mt-2 text-sm leading-6" style={{ color: 'var(--color-body)' }}>
        {getWorkspaceTypeDescription(draft.workspaceType)}
      </p>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <div
        className="rounded-lg px-4 py-4"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)'
        }}
      >
        <span
          className="text-[11px] uppercase tracking-[0.08em]"
          style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
        >
          Stack and tooling
        </span>
        <div className="mt-3 flex flex-wrap gap-2">
          {stackAndToolingSignals.map((item) => (
            <SignalPill key={item.key} value={item.value} />
          ))}
        </div>
      </div>

      <div
        className="rounded-lg px-4 py-4"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)'
        }}
      >
        <span
          className="text-[11px] uppercase tracking-[0.08em]"
          style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
        >
          Commands and components
        </span>
        <div className="mt-3 flex flex-wrap gap-2">
          {draft.verificationCommands.slice(0, 6).map((item) => (
            <SignalPill key={item} value={item} mono />
          ))}
          {draft.components.slice(0, 6).map((component) => (
            <SignalPill key={component.id} value={`${component.name}: ${component.type}`} />
          ))}
        </div>
      </div>
    </div>

    {draft.riskFlags.length > 0 ? (
      <div className="rounded-lg px-4 py-4" style={{ background: '#fff8f2' }}>
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} style={{ color: 'var(--color-timeline-done)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              Scan warnings
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {draft.riskFlags.map((flag) => (
                <span
                  key={flag}
                  className="rounded-full px-2.5 py-1 text-[11px]"
                  style={{
                    background: 'var(--color-surface-card)',
                    border: '1px solid var(--color-hairline)',
                    color: 'var(--color-body)'
                  }}
                >
                  {flag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    ) : null}

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
                    background: isActive ? 'var(--color-surface-card)' : 'var(--color-canvas-soft)',
                    border: `1px solid ${
                      isActive ? 'var(--color-hairline-strong)' : 'var(--color-hairline)'
                    }`
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
      <div className="rounded-lg px-4 py-4" style={{ background: '#fff8f2' }}>
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
}
