import React from 'react'
import { LABEL_STYLE } from '../lib/inspector-styles'

export const InspectorSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children
}) => (
  <div>
    <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--color-hairline)' }}>
      <span style={LABEL_STYLE}>{title}</span>
    </div>
    <div className="space-y-4 px-5 py-5">{children}</div>
  </div>
)
