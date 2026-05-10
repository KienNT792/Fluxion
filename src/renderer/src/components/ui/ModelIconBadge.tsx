import React from 'react'
import { getModelIconSignature } from './model-icon-badge.helpers'

interface ModelIconBadgeProps {
  className?: string
  displayName?: string
  modelId: string
  size?: 'sm' | 'md'
}

export const ModelIconBadge: React.FC<ModelIconBadgeProps> = ({
  className = '',
  displayName,
  modelId,
  size = 'md'
}) => {
  const signature = getModelIconSignature(modelId, displayName)
  const dimensionClass = size === 'sm' ? 'h-7 w-7 text-[9px]' : 'h-8 w-8 text-[10px]'

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-md font-semibold ${dimensionClass} ${className}`}
      style={{
        background: signature.background,
        border: '1px solid var(--color-hairline)',
        color: signature.accentColor,
        fontFamily: 'var(--font-mono)',
        letterSpacing: 0
      }}
      title={signature.title}
      aria-label={`Model: ${signature.title}`}
    >
      {signature.label}
    </div>
  )
}
