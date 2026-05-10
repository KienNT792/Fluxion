import React from 'react'
import type { NodeInspectorTab } from '../lib/inspector-tabs'

const TABS: Array<{ id: NodeInspectorTab; label: string }> = [
  { id: 'prompt', label: 'Prompt' },
  { id: 'run', label: 'Run' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'output', label: 'Output' },
  { id: 'advanced', label: 'Advanced' }
]

interface NodeInspectorTabsProps {
  activeTab: NodeInspectorTab
  onChange: (tab: NodeInspectorTab) => void
}

export const NodeInspectorTabs: React.FC<NodeInspectorTabsProps> = ({ activeTab, onChange }) => (
  <div
    className="flex flex-shrink-0 gap-1 overflow-x-auto px-4 py-2"
    style={{
      background: 'var(--color-canvas-soft)',
      borderBottom: '1px solid var(--color-hairline)'
    }}
  >
    {TABS.map((tab) => {
      const isActive = activeTab === tab.id

      return (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
          style={{
            background: isActive ? 'var(--color-surface-card)' : 'transparent',
            border: `1px solid ${isActive ? 'var(--color-hairline)' : 'transparent'}`,
            color: isActive ? 'var(--color-ink)' : 'var(--color-muted)'
          }}
        >
          {tab.label}
        </button>
      )
    })}
  </div>
)
