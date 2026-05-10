import React from 'react'
import { Sparkles } from 'lucide-react'
import { StatusChip, StatusChipTone } from '@renderer/components/ui/StatusChip'
import { Tooltip } from '@renderer/components/ui/Tooltip'
import { ActionTextButton } from './TopbarButtons'

interface ContextChipState {
  detail: string
  label: string
  tone: StatusChipTone
}

interface ContextControlProps {
  contextChipState: ContextChipState
  dimmed: boolean
  disabled: boolean
  onOpenContext: () => void
}

export const ContextControl: React.FC<ContextControlProps> = ({
  contextChipState,
  dimmed,
  disabled,
  onOpenContext
}) => (
  <Tooltip content={contextChipState.detail}>
    <ActionTextButton
      aria-label={contextChipState.label}
      onClick={onOpenContext}
      disabled={disabled}
      dimmed={dimmed}
    >
      <Sparkles size={14} />
      <span className="hidden lg:inline">Context</span>
      <StatusChip
        tone={contextChipState.tone}
        label={contextChipState.label.replace('Context ', '')}
        className="hidden xl:inline-flex"
      />
    </ActionTextButton>
  </Tooltip>
)
