import React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

export interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  delayDuration?: number
}

export const TooltipProvider = TooltipPrimitive.Provider

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
  align = 'center',
  delayDuration = 300
}) => {
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={5}
          className="z-50 px-2 py-1.5 rounded-md animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 duration-200"
          style={{
            background: 'var(--color-ink)',
            color: 'var(--color-canvas)',
            fontSize: '11px',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            maxWidth: '300px',
            wordWrap: 'break-word'
          }}
        >
          {content}
          <TooltipPrimitive.Arrow
            className="fill-current"
            style={{ color: 'var(--color-ink)' }}
            width={8}
            height={4}
          />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
