import React from 'react'
import { Button } from '@renderer/components/ui/Button'
import { InspectorSection as Section } from './InspectorSection'
import { PreviewCard } from './PreviewCard'
import { LABEL_STYLE, MUTED_NOTE_STYLE } from '../lib/inspector-styles'
import type { TextSummary } from '../lib/node-display'

interface AdvancedSectionProps {
  onEditSystemInstruction: () => void
  systemInstructionSummary: TextSummary
}

export const AdvancedSection: React.FC<AdvancedSectionProps> = ({
  onEditSystemInstruction,
  systemInstructionSummary
}) => (
  <Section title="Advanced">
    <div>
      <label style={LABEL_STYLE}>
        Node System Override{' '}
        <span
          style={{
            fontSize: '10px',
            fontWeight: 400,
            textTransform: 'none',
            letterSpacing: 0,
            color: 'var(--color-muted-soft)',
            marginLeft: '4px'
          }}
        >
          Optional
        </span>
      </label>
      <PreviewCard summary={systemInstructionSummary} emptyTone />
      <div className="mt-2" style={MUTED_NOTE_STYLE}>
        Workspace/global rules stay in Fluxion context. This field only overrides the selected node.
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-2 w-full"
        onClick={onEditSystemInstruction}
      >
        Edit Override
      </Button>
    </div>
  </Section>
)
