import React from 'react'
import { Input } from '@renderer/components/ui/Input'
import { InspectorSection as Section } from './InspectorSection'
import { LABEL_STYLE, MUTED_NOTE_STYLE, READONLY_INLINE_STYLE } from '../lib/inspector-styles'

interface OverviewSectionProps {
  currentModelDisplayName: string
  label: string
  onLabelChange: (value: string) => void
  providerNote: string
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  currentModelDisplayName,
  label,
  onLabelChange,
  providerNote
}) => (
  <Section title="Overview">
    <div>
      <label style={LABEL_STYLE}>Node Label</label>
      <Input
        value={label}
        onChange={(event) => onLabelChange(event.target.value)}
        placeholder={currentModelDisplayName}
      />
    </div>

    <div>
      <label style={LABEL_STYLE}>Provider</label>
      <div style={READONLY_INLINE_STYLE}>Codex</div>
    </div>

    <div style={MUTED_NOTE_STYLE}>{providerNote}</div>
  </Section>
)
