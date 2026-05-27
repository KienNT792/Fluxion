import React from 'react'
import { Select } from '@renderer/components/ui/Select'
import {
  describeBooleanOverride,
  describeReviewModelFallback,
  describeStringOverride
} from '@renderer/features/node-inspector/lib/effective-policy'

interface WorkflowPolicySectionProps {
  modelAutoCompactTokenLimit: number | null
  modelContextWindow: number | null
  reviewModel: string | null
  serviceTier: string | null
  modelVerbosity: 'low' | 'medium' | 'high' | null
  modelReasoningSummary: 'auto' | 'concise' | 'detailed' | 'none' | null
  hideAgentReasoning: boolean
  showRawAgentReasoning: boolean
  modelOptions: Array<{ id: string; label: string }>
  onModelAutoCompactTokenLimitChange: (value: number | null) => void
  onModelContextWindowChange: (value: number | null) => void
  onReviewModelChange: (value: string | null) => void
  onServiceTierChange: (value: string | null) => void
  onModelVerbosityChange: (value: 'low' | 'medium' | 'high' | null) => void
  onModelReasoningSummaryChange: (
    value: 'auto' | 'concise' | 'detailed' | 'none' | null
  ) => void
  onHideAgentReasoningChange: (value: boolean) => void
  onShowRawAgentReasoningChange: (value: boolean) => void
}

function parsePositiveInteger(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return Math.floor(parsed)
}

type PolicyTone = 'calm' | 'watch' | 'risk'

interface PolicyWarning {
  title: string
  detail: string
  tone: PolicyTone
}

function formatRatio(value: number): string {
  if (value >= 100) {
    return `${Math.round(value)}%`
  }

  if (value >= 10) {
    return `${value.toFixed(1)}%`
  }

  return `${value.toFixed(2)}%`
}

function getPostureTone(warnings: PolicyWarning[]): PolicyTone {
  if (warnings.some((warning) => warning.tone === 'risk')) {
    return 'risk'
  }

  if (warnings.some((warning) => warning.tone === 'watch')) {
    return 'watch'
  }

  return 'calm'
}

function getToneStyles(tone: PolicyTone): { border: string; background: string; text: string } {
  if (tone === 'risk') {
    return {
      border: 'rgba(190, 92, 92, 0.32)',
      background: 'rgba(190, 92, 92, 0.10)',
      text: 'var(--color-ink)'
    }
  }

  if (tone === 'watch') {
    return {
      border: 'rgba(168, 125, 47, 0.32)',
      background: 'rgba(168, 125, 47, 0.10)',
      text: 'var(--color-ink)'
    }
  }

  return {
    border: 'var(--color-hairline)',
    background: 'var(--color-surface-card)',
    text: 'var(--color-body)'
  }
}

function buildPolicyWarnings(input: {
  reviewModel: string | null
  serviceTier: string | null
  modelVerbosity: 'low' | 'medium' | 'high' | null
  modelReasoningSummary: 'auto' | 'concise' | 'detailed' | 'none' | null
  hideAgentReasoning: boolean
  showRawAgentReasoning: boolean
  modelAutoCompactTokenLimit: number | null
  modelContextWindow: number | null
}): PolicyWarning[] {
  const warnings: PolicyWarning[] = []

  if (input.hideAgentReasoning && input.showRawAgentReasoning) {
    warnings.push({
      tone: 'risk',
      title: 'Reasoning visibility conflicts',
      detail:
        '`hide_agent_reasoning` suppresses reasoning events in Codex output, while `show_raw_agent_reasoning` only matters when raw reasoning is surfaced. Keeping both enabled makes explainability harder to predict.'
    })
  }

  if (input.modelAutoCompactTokenLimit && !input.modelContextWindow) {
    warnings.push({
      tone: 'watch',
      title: 'Compaction threshold has no local window hint',
      detail:
        'Fluxion can still track the token threshold, but it cannot show a stable percent-of-window posture when active model metadata is missing.'
    })
  }

  if (
    input.modelVerbosity === 'low' &&
    input.modelReasoningSummary === 'none' &&
    !input.showRawAgentReasoning
  ) {
    warnings.push({
      tone: 'watch',
      title: 'Low explainability posture',
      detail:
        'Low verbosity plus no reasoning summary and no raw reasoning keeps runs compact, but it also removes most debugging breadcrumbs during reruns and reviews.'
    })
  }

  if (!input.reviewModel) {
    warnings.push({
      tone: 'calm',
      title: 'Review falls back to the run model',
      detail:
        'This matches Codex defaults. Add a workflow review model only when review quality should diverge from the node run model.'
    })
  }

  if (!input.serviceTier) {
    warnings.push({
      tone: 'calm',
      title: 'Service tier stays inherited',
      detail:
        'Codex will use the active profile or session default when nodes and workflow do not set `service_tier`.'
    })
  }

  return warnings
}

export const WorkflowPolicySection: React.FC<WorkflowPolicySectionProps> = ({
  modelAutoCompactTokenLimit,
  modelContextWindow,
  reviewModel,
  serviceTier,
  modelVerbosity,
  modelReasoningSummary,
  hideAgentReasoning,
  showRawAgentReasoning,
  modelOptions,
  onModelAutoCompactTokenLimitChange,
  onModelContextWindowChange,
  onReviewModelChange,
  onServiceTierChange,
  onModelVerbosityChange,
  onModelReasoningSummaryChange,
  onHideAgentReasoningChange,
  onShowRawAgentReasoningChange
}) => {
  const policyWarnings = buildPolicyWarnings({
    reviewModel,
    serviceTier,
    modelVerbosity,
    modelReasoningSummary,
    hideAgentReasoning,
    showRawAgentReasoning,
    modelAutoCompactTokenLimit,
    modelContextWindow
  })
  const postureTone = getPostureTone(policyWarnings)
  const postureStyles = getToneStyles(postureTone)
  const compactRatio =
    modelAutoCompactTokenLimit && modelContextWindow
      ? (modelAutoCompactTokenLimit / modelContextWindow) * 100
      : null
  const compactPosture = modelAutoCompactTokenLimit
    ? compactRatio !== null
      ? `Auto-compact triggers near ${formatRatio(compactRatio)} of the configured context window.`
      : 'Auto-compact uses an explicit token threshold, but the window posture stays heuristic until a context window hint is set.'
    : 'Auto-compact stays inherited from Codex model defaults.'
  const explainabilityPosture = hideAgentReasoning
    ? showRawAgentReasoning
      ? 'Reasoning output is constrained and partially contradictory.'
      : 'Reasoning output is intentionally suppressed for quieter runs.'
    : modelReasoningSummary === 'none' && !showRawAgentReasoning
      ? 'Reasoning output is minimal.'
      : 'Reasoning output remains available for review and debugging.'
  return (
    <section
      className="rounded-lg px-3 py-3"
      style={{
        background: 'var(--color-canvas)',
        border: '1px solid var(--color-hairline)'
      }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'var(--color-muted)' }}
      >
        Workflow Policy
      </div>

      <div className="mt-3 grid gap-3">
        <div
          className="rounded-md px-3 py-2 text-[11px] leading-5"
          style={{
            color: postureStyles.text,
            background: postureStyles.background,
            border: `1px solid ${postureStyles.border}`
          }}
        >
          <div
            className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--color-muted)' }}
          >
            Policy posture
          </div>
          <div>
            Workflow-level policy only applies when a node does not override the same Codex option.
          </div>
          <div className="mt-1">
            Effective fallback preview:{' '}
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}>
              review={reviewModel ?? 'run model'}, tier={serviceTier ?? 'Codex default'},
              verbosity={modelVerbosity ?? 'model default'}, reasoning-summary=
              {modelReasoningSummary ?? 'model default'}, hide-reasoning=
              {hideAgentReasoning ? 'true' : 'false'}, raw-reasoning=
              {showRawAgentReasoning ? 'true' : 'false'}
            </span>
          </div>
          <div className="mt-2 grid gap-1">
            <div>Explainability: {explainabilityPosture}</div>
            <div>Compaction: {compactPosture}</div>
          </div>
        </div>

        <div
          className="rounded-md px-3 py-2 text-[11px] leading-5"
          style={{
            color: 'var(--color-body)',
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-hairline)'
          }}
        >
          <div
            className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--color-muted)' }}
          >
            Effective workflow fallbacks
          </div>
          <div className="grid gap-1" style={{ fontFamily: 'var(--font-mono)' }}>
            <div>review_model = {describeReviewModelFallback(undefined, reviewModel ?? undefined)}</div>
            <div>
              service_tier ={' '}
              {describeStringOverride(undefined, serviceTier ?? undefined, 'Codex default')}
            </div>
            <div>
              model_verbosity ={' '}
              {describeStringOverride(undefined, modelVerbosity ?? undefined, 'model default')}
            </div>
            <div>
              model_reasoning_summary ={' '}
              {describeStringOverride(
                undefined,
                modelReasoningSummary ?? undefined,
                'model default'
              )}
            </div>
            <div>
              hide_agent_reasoning ={' '}
              {describeBooleanOverride(undefined, hideAgentReasoning, false)}
            </div>
            <div>
              show_raw_agent_reasoning ={' '}
              {describeBooleanOverride(undefined, showRawAgentReasoning, false)}
            </div>
            {typeof modelContextWindow === 'number' && (
              <div>model_context_window = {modelContextWindow} (workflow)</div>
            )}
            {typeof modelAutoCompactTokenLimit === 'number' && (
              <div>
                model_auto_compact_token_limit = {modelAutoCompactTokenLimit} (workflow)
              </div>
            )}
          </div>
        </div>

        {policyWarnings.length > 0 && (
          <div className="grid gap-2">
            {policyWarnings.map((warning) => {
              const warningStyles = getToneStyles(warning.tone)

              return (
                <div
                  key={warning.title}
                  className="rounded-md px-3 py-2 text-[11px] leading-5"
                  style={{
                    color: warningStyles.text,
                    background: warningStyles.background,
                    border: `1px solid ${warningStyles.border}`
                  }}
                >
                  <div
                    className="font-semibold"
                    style={{ color: 'var(--color-ink)' }}
                  >
                    {warning.title}
                  </div>
                  <div className="mt-1">{warning.detail}</div>
                </div>
              )
            })}
          </div>
        )}

        <div>
          <label className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
            Workflow Review Model
          </label>
          <Select
            value={reviewModel ?? ''}
            onChange={(event) => onReviewModelChange(event.target.value || null)}
          >
            <option value="">Use node/run model</option>
            {modelOptions.map((model) => (
              <option key={`workflow-review-${model.id}`} value={model.id}>
                {model.label}
              </option>
            ))}
          </Select>
          <div className="mt-2 text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
            Fallback order: node review model, workflow review model, then the active run model.
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
            Service Tier
          </label>
          <Select
            value={serviceTier ?? ''}
            onChange={(event) => onServiceTierChange(event.target.value || null)}
          >
            <option value="">Use Codex default</option>
            <option value="fast">Fast</option>
            <option value="flex">Flex</option>
          </Select>
          <div className="mt-2 text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
            Applies when a node does not set its own `service_tier`. Codex can also inherit a
            profile or user-level default when both node and workflow stay empty.
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
              Verbosity
            </label>
            <Select
              value={modelVerbosity ?? ''}
              onChange={(event) =>
                onModelVerbosityChange(
                  (event.target.value || null) as 'low' | 'medium' | 'high' | null
                )
              }
            >
              <option value="">Use model default</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
              Reasoning Summary
            </label>
            <Select
              value={modelReasoningSummary ?? ''}
              onChange={(event) =>
                onModelReasoningSummaryChange(
                  (event.target.value || null) as
                    | 'auto'
                    | 'concise'
                    | 'detailed'
                    | 'none'
                    | null
                )
              }
            >
              <option value="">Use model default</option>
              <option value="auto">Auto</option>
              <option value="concise">Concise</option>
              <option value="detailed">Detailed</option>
              <option value="none">None</option>
            </Select>
          </div>
        </div>

        <label
          className="flex items-start gap-3 rounded-md px-3 py-2 text-xs"
          style={{
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-surface-card)',
            color: 'var(--color-ink)'
          }}
        >
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={hideAgentReasoning}
            onChange={(event) => onHideAgentReasoningChange(event.target.checked)}
          />
          <span className="leading-5">
            Hide agent reasoning in Codex output when nodes do not override it.
          </span>
        </label>

        <label
          className="flex items-start gap-3 rounded-md px-3 py-2 text-xs"
          style={{
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-surface-card)',
            color: 'var(--color-ink)'
          }}
        >
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={showRawAgentReasoning}
            onChange={(event) => onShowRawAgentReasoningChange(event.target.checked)}
          />
          <span className="leading-5">
            Show raw reasoning when the active model emits it and nodes do not override it.
          </span>
        </label>

        <div>
          <label className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
            Context Window Hint
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={modelContextWindow ?? ''}
            onChange={(event) =>
              onModelContextWindowChange(parsePositiveInteger(event.target.value))
            }
            className="mt-1 w-full rounded-md px-3 py-2 text-xs"
            style={{
              border: '1px solid var(--color-hairline)',
              background: 'var(--color-surface-card)',
              color: 'var(--color-ink)'
            }}
          />
          <div className="mt-2 text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
            Used by context diagnostics when the active model metadata is missing or incomplete.
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
            Auto-Compact Threshold
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={modelAutoCompactTokenLimit ?? ''}
            onChange={(event) =>
              onModelAutoCompactTokenLimitChange(parsePositiveInteger(event.target.value))
            }
            className="mt-1 w-full rounded-md px-3 py-2 text-xs"
            style={{
              border: '1px solid var(--color-hairline)',
              background: 'var(--color-surface-card)',
              color: 'var(--color-ink)'
            }}
          />
          <div className="mt-2 text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
            Warn when compiled context crosses this token threshold before reruns and branching.
            Fluxion will also flag when short-term or long-term memory is a strong semantic
            compaction candidate.
          </div>
          {compactRatio !== null && (
            <div className="mt-2 text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
              Current threshold posture: about {formatRatio(compactRatio)} of the configured
              context window.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
