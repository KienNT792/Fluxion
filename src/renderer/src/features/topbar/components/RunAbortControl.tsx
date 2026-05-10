import React from 'react'
import { Play, Square } from 'lucide-react'
import { Button } from '@renderer/components/ui/Button'
import { Tooltip } from '@renderer/components/ui/Tooltip'

interface RunAbortControlProps {
  canRun: boolean
  isBusy: boolean
  isStopping: boolean
  onAbort: () => void
  onRun: () => void
  runTooltip: string
}

export const RunAbortControl: React.FC<RunAbortControlProps> = ({
  canRun,
  isBusy,
  isStopping,
  onAbort,
  onRun,
  runTooltip
}) =>
  !isBusy ? (
    <Tooltip content={runTooltip}>
      <Button
        variant="primary"
        size="toolbar"
        className="min-w-[120px] shrink-0"
        onClick={onRun}
        disabled={!canRun}
      >
        <Play size={13} fill="currentColor" />
        Run Workflow
      </Button>
    </Tooltip>
  ) : (
    <Tooltip content={isStopping ? 'Workflow is stopping' : 'Abort current workflow'}>
      <Button
        variant="danger"
        size="toolbar"
        className="min-w-[120px] shrink-0"
        onClick={onAbort}
        disabled={isStopping}
      >
        <Square size={13} fill="currentColor" />
        {isStopping ? 'Stopping' : 'Abort'}
      </Button>
    </Tooltip>
  )
