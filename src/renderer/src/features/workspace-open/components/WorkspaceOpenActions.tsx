import React from 'react'
import { AlertTriangle, FolderOpen, Upload } from 'lucide-react'
import { PrerequisiteBlock } from './PrerequisiteBlock'

interface WorkspaceOpenActionsProps {
  actionCommand?: string
  isDragActive: boolean
  isWorkspaceOpening: boolean
  onOpenWorkspace: () => void
  prerequisiteCode: 'cli_missing' | 'windowsapps_alias_blocked' | 'auth_missing' | null
  workspaceActionError: string | null
}

export const WorkspaceOpenActions: React.FC<WorkspaceOpenActionsProps> = ({
  actionCommand,
  isDragActive,
  isWorkspaceOpening,
  onOpenWorkspace,
  prerequisiteCode,
  workspaceActionError
}) => (
  <>
    <div className="flex flex-col gap-3">
      <span
        className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
        style={{
          background: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-canvas-soft))',
          color: 'var(--color-primary)'
        }}
      >
        Workspace launcher
      </span>

      <h1
        style={{
          fontFamily: "'CursorGothic', system-ui, 'Helvetica Neue', Helvetica, Arial, sans-serif",
          fontSize: '32px',
          fontWeight: 400,
          lineHeight: 1.15,
          color: 'var(--color-ink)',
          margin: 0
        }}
      >
        Open a repository to start.
      </h1>

      <p
        className="max-w-[620px] text-sm leading-6"
        style={{ color: 'var(--color-muted)', margin: 0 }}
      >
        Fluxion prepares project context, workflow scaffolds, and reviewable Codex runs from a local
        workspace.
      </p>
    </div>

    {prerequisiteCode ? (
      <PrerequisiteBlock code={prerequisiteCode} actionCommand={actionCommand} />
    ) : null}

    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={onOpenWorkspace}
        disabled={isWorkspaceOpening}
        className="flex flex-col items-start gap-2 rounded-lg px-5 py-4 text-left transition-colors disabled:cursor-not-allowed"
        style={{
          background: 'var(--color-primary)',
          color: 'var(--color-on-primary)',
          border: '1px solid transparent',
          minHeight: '104px'
        }}
        onMouseEnter={(event) => {
          if (!isWorkspaceOpening) {
            event.currentTarget.style.background = 'var(--color-primary-active)'
          }
        }}
        onMouseLeave={(event) => {
          if (!isWorkspaceOpening) {
            event.currentTarget.style.background = 'var(--color-primary)'
          }
        }}
      >
        <FolderOpen size={20} />
        <span className="text-sm font-medium">
          {isWorkspaceOpening ? 'Opening...' : 'Open Workspace'}
        </span>
        <span className="text-xs" style={{ opacity: 0.8 }}>
          Open an existing repository
        </span>
      </button>

      <div
        className="flex flex-col items-start gap-2 rounded-lg px-5 py-4 text-left transition-colors"
        style={{
          background: isDragActive ? 'var(--color-canvas-soft)' : 'var(--color-surface-card)',
          color: 'var(--color-ink)',
          border: isDragActive
            ? '1px solid var(--color-primary)'
            : '1px solid var(--color-hairline)',
          minHeight: '104px',
          boxShadow: isDragActive
            ? '0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent)'
            : 'none'
        }}
      >
        <Upload size={20} style={{ color: 'var(--color-muted)' }} />
        <span className="text-sm font-medium">Drag & Drop Folder</span>
        <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
          Drop a project folder here
        </span>
      </div>
    </div>

    {workspaceActionError ? (
      <div
        className="flex items-start gap-2 rounded-md px-3 py-2 text-xs leading-5"
        style={{
          color: 'var(--color-semantic-error)',
          background: 'var(--color-canvas)',
          border: '1px solid var(--color-hairline)'
        }}
      >
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>{workspaceActionError}</span>
      </div>
    ) : null}
  </>
)
