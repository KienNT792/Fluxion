import React from 'react'
import { AlertTriangle, Copy, ExternalLink, Files, FolderOpen } from 'lucide-react'
import { Button } from '@renderer/components/ui/Button'
import { Tooltip } from '@renderer/components/ui/Tooltip'
import { ActionIconButton, ActivityFileAction } from './TopbarButtons'
import { POPOVER_SURFACE_STYLE } from '../lib/topbar-styles'
import type { WorkspaceActivityItem } from '../lib/workspace-activity'

interface WorkspaceActivityPopoverProps {
  activityDetailItems: WorkspaceActivityItem[]
  activityHasAttention: boolean
  activityPopoverRef: React.RefObject<HTMLDivElement | null>
  activitySummaryLabel: string
  hasExternalWorkflowChange: boolean
  isBusy: boolean
  isOpen: boolean
  onCopyPath: (filePath: string) => void
  onOpenPath: (filePath: string) => void
  onReload: () => void
  onRevealPath: (filePath: string) => void
  onToggle: () => void
}

export const WorkspaceActivityPopover: React.FC<WorkspaceActivityPopoverProps> = ({
  activityDetailItems,
  activityHasAttention,
  activityPopoverRef,
  activitySummaryLabel,
  hasExternalWorkflowChange,
  isBusy,
  isOpen,
  onCopyPath,
  onOpenPath,
  onReload,
  onRevealPath,
  onToggle
}) => (
  <div className="relative" ref={activityPopoverRef}>
    <Tooltip content={activitySummaryLabel}>
      <ActionIconButton
        aria-label="Open workspace activity"
        aria-expanded={isOpen}
        onClick={onToggle}
        style={{
          color: hasExternalWorkflowChange ? 'var(--color-semantic-error)' : 'var(--color-muted)'
        }}
      >
        <Files size={16} />
        {activityHasAttention && (
          <span
            className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
            style={{
              background: hasExternalWorkflowChange
                ? 'var(--color-semantic-error)'
                : 'var(--color-status-completed)'
            }}
          />
        )}
      </ActionIconButton>
    </Tooltip>

    {isOpen && (
      <div
        className="absolute right-0 top-[calc(100%+10px)] z-50 w-[380px] p-3"
        style={POPOVER_SURFACE_STYLE}
      >
        <div className="flex items-center justify-between gap-3">
          <span
            className="text-[11px] uppercase tracking-[0.08em]"
            style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
          >
            Activity
          </span>
          <span
            className="text-[11px]"
            style={{ color: 'var(--color-muted-soft)', fontFamily: 'var(--font-mono)' }}
          >
            {activitySummaryLabel}
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {activityDetailItems.length > 0 ? (
            activityDetailItems.map((item) => (
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
                    style={{
                      color: 'var(--color-muted)',
                      fontFamily: 'var(--font-mono)'
                    }}
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
            ))
          ) : (
            <p
              className="rounded-md px-3 py-2 text-xs"
              style={{
                color: 'var(--color-muted)',
                background: 'var(--color-canvas)',
                border: '1px solid var(--color-hairline)',
                fontFamily: 'var(--font-mono)'
              }}
            >
              No recent file changes.
            </p>
          )}
        </div>

        {hasExternalWorkflowChange && (
          <div
            className="mt-3 flex items-center justify-between gap-3 rounded-md px-3 py-2"
            style={{
              background: 'var(--color-canvas)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            <div className="min-w-0">
              <p className="text-xs font-medium" style={{ color: 'var(--color-ink)' }}>
                Workflow file changed on disk
              </p>
              <p
                className="mt-1 text-[11px]"
                style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
              >
                Reload to sync the canvas with disk.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={onReload} disabled={isBusy}>
              <AlertTriangle size={13} />
              Reload
            </Button>
          </div>
        )}
      </div>
    )}
  </div>
)
