import React from 'react'
import { AlertTriangle, Copy, ExternalLink, FolderOpen, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@renderer/components/ui/Button'
import { StatusChip } from '@renderer/components/ui/StatusChip'
import { ActivityFileAction } from './TopbarButtons'
import { POPOVER_SURFACE_STYLE } from '../lib/topbar-styles'
import type { AggregateReadinessRow, AggregateReadinessState } from '../lib/topbar-status'
import type { WorkspaceActivityItem } from '../lib/workspace-activity'

interface CodexReadinessView {
  detail: string
  label: string
  summary: string
}

interface ReadinessClusterProps {
  activityDetailItems: WorkspaceActivityItem[]
  aggregateReadiness: AggregateReadinessState
  approvalGuardrail: {
    message?: string
    nodeId?: string
    severity: 'ok' | 'warning' | 'blocked'
    summary?: string
  }
  codexReadiness: CodexReadinessView
  disabled: boolean
  hasExternalWorkflowChange: boolean
  isLoading: boolean
  isOpen: boolean
  onCopyPath: (filePath: string) => void
  onFixPermissions: () => void
  onOpenContext: () => void
  onOpenPath: (filePath: string) => void
  onRefresh: () => void
  onReload: () => void
  onRevealPath: (filePath: string) => void
  onToggle: () => void
  readinessClusterRef: React.RefObject<HTMLDivElement | null>
}

export const ReadinessCluster: React.FC<ReadinessClusterProps> = ({
  activityDetailItems,
  aggregateReadiness,
  approvalGuardrail,
  codexReadiness,
  disabled,
  hasExternalWorkflowChange,
  isLoading,
  isOpen,
  onCopyPath,
  onFixPermissions,
  onOpenContext,
  onOpenPath,
  onRefresh,
  onReload,
  onRevealPath,
  onToggle,
  readinessClusterRef
}) => (
  <div className="relative" ref={readinessClusterRef}>
    <button
      type="button"
      aria-label={`Workspace readiness: ${aggregateReadiness.label}`}
      aria-expanded={isOpen}
      onClick={onToggle}
      className="inline-flex items-center"
    >
      <StatusChip
        tone={aggregateReadiness.tone}
        label={isLoading ? 'Checking readiness' : aggregateReadiness.label}
        title={aggregateReadiness.detail}
        animate={isLoading || aggregateReadiness.animate}
        className="max-w-[190px]"
      />
    </button>

    {isOpen && (
      <div
        className="absolute right-0 top-[calc(100%+10px)] z-50 w-[420px] p-3"
        style={POPOVER_SURFACE_STYLE}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span
              className="text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
            >
              Readiness
            </span>
            <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              {aggregateReadiness.label}
            </p>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
              {aggregateReadiness.detail}
            </p>
          </div>
          <StatusChip tone={aggregateReadiness.tone} label={aggregateReadiness.label} />
        </div>

        <div className="mt-3 space-y-2">
          {aggregateReadiness.rows.map((row) => (
            <ReadinessRow
              key={row.id}
              approvalGuardrail={approvalGuardrail}
              codexReadiness={codexReadiness}
              disabled={disabled}
              hasExternalWorkflowChange={hasExternalWorkflowChange}
              isLoading={isLoading}
              onFixPermissions={onFixPermissions}
              onOpenContext={onOpenContext}
              onRefresh={onRefresh}
              onReload={onReload}
              row={row}
            />
          ))}
        </div>

        {activityDetailItems.length > 0 && (
          <div className="mt-3 space-y-2">
            {activityDetailItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-2 rounded-md px-2 py-2"
                style={{
                  background: 'var(--color-canvas)',
                  border: '1px solid var(--color-hairline)'
                }}
                title={item.relativePath}
              >
                <span
                  className="shrink-0 text-xs font-semibold"
                  style={{ color: item.tokenColor, fontFamily: 'var(--font-mono)' }}
                >
                  {item.token}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenPath(item.filePath)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div
                    className="truncate text-xs font-semibold"
                    style={{ color: 'var(--color-ink)' }}
                  >
                    {item.basename}
                  </div>
                  <div
                    className="mt-0.5 flex min-w-0 items-center gap-2 text-[10px]"
                    style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                  >
                    <span className="truncate">{item.parentPath}</span>
                    <span className="shrink-0">{item.receivedAt}</span>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-0.5">
                  <ActivityFileAction
                    label="Open"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenPath(item.filePath)
                    }}
                  >
                    <ExternalLink size={13} />
                  </ActivityFileAction>
                  <ActivityFileAction
                    label="Reveal"
                    onClick={(event) => {
                      event.stopPropagation()
                      onRevealPath(item.filePath)
                    }}
                  >
                    <FolderOpen size={13} />
                  </ActivityFileAction>
                  <ActivityFileAction
                    label="Copy path"
                    onClick={(event) => {
                      event.stopPropagation()
                      onCopyPath(item.filePath)
                    }}
                  >
                    <Copy size={13} />
                  </ActivityFileAction>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}
  </div>
)

function ReadinessRow({
  approvalGuardrail,
  codexReadiness,
  disabled,
  hasExternalWorkflowChange,
  isLoading,
  onFixPermissions,
  onOpenContext,
  onRefresh,
  onReload,
  row
}: {
  approvalGuardrail: ReadinessClusterProps['approvalGuardrail']
  codexReadiness: CodexReadinessView
  disabled: boolean
  hasExternalWorkflowChange: boolean
  isLoading: boolean
  onFixPermissions: () => void
  onOpenContext: () => void
  onRefresh: () => void
  onReload: () => void
  row: AggregateReadinessRow
}): React.JSX.Element {
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-md px-3 py-2"
      style={{
        background: 'var(--color-canvas)',
        border: '1px solid var(--color-hairline)'
      }}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
            {row.label}
          </span>
          <StatusChip tone={row.tone} label={row.value} className="max-w-[150px]" />
        </div>
        {row.detail && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-4" style={{ color: 'var(--color-muted)' }}>
            {row.id === 'codex' ? codexReadiness.summary : row.detail}
          </p>
        )}
      </div>

      {row.id === 'context' && row.tone !== 'success' && (
        <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={onOpenContext}>
          <Sparkles size={13} />
          Review
        </Button>
      )}

      {row.id === 'codex' && (
        <Button type="button" variant="secondary" size="sm" disabled={disabled || isLoading} onClick={onRefresh}>
          <RefreshCw size={13} />
          {isLoading ? 'Checking' : 'Refresh'}
        </Button>
      )}

      {row.id === 'activity' && hasExternalWorkflowChange && (
        <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={onReload}>
          <AlertTriangle size={13} />
          Reload
        </Button>
      )}

      {row.id === 'permissions' && approvalGuardrail.severity !== 'ok' && approvalGuardrail.nodeId && (
        <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={onFixPermissions}>
          Fix
        </Button>
      )}
    </div>
  )
}
