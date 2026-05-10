import React from 'react'
import { ChevronDown, FolderOpen, Plus, Save, Sparkles } from 'lucide-react'
import { ActionTextButton } from './TopbarButtons'
import { POPOVER_SURFACE_STYLE } from '../lib/topbar-styles'

interface ProjectMenuProps {
  canSave: boolean
  dimmed: boolean
  disabled: boolean
  isOpen: boolean
  isWorkspaceOpening: boolean
  onCreateWorkflow: () => void
  onOpenWorkspace: () => void
  onRunOnboarding: () => void
  onSave: () => void
  onToggle: () => void
  projectMenuRef: React.RefObject<HTMLDivElement | null>
  workspacePath: string | null
}

export const ProjectMenu: React.FC<ProjectMenuProps> = ({
  canSave,
  dimmed,
  disabled,
  isOpen,
  isWorkspaceOpening,
  onCreateWorkflow,
  onOpenWorkspace,
  onRunOnboarding,
  onSave,
  onToggle,
  projectMenuRef,
  workspacePath
}) => (
  <div className="relative" ref={projectMenuRef}>
    <ActionTextButton
      aria-expanded={isOpen}
      onClick={onToggle}
      disabled={disabled}
      dimmed={dimmed}
      className="hidden sm:inline-flex"
    >
      <span>Project</span>
      <ChevronDown size={14} />
    </ActionTextButton>

    {isOpen && (
      <div
        className="absolute right-0 top-[calc(100%+10px)] z-[90] w-[220px] p-2"
        style={POPOVER_SURFACE_STYLE}
      >
        <button
          type="button"
          onClick={onOpenWorkspace}
          disabled={isWorkspaceOpening}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-canvas)] disabled:cursor-not-allowed"
          style={{
            color: isWorkspaceOpening ? 'var(--color-muted-soft)' : 'var(--color-ink)'
          }}
        >
          <FolderOpen size={14} />
          {isWorkspaceOpening ? 'Opening...' : 'Open Workspace'}
        </button>

        <button
          type="button"
          onClick={onCreateWorkflow}
          disabled={!workspacePath || disabled}
          className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-canvas)] disabled:cursor-not-allowed"
          style={{
            color: !workspacePath || disabled ? 'var(--color-muted-soft)' : 'var(--color-ink)'
          }}
        >
          <Plus size={14} />
          New Workflow
        </button>

        <button
          type="button"
          onClick={onRunOnboarding}
          disabled={!workspacePath || disabled}
          className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-canvas)] disabled:cursor-not-allowed"
          style={{
            color: !workspacePath || disabled ? 'var(--color-muted-soft)' : 'var(--color-ink)'
          }}
        >
          <Sparkles size={14} />
          Run Onboarding
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-canvas)] disabled:cursor-not-allowed"
          style={{
            color: canSave ? 'var(--color-ink)' : 'var(--color-muted-soft)'
          }}
        >
          <Save size={14} />
          Save Workflow
        </button>
      </div>
    )}
  </div>
)
