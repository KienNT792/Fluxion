import React from 'react'
import { BookOpen } from 'lucide-react'
import { useWorkflowStore } from '../../stores/workflow.store'
import { ProjectContextInspector } from '@renderer/features/project-context/inspector/ProjectContextInspector'
import { PropertiesPanel } from '@renderer/features/node-inspector/PropertiesPanel'
import { ErrorBoundary } from '../ui/ErrorBoundary'

/**
 * Persistent right inspector panel.
 *
 * - Always rendered (never conditionally removed from DOM).
 * - Shows `ProjectContextInspector` when no node is selected.
 * - Shows `PropertiesPanel` when a node is selected.
 * - Width: clamp(340px, 28vw, 420px).
 * - Independent vertical scrolling.
 */
export const RightInspector: React.FC = () => {
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId)
  const hasNodeSelected = selectedNodeId != null

  return (
    <aside
      className="z-40 flex h-full flex-col overflow-hidden"
      style={{
        width: 'clamp(340px, 28vw, 420px)',
        flexShrink: 0,
        background: 'var(--color-canvas)',
        borderLeft: '1px solid var(--color-hairline)'
      }}
    >
      {hasNodeSelected ? (
        <ErrorBoundary fallbackTitle="Config panel crashed">
          <PropertiesPanel />
        </ErrorBoundary>
      ) : (
        <>
          {/* Panel header */}
          <div
            className="flex h-12 flex-shrink-0 items-center gap-2.5 px-5"
            style={{
              background: 'var(--color-surface-card)',
              borderBottom: '1px solid var(--color-hairline)'
            }}
          >
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md"
              style={{
                background: 'var(--color-canvas)',
                border: '1px solid var(--color-hairline)',
                color: 'var(--color-muted)'
              }}
            >
              <BookOpen size={14} />
            </div>
            <span
              className="text-xs font-semibold"
              style={{ color: 'var(--color-ink)', letterSpacing: '-0.1px' }}
            >
              Project Context
            </span>
          </div>

          {/* Context inspector content (scrollable) */}
          <ProjectContextInspector />
        </>
      )}
    </aside>
  )
}
