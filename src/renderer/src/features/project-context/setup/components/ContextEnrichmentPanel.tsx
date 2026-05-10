import React, { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, X } from 'lucide-react'
import type { ContextEnrichmentField, ContextEnrichmentResult, ProjectContextDraft } from '@shared'
import { Button } from '@renderer/components/ui/Button'
import { StatusChip } from '@renderer/components/ui/StatusChip'
import {
  CONTEXT_ENRICHMENT_FIELDS,
  getContextEnrichmentChanges
} from '../lib/context-enrichment-model'

interface ContextEnrichmentPanelProps {
  draft: ProjectContextDraft
  enrichmentError: string | null
  enrichmentResult: ContextEnrichmentResult | null
  isAvailable: boolean
  isEnriching: boolean
  onAccept: (fields?: ContextEnrichmentField[]) => void
  onClear: () => void
  onEnrich: () => Promise<void>
}

export const ContextEnrichmentPanel: React.FC<ContextEnrichmentPanelProps> = ({
  draft,
  enrichmentError,
  enrichmentResult,
  isAvailable,
  isEnriching,
  onAccept,
  onClear,
  onEnrich
}) => {
  const changes = useMemo(
    () => getContextEnrichmentChanges(draft, enrichmentResult),
    [draft, enrichmentResult]
  )
  const generatedLabel = enrichmentResult
    ? new Date(enrichmentResult.diagnostics.generatedAt).toLocaleString()
    : null
  const hasPendingMerge = changes.length > 0

  return (
    <div
      className="rounded-lg px-4 py-4"
      style={{
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline)'
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              tone={hasPendingMerge ? 'warning' : 'running'}
              label={hasPendingMerge ? 'Context merge pending' : 'Codex context pass'}
            />
            {enrichmentResult ? (
              <StatusChip tone="idle" label={`${enrichmentResult.diagnostics.filesRead} files`} />
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-6" style={{ color: 'var(--color-body)' }}>
            Run a read-only Codex pass over scanned evidence. Suggestions stay separate until you
            explicitly merge them into the context draft.
          </p>
          {hasPendingMerge ? (
            <p className="mt-2 text-xs leading-5" style={{ color: 'var(--color-timeline-done)' }}>
              Save Context will not apply these suggestions automatically.
            </p>
          ) : null}
          {generatedLabel ? (
            <p className="mt-1 text-[11px]" style={{ color: 'var(--color-muted)' }}>
              {enrichmentResult?.diagnostics.model} · {generatedLabel}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {enrichmentResult ? (
            <Button size="sm" variant="ghost" onClick={onClear} disabled={isEnriching}>
              <X size={14} />
              Discard suggestions
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void onEnrich()}
            disabled={isEnriching || !isAvailable}
            title={
              isAvailable
                ? 'Run read-only Codex enrichment'
                : 'Restart Fluxion to load the enrichment preload bridge'
            }
          >
            {isEnriching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {isEnriching ? 'Enriching...' : 'Enrich with Codex'}
          </Button>
        </div>
      </div>

      {!isAvailable || enrichmentError ? (
        <div className="mt-4 rounded-lg px-3 py-3" style={{ background: '#fff8f2' }}>
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} style={{ color: 'var(--color-timeline-done)' }} />
            <p className="text-xs leading-5" style={{ color: 'var(--color-body)' }}>
              {enrichmentError ??
                'Codex enrichment needs the updated preload bridge. Restart Fluxion and open this panel again.'}
            </p>
          </div>
        </div>
      ) : null}

      {enrichmentResult?.diagnostics.warnings.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {enrichmentResult.diagnostics.warnings.map((warning) => (
            <span
              key={warning}
              className="rounded-full px-2.5 py-1 text-[11px]"
              style={{
                background: '#fff8f2',
                border: '1px solid var(--color-hairline)',
                color: 'var(--color-body)'
              }}
            >
              {warning}
            </span>
          ))}
        </div>
      ) : null}

      {enrichmentResult && changes.length === 0 ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg px-3 py-3">
          <CheckCircle2 size={15} style={{ color: 'var(--color-semantic-success)' }} />
          <p className="text-xs leading-5" style={{ color: 'var(--color-body)' }}>
            Codex did not find a materially different context suggestion for the editable fields.
          </p>
        </div>
      ) : null}

      {changes.length > 0 ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
                Pending merge into context draft
              </p>
              <p className="mt-1 text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
                Review the diff below, then merge all or individual fields before saving.
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => onAccept(CONTEXT_ENRICHMENT_FIELDS)}
              disabled={isEnriching}
            >
              Merge all into context
            </Button>
          </div>

          {changes.map((change) => (
            <div
              key={change.field}
              className="rounded-lg px-3 py-3"
              style={{
                background: 'var(--color-canvas-soft)',
                border: '1px solid var(--color-hairline)'
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                    {change.label}
                  </p>
                  <p className="mt-1 text-[11px]" style={{ color: 'var(--color-muted)' }}>
                    {change.isListField ? 'Merged into existing list' : 'Replaces current text'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onAccept([change.field])}
                  disabled={isEnriching}
                >
                  Merge field
                </Button>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div>
                  <span
                    className="text-[11px] uppercase tracking-[0.08em]"
                    style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                  >
                    Current
                  </span>
                  <pre
                    className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-md px-3 py-2 text-xs leading-5"
                    style={{
                      background: 'var(--color-surface-card)',
                      border: '1px solid var(--color-hairline)',
                      color: change.currentValue ? 'var(--color-body)' : 'var(--color-muted)',
                      fontFamily: 'inherit'
                    }}
                  >
                    {change.currentValue || 'Empty'}
                  </pre>
                </div>
                <div>
                  <span
                    className="text-[11px] uppercase tracking-[0.08em]"
                    style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                  >
                    Codex suggestion
                  </span>
                  <pre
                    className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-md px-3 py-2 text-xs leading-5"
                    style={{
                      background: 'var(--color-surface-card)',
                      border: '1px solid var(--color-hairline)',
                      color: 'var(--color-ink)',
                      fontFamily: 'inherit'
                    }}
                  >
                    {change.suggestedValue}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
