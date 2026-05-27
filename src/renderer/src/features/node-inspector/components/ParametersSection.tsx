import React from 'react'
import type { CodexReasoningSummary, CodexVerbosity, ModelId, ReasoningLevel } from '@shared'
import { CODEX_DEFAULT_REASONING_LEVEL } from '@shared'
import { Select } from '@renderer/components/ui/Select'
import { InspectorSection as Section } from './InspectorSection'
import { LABEL_STYLE, MUTED_NOTE_STYLE } from '../lib/inspector-styles'
import { ModelOption, REASONING_LEVEL_LABELS } from '../lib/node-display'
import {
  describeBooleanOverride,
  describeReviewModelFallback,
  describeStringOverride
} from '../lib/effective-policy'

interface ParametersSectionProps {
  currentDefaultReasoningLevel?: ReasoningLevel
  currentModel: ModelId
  currentReviewModel?: ModelId
  workflowReviewModel?: ModelId
  workflowServiceTier?: string
  workflowModelVerbosity?: CodexVerbosity
  workflowModelReasoningSummary?: CodexReasoningSummary
  workflowHideAgentReasoning?: boolean
  workflowShowRawAgentReasoning?: boolean
  hideAgentReasoning?: boolean
  humanReview: boolean
  isReasoningModel: boolean
  modelReasoningSummary?: CodexReasoningSummary
  modelVerbosity?: CodexVerbosity
  modelOptions: ModelOption[]
  onHumanReviewChange: (checked: boolean) => void
  onModelChange: (model: ModelId) => void
  onHideAgentReasoningChange: (checked: boolean) => void
  onModelReasoningSummaryChange: (value?: CodexReasoningSummary) => void
  onModelVerbosityChange: (value?: CodexVerbosity) => void
  onReviewModelChange: (model?: ModelId) => void
  onReasoningLevelChange: (level: ReasoningLevel) => void
  onServiceTierChange: (value?: string) => void
  onShowRawAgentReasoningChange: (checked: boolean) => void
  providerNote: string
  reasoningLevel?: ReasoningLevel
  reasoningOptions: ReasoningLevel[]
  reviewModeNote: string
  serviceTier?: string
  showRawAgentReasoning?: boolean
}

export const ParametersSection: React.FC<ParametersSectionProps> = ({
  currentDefaultReasoningLevel,
  currentModel,
  currentReviewModel,
  workflowReviewModel,
  workflowServiceTier,
  workflowModelVerbosity,
  workflowModelReasoningSummary,
  workflowHideAgentReasoning,
  workflowShowRawAgentReasoning,
  hideAgentReasoning,
  humanReview,
  isReasoningModel,
  modelReasoningSummary,
  modelVerbosity,
  modelOptions,
  onHumanReviewChange,
  onModelChange,
  onHideAgentReasoningChange,
  onModelReasoningSummaryChange,
  onModelVerbosityChange,
  onReviewModelChange,
  onReasoningLevelChange,
  onServiceTierChange,
  onShowRawAgentReasoningChange,
  providerNote,
  reasoningLevel,
  reasoningOptions,
  reviewModeNote,
  serviceTier,
  showRawAgentReasoning
}) => (
  <Section title="Run">
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
        Effective node policy
      </div>
        <div className="grid gap-1" style={{ fontFamily: 'var(--font-mono)' }}>
          <div>
          review_model = {describeReviewModelFallback(currentReviewModel, workflowReviewModel)}
          </div>
        <div>
          service_tier = {describeStringOverride(serviceTier, workflowServiceTier, 'Codex default')}
        </div>
        <div>
          model_verbosity ={' '}
          {describeStringOverride(modelVerbosity, workflowModelVerbosity, 'model default')}
        </div>
        <div>
          model_reasoning_summary ={' '}
          {describeStringOverride(
            modelReasoningSummary,
            workflowModelReasoningSummary,
            'model default'
          )}
        </div>
        <div>
          hide_agent_reasoning ={' '}
          {describeBooleanOverride(hideAgentReasoning, workflowHideAgentReasoning, false)}
        </div>
        <div>
          show_raw_agent_reasoning ={' '}
          {describeBooleanOverride(
            showRawAgentReasoning,
            workflowShowRawAgentReasoning,
            false
          )}
        </div>
      </div>
    </div>

    <div>
      <label style={LABEL_STYLE}>Model</label>
      <Select
        value={currentModel}
        onChange={(event) => onModelChange(event.target.value as ModelId)}
        tone="accent"
      >
        {modelOptions.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </Select>
      <div className="mt-2" style={MUTED_NOTE_STYLE}>
        {providerNote}
      </div>
    </div>

    <div>
      <label style={LABEL_STYLE}>Human Review Checkpoint</label>
      <label
        className="flex items-center gap-2 rounded-md px-3 py-2"
        style={{
          border: '1px solid var(--color-hairline)',
          background: 'var(--color-surface-card)',
          cursor: 'pointer'
        }}
      >
        <input
          type="checkbox"
          checked={humanReview}
          onChange={(event) => onHumanReviewChange(event.target.checked)}
        />
        <span className="text-xs" style={{ color: 'var(--color-ink)' }}>
          Pause after this node when review is required
        </span>
      </label>
      <div className="mt-2" style={MUTED_NOTE_STYLE}>
        {reviewModeNote}
      </div>
    </div>

    <div>
      <label style={LABEL_STYLE}>Review Model</label>
      <Select
        value={currentReviewModel ?? ''}
        onChange={(event) =>
          onReviewModelChange(event.target.value ? (event.target.value as ModelId) : undefined)
        }
      >
        <option value="">Use run model</option>
        {modelOptions.map((model) => (
          <option key={`review-${model.id}`} value={model.id}>
            {model.label}
          </option>
        ))}
      </Select>
      <div className="mt-2" style={MUTED_NOTE_STYLE}>
        Keep a faster run model and a stricter review model separate when review quality matters.
        Leave empty to inherit the workflow review model first, then the active run model.
      </div>
    </div>

    <div>
      <label style={LABEL_STYLE}>Service Tier</label>
      <Select
        value={serviceTier ?? ''}
        onChange={(event) => onServiceTierChange(event.target.value || undefined)}
      >
        <option value="">Use Codex default</option>
        <option value="fast">fast</option>
        <option value="flex">flex</option>
        <option value="priority">priority</option>
      </Select>
      <div className="mt-2" style={MUTED_NOTE_STYLE}>
        Mirrors Codex `service_tier`. Leave empty to inherit the workflow fallback first, then
        profile or user config.
      </div>
    </div>

    {isReasoningModel && reasoningOptions.length > 0 && (
      <div>
        <label style={{ ...LABEL_STYLE, color: 'var(--color-timeline-done)' }}>
          Reasoning Effort
        </label>
        <div
          className="flex gap-1 rounded-lg p-1"
          style={{
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-hairline)'
          }}
        >
          {reasoningOptions.map((level) => {
            const isActive =
              (reasoningLevel ?? currentDefaultReasoningLevel ?? CODEX_DEFAULT_REASONING_LEVEL) ===
              level

            return (
              <button
                key={level}
                type="button"
                onClick={() => onReasoningLevelChange(level)}
                className="flex-1 rounded-md py-2 text-center transition-all"
                style={{
                  background: isActive ? 'var(--color-timeline-done)' : 'transparent',
                  opacity: isActive ? 1 : 0.7
                }}
              >
                <div
                  className="text-xs font-semibold"
                  style={{ color: isActive ? '#fff' : 'var(--color-body)' }}
                >
                  {REASONING_LEVEL_LABELS[level].label}
                </div>
                <div
                  className="mt-0.5 text-[9px]"
                  style={{
                    color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--color-muted)'
                  }}
                >
                  {REASONING_LEVEL_LABELS[level].hint}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )}

    <div>
      <label style={LABEL_STYLE}>Verbosity</label>
      <Select
        value={modelVerbosity ?? ''}
        onChange={(event) =>
          onModelVerbosityChange((event.target.value as CodexVerbosity) || undefined)
        }
      >
        <option value="">Use model default</option>
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
      </Select>
      <div className="mt-2" style={MUTED_NOTE_STYLE}>
        Leave empty to inherit the workflow verbosity fallback first, then the model default.
      </div>
    </div>

    <div>
      <label style={LABEL_STYLE}>Reasoning Summary</label>
      <Select
        value={modelReasoningSummary ?? ''}
        onChange={(event) =>
          onModelReasoningSummaryChange(
            (event.target.value as CodexReasoningSummary) || undefined
          )
        }
      >
        <option value="">Use model default</option>
        <option value="auto">auto</option>
        <option value="concise">concise</option>
        <option value="detailed">detailed</option>
        <option value="none">none</option>
      </Select>
      <div className="mt-2" style={MUTED_NOTE_STYLE}>
        Leave empty to inherit the workflow reasoning-summary fallback first, then the model
        default.
      </div>
    </div>

    <div className="grid gap-2">
      <label
        className="flex items-center gap-2 rounded-md px-3 py-2"
        style={{
          border: '1px solid var(--color-hairline)',
          background: 'var(--color-surface-card)',
          cursor: 'pointer'
        }}
      >
        <input
          type="checkbox"
          checked={Boolean(hideAgentReasoning)}
          onChange={(event) => onHideAgentReasoningChange(event.target.checked)}
        />
        <span className="text-xs" style={{ color: 'var(--color-ink)' }}>
          Hide reasoning events in output
        </span>
      </label>
      <label
        className="flex items-center gap-2 rounded-md px-3 py-2"
        style={{
          border: '1px solid var(--color-hairline)',
          background: 'var(--color-surface-card)',
          cursor: 'pointer'
        }}
      >
        <input
          type="checkbox"
          checked={Boolean(showRawAgentReasoning)}
          onChange={(event) => onShowRawAgentReasoningChange(event.target.checked)}
        />
        <span className="text-xs" style={{ color: 'var(--color-ink)' }}>
          Surface raw reasoning when the model emits it
        </span>
      </label>
      <div style={MUTED_NOTE_STYLE}>
        These visibility toggles only change whether reasoning content is shown in output. Node
        values win when set; otherwise the workflow fallback applies.
      </div>
    </div>
  </Section>
)
