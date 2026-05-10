import React from 'react'
import { Button } from '@renderer/components/ui/Button'
import { InspectorSection as Section } from './InspectorSection'
import { PreviewCard } from './PreviewCard'
import { LABEL_STYLE } from '../lib/inspector-styles'
import type { TextSummary } from '../lib/node-display'

interface InstructionsSectionProps {
  onEditPrompt: () => void
  promptSummary: TextSummary
}

export const InstructionsSection: React.FC<InstructionsSectionProps> = ({
  onEditPrompt,
  promptSummary
}) => (
  <Section title="Instructions">
    <div>
      <label style={LABEL_STYLE}>Prompt</label>
      <PreviewCard summary={promptSummary} />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-2 w-full"
        onClick={onEditPrompt}
      >
        Edit Prompt
      </Button>
    </div>
  </Section>
)
