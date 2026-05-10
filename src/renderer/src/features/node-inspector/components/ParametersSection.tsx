import React from 'react'
import type { ModelId, ReasoningLevel } from '@shared'
import { CODEX_DEFAULT_REASONING_LEVEL } from '@shared'
import { Select } from '@renderer/components/ui/Select'
import { InspectorSection as Section } from './InspectorSection'
import { LABEL_STYLE, MUTED_NOTE_STYLE } from '../lib/inspector-styles'
import { ModelOption, REASONING_LEVEL_LABELS } from '../lib/node-display'

interface ParametersSectionProps {
  currentDefaultReasoningLevel?: ReasoningLevel
  currentModel: ModelId
  humanReview: boolean
  isReasoningModel: boolean
  modelOptions: ModelOption[]
  onHumanReviewChange: (checked: boolean) => void
  onModelChange: (model: ModelId) => void
  onReasoningLevelChange: (level: ReasoningLevel) => void
  reasoningLevel?: ReasoningLevel
  reasoningOptions: ReasoningLevel[]
  reviewModeNote: string
}

export const ParametersSection: React.FC<ParametersSectionProps> = ({
  currentDefaultReasoningLevel,
  currentModel,
  humanReview,
  isReasoningModel,
  modelOptions,
  onHumanReviewChange,
  onModelChange,
  onReasoningLevelChange,
  reasoningLevel,
  reasoningOptions,
  reviewModeNote
}) => (
  <Section title="Parameters">
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
  </Section>
)
