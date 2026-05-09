import React from 'react'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  FolderOpen,
  Layers,
  MessageCircle,
  Play,
  Settings,
  ShieldCheck,
  Terminal,
  Upload,
  User,
  Workflow
} from 'lucide-react'
import {
  getCodexReadiness,
  getCodexReadinessBadgeState,
  getProviderReadinessSummary
} from '@renderer/lib/provider-capabilities'
import { openWorkspaceFromDialog, openWorkspacePath } from '@renderer/lib/workflow-session'
import { useWorkspaceTrustPrompt } from '@renderer/hooks/useWorkspaceTrustPrompt'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { Button } from '@renderer/components/ui/Button'
import { StatusChip, StatusChipTone } from '@renderer/components/ui/StatusChip'
import { Tooltip } from '@renderer/components/ui/Tooltip'
import { GlobalSettingsDialog } from '@renderer/features/settings/GlobalSettingsDialog'
import { PrerequisiteBlock } from './components/PrerequisiteBlock'
import { RecentWorkspaceRow } from './components/RecentWorkspaceRow'
import { useRecentWorkspaces } from './hooks/useRecentWorkspaces'
import { getErrorMessage, hasFileDrop } from './lib/workspace-open-helpers'
import { WorkspaceOpeningOverlay } from './WorkspaceOpeningOverlay'

export const WelcomeScreen: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)
  const [isDragActive, setIsDragActive] = React.useState(false)
  const [workspaceActionError, setWorkspaceActionError] = React.useState<string | null>(null)
  const { handleRemoveRecentWorkspace, handleRevealRecentWorkspace, recentWorkspaces } =
    useRecentWorkspaces(setWorkspaceActionError)
  const dragDepthRef = React.useRef(0)
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities)
  const workspaceOpenState = useWorkflowStore((state) => state.workspaceOpenState)
  const isProviderCapabilitiesLoading = useWorkflowStore(
    (state) => state.isProviderCapabilitiesLoading
  )
  const hasFetchedProviderCapabilities = useWorkflowStore(
    (state) => state.hasFetchedProviderCapabilities
  )
  const fetchProviderCapabilities = useWorkflowStore((state) => state.fetchProviderCapabilities)
  const { requestWorkspaceTrust, trustDialog } = useWorkspaceTrustPrompt()
  const codexReadiness = getCodexReadinessBadgeState(providerCapabilities, [])
  const codexRawReadiness = getCodexReadiness(providerCapabilities)
  const providerReadiness = getProviderReadinessSummary(providerCapabilities)

  // Determine if we should show a prerequisite hard-block for Stage 1.
  // cli_missing and auth_missing are the two distinct states that need separate copy.
  const prerequisiteCode =
    !isProviderCapabilitiesLoading && hasFetchedProviderCapabilities
      ? codexRawReadiness?.code === 'cli_missing' || codexRawReadiness?.code === 'auth_missing'
        ? codexRawReadiness.code
        : null
      : null

  React.useEffect(() => {
    if (!hasFetchedProviderCapabilities) {
      void fetchProviderCapabilities()
    }
  }, [fetchProviderCapabilities, hasFetchedProviderCapabilities])

  const isWorkspaceOpening =
    workspaceOpenState.phase === 'selecting' ||
    workspaceOpenState.phase === 'awaitingTrust' ||
    workspaceOpenState.phase === 'opening'

  const readinessChipTone: StatusChipTone = isProviderCapabilitiesLoading
    ? 'running'
    : providerReadiness.blockingCount > 0 || codexReadiness.tone === 'blocked'
      ? 'error'
      : providerReadiness.warningCount > 0 || codexReadiness.tone !== 'ready'
        ? 'warning'
        : 'success'
  const readinessStatusLabel = isProviderCapabilitiesLoading
    ? 'Checking runtime...'
    : codexReadiness.tone === 'ready'
      ? 'Codex is ready'
      : codexReadiness.summary

  const handleOpenWorkspace = async (): Promise<void> => {
    setWorkspaceActionError(null)

    try {
      await openWorkspaceFromDialog({ requestWorkspaceTrust })
    } catch {
      // The opening overlay owns the visible error state.
    }
  }

  const handleOpenRecentWorkspace = async (workspacePath: string): Promise<void> => {
    setWorkspaceActionError(null)

    try {
      await openWorkspacePath(workspacePath, { requestWorkspaceTrust })
    } catch {
      // The opening overlay owns the visible error state.
    }
  }

  const resetDragState = (): void => {
    dragDepthRef.current = 0
    setIsDragActive(false)
  }

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>): void => {
    if (!hasFileDrop(event.dataTransfer)) {
      return
    }

    event.preventDefault()

    if (isWorkspaceOpening) {
      return
    }

    dragDepthRef.current += 1
    setIsDragActive(true)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    if (!hasFileDrop(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = isWorkspaceOpening ? 'none' : 'copy'
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>): void => {
    if (!hasFileDrop(event.dataTransfer)) {
      return
    }

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDragActive(false)
    }
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>): Promise<void> => {
    if (!hasFileDrop(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    resetDragState()

    if (isWorkspaceOpening) {
      return
    }

    const droppedFile = Array.from(event.dataTransfer.files)[0]
    if (!droppedFile) {
      setWorkspaceActionError('Drop a project folder to open it as a workspace.')
      return
    }

    let droppedPath = ''
    try {
      droppedPath = window.api?.getPathForFile?.(droppedFile) ?? ''
    } catch {
      droppedPath = ''
    }

    if (!droppedPath) {
      setWorkspaceActionError('Fluxion could not read the dropped folder path.')
      return
    }

    if (!window.api?.validateWorkspaceDirectory) {
      setWorkspaceActionError('Workspace validation is not available.')
      return
    }

    try {
      const validation = await window.api.validateWorkspaceDirectory(droppedPath)
      if (!validation.ok) {
        setWorkspaceActionError(validation.message)
        return
      }

      setWorkspaceActionError(null)
      await openWorkspacePath(validation.path, { requestWorkspaceTrust })
    } catch (error) {
      setWorkspaceActionError(getErrorMessage(error, 'Failed to open dropped workspace.'))
    }
  }

  return (
    <div
      className="flex h-screen w-full flex-1 select-none flex-col overflow-auto"
      style={{ background: 'var(--color-canvas)' }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(event) => {
        void handleDrop(event)
      }}
    >
      {/* ── Top Navigation ── */}
      <nav
        className="mx-auto flex w-full items-center justify-between"
        style={{
          maxWidth: '1440px',
          height: '64px',
          padding: '20px 32px 0 32px'
        }}
      >
        {/* Left: Logo + Wordmark + Tagline */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md"
            style={{
              background: 'var(--color-primary)'
            }}
          >
            <Workflow size={16} style={{ color: 'var(--color-on-primary)' }} />
          </div>
          <span
            className="text-base font-medium"
            style={{
              color: 'var(--color-ink)',
              fontFamily: "'CursorGothic', sans-serif",
              letterSpacing: '-0.3px'
            }}
          >
            Fluxion
          </span>
          <span className="hidden text-xs sm:inline" style={{ color: 'var(--color-muted)' }}>
            Codex orchestration for real repositories
          </span>
        </div>

        {/* Right: Settings + Docs */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setIsSettingsOpen(true)}>
            <Settings size={14} />
            Settings
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              window.open('https://github.com/nickmilo/Fluxion', '_blank')
            }}
          >
            <BookOpen size={14} />
            Docs
          </Button>
        </div>
      </nav>

      {/* ── Main Content ── */}
      {/* ── Hero Section: Two-Column Layout ── */}
      <main
        className="mx-auto flex w-full max-w-[1440px] flex-1 px-8 py-12"
        style={{ gap: '48px' }}
      >
        {/* ── LEFT COLUMN (40%) ── */}
        <div className="flex flex-col gap-8" style={{ flex: '0 0 40%', maxWidth: '40%' }}>
          {/* Welcome Badge */}
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-canvas-soft))',
              color: 'var(--color-primary)'
            }}
          >
            👋 Welcome to Fluxion
          </span>

          {/* Headline */}
          <h1
            style={{
              fontFamily:
                "'CursorGothic', system-ui, 'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontSize: '36px',
              fontWeight: 400,
              lineHeight: 1.2,
              letterSpacing: '-0.72px',
              color: 'var(--color-ink)',
              margin: 0
            }}
          >
            Turn your repository into a <br />
            governed Codex workspace.
          </h1>

          {/* Supporting Text */}
          <div className="flex flex-col gap-3">
            <p className="text-base leading-7" style={{ color: 'var(--color-body)', margin: 0 }}>
              Fluxion helps you initialize durable project context, encode rules, and orchestrate
              Codex workflows from a single workspace.
            </p>
            <p className="text-sm leading-6" style={{ color: 'var(--color-muted)', margin: 0 }}>
              Fluxion reads project context, prepares agent workflows, and keeps outputs reviewable.
            </p>
          </div>

          {/* Prerequisite block (if CLI missing / auth missing) */}
          {prerequisiteCode ? (
            <PrerequisiteBlock
              code={prerequisiteCode}
              actionCommand={codexRawReadiness?.actionCommand}
            />
          ) : null}

          {/* Primary Action Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Open Workspace Card */}
            <button
              type="button"
              onClick={() => {
                void handleOpenWorkspace()
              }}
              disabled={isWorkspaceOpening}
              className="flex flex-col items-start gap-2 rounded-lg px-5 py-4 text-left transition-colors disabled:cursor-not-allowed"
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                border: '1px solid transparent',
                minHeight: '88px'
              }}
              onMouseEnter={(e) => {
                if (!isWorkspaceOpening)
                  e.currentTarget.style.background = 'var(--color-primary-active)'
              }}
              onMouseLeave={(e) => {
                if (!isWorkspaceOpening) e.currentTarget.style.background = 'var(--color-primary)'
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

            {/* Drag & Drop Card */}
            <div
              className="flex flex-col items-start gap-2 rounded-lg px-5 py-4 text-left transition-colors"
              style={{
                background: isDragActive ? 'var(--color-canvas-soft)' : 'var(--color-surface-card)',
                color: 'var(--color-ink)',
                border: isDragActive
                  ? '1px solid var(--color-primary)'
                  : '1px solid var(--color-hairline)',
                minHeight: '88px',
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

          {/* Workspace action error */}
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

          {/* Recent Workspaces Card */}
          <div
            className="rounded-lg px-4 py-4"
            style={{
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                Recent Workspaces
              </h2>
              {recentWorkspaces.length > 0 && (
                <button
                  type="button"
                  className="inline-flex items-center gap-0.5 text-xs font-medium transition-colors hover:opacity-80"
                  style={{
                    color: 'var(--color-muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  View all
                  <ChevronRight size={12} />
                </button>
              )}
            </div>
            {recentWorkspaces.length > 0 ? (
              <div className="grid gap-1.5">
                {recentWorkspaces.map((entry) => (
                  <RecentWorkspaceRow
                    key={entry.path}
                    entry={entry}
                    disabled={isWorkspaceOpening}
                    onOpen={(workspacePath) => {
                      void handleOpenRecentWorkspace(workspacePath)
                    }}
                    onReveal={(workspacePath) => {
                      void handleRevealRecentWorkspace(workspacePath)
                    }}
                    onRemove={(workspacePath) => {
                      void handleRemoveRecentWorkspace(workspacePath)
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                No recent workspaces yet. Open a project folder to get started.
              </p>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN (60%) — IDE Mockup Card ── */}
        <div
          className="hidden rounded-xl lg:flex lg:flex-col"
          style={{
            flex: '0 0 58%',
            maxWidth: '58%',
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-hairline)',
            overflow: 'hidden'
          }}
        >
          {/* Card Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--color-hairline)' }}
          >
            <div className="flex items-center gap-2">
              <Workflow size={14} style={{ color: 'var(--color-primary)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
                Workflow: Initialize Project Context
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: 'var(--color-semantic-success)' }}
              />
              <span
                className="text-[11px] font-medium"
                style={{ color: 'var(--color-semantic-success)' }}
              >
                Ready
              </span>
            </div>
          </div>

          {/* Card Body: 3-zone layout */}
          <div className="flex flex-1">
            {/* Left Mini Sidebar */}
            <div
              className="flex flex-col items-center gap-3 py-4"
              style={{
                width: '44px',
                borderRight: '1px solid var(--color-hairline)',
                background: 'var(--color-canvas-soft)'
              }}
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md"
                style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}
              >
                <Play size={13} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div className="flex h-7 w-7 items-center justify-center rounded-md">
                <Layers size={13} style={{ color: 'var(--color-muted)' }} />
              </div>
              <div className="flex h-7 w-7 items-center justify-center rounded-md">
                <User size={13} style={{ color: 'var(--color-muted)' }} />
              </div>
            </div>

            {/* Center: Timeline */}
            <div
              className="flex flex-1 flex-col"
              style={{ borderRight: '1px solid var(--color-hairline)' }}
            >
              {/* Tabs */}
              <div
                className="flex gap-0"
                style={{ borderBottom: '1px solid var(--color-hairline)' }}
              >
                <span
                  className="px-4 py-2 text-xs font-semibold"
                  style={{
                    color: 'var(--color-ink)',
                    borderBottom: '2px solid var(--color-primary)'
                  }}
                >
                  Flow
                </span>
                <span className="px-4 py-2 text-xs" style={{ color: 'var(--color-muted)' }}>
                  Context
                </span>
              </div>

              {/* Timeline Items */}
              <div className="flex flex-col gap-3 p-4">
                {[
                  {
                    label: 'Thinking',
                    desc: 'Analyzing repository structure...',
                    time: '2.1s',
                    bg: 'var(--color-timeline-thinking)'
                  },
                  {
                    label: 'Reading',
                    desc: 'Scanning key files and configs...',
                    time: '4.3s',
                    bg: 'var(--color-timeline-read)'
                  },
                  {
                    label: 'Grepping',
                    desc: 'Finding patterns and conventions...',
                    time: '3.7s',
                    bg: 'var(--color-timeline-grep)'
                  },
                  {
                    label: 'Editing',
                    desc: 'Generating context and rules...',
                    time: '5.2s',
                    bg: 'var(--color-timeline-edit)'
                  },
                  {
                    label: 'Done',
                    desc: 'Project context is ready',
                    time: '',
                    bg: 'var(--color-timeline-done)'
                  }
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    {/* Pill */}
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase"
                      style={{
                        background: item.bg,
                        color:
                          item.label === 'Done' ? 'var(--color-on-primary)' : 'var(--color-ink)',
                        letterSpacing: '0.88px',
                        lineHeight: '1.4'
                      }}
                    >
                      {item.label}
                    </span>
                    {/* Description + time */}
                    <div className="flex flex-1 items-center justify-between gap-2">
                      <span className="text-xs" style={{ color: 'var(--color-body)' }}>
                        {item.desc}
                      </span>
                      {item.time && (
                        <span
                          className="shrink-0 text-[10px]"
                          style={{
                            color: 'var(--color-muted-soft)',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          {item.time}
                        </span>
                      )}
                    </div>
                    {/* Check icon */}
                    <CheckCircle2
                      size={13}
                      className="mt-0.5 shrink-0"
                      style={{ color: 'var(--color-semantic-success)' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Context Preview */}
            <div
              className="flex flex-col gap-4 p-4"
              style={{ width: '200px', background: 'var(--color-canvas-soft)' }}
            >
              <span
                className="text-[10px] font-semibold uppercase"
                style={{ color: 'var(--color-muted)', letterSpacing: '0.88px' }}
              >
                Context Preview
              </span>

              {/* Repo tree */}
              <div
                className="flex flex-col gap-1 text-xs"
                style={{ color: 'var(--color-body)', fontFamily: 'var(--font-mono)' }}
              >
                <div className="flex items-center gap-1.5">
                  <FileText size={11} style={{ color: 'var(--color-muted)' }} />
                  AGENTS.md
                </div>
                <div className="flex items-center gap-1.5">
                  <FolderOpen size={11} style={{ color: 'var(--color-muted)' }} />
                  codex/
                </div>
                <div className="flex items-center gap-1.5 pl-4">
                  <FileText size={11} style={{ color: 'var(--color-muted)' }} />
                  config.toml
                </div>
                <div className="flex items-center gap-1.5">
                  <FolderOpen size={11} style={{ color: 'var(--color-muted)' }} />
                  docs/
                </div>
                <div className="flex items-center gap-1.5 pl-4">
                  <FileText size={11} style={{ color: 'var(--color-muted)' }} />
                  workflow.md
                </div>
              </div>

              {/* Project Brief */}
              <div
                className="rounded-md p-3"
                style={{
                  border: '1px solid var(--color-hairline)',
                  background: 'var(--color-surface-card)'
                }}
              >
                <span
                  className="text-[10px] font-semibold uppercase"
                  style={{ color: 'var(--color-muted)', letterSpacing: '0.88px' }}
                >
                  Project Brief
                </span>
                <p
                  className="mt-2 text-[11px] leading-4"
                  style={{ color: 'var(--color-body)', margin: 0, marginTop: '8px' }}
                >
                  A React + TypeScript web application with component-based architecture, focusing
                  on developer experience and performance.
                </p>
                <p
                  className="mt-2 text-[10px] leading-4"
                  style={{
                    color: 'var(--color-muted)',
                    fontFamily: 'var(--font-mono)',
                    margin: 0,
                    marginTop: '8px'
                  }}
                >
                  Tech Stack: React, TypeScript, Vite, Tailwind CSS, Vitest
                </p>
              </div>
            </div>
          </div>

          {/* Card Bottom Bar */}
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{
              borderTop: '1px solid var(--color-hairline)',
              background: 'var(--color-canvas-soft)'
            }}
          >
            <span
              className="text-[10px]"
              style={{ color: 'var(--color-muted-soft)', fontFamily: 'var(--font-mono)' }}
            >
              Model: codex-1
            </span>
            <span
              className="text-[10px]"
              style={{ color: 'var(--color-muted-soft)', fontFamily: 'var(--font-mono)' }}
            >
              Mode: Full-Auto
            </span>
            <span
              className="text-[10px]"
              style={{ color: 'var(--color-muted-soft)', fontFamily: 'var(--font-mono)' }}
            >
              Workspace: ~/Projects/fluxion
            </span>
          </div>
        </div>
      </main>

      {/* ── Workflow Steps Band ── */}
      <section className="mx-auto w-full px-8 pb-12" style={{ maxWidth: '1440px' }}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
            Your first steps with Fluxion
          </h2>
          <button
            type="button"
            className="inline-flex items-center gap-0.5 text-xs font-medium transition-colors hover:opacity-80"
            style={{
              color: 'var(--color-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Learn the workflow
            <ChevronRight size={12} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            {
              step: 1,
              title: 'Open your repository',
              body: 'Open an existing project folder to get started.'
            },
            {
              step: 2,
              title: 'Detect project signals',
              body: 'Fluxion analyzes structure, configs, and key files.'
            },
            {
              step: 3,
              title: 'Review generated context',
              body: 'Review AGENTS.md, config, and project brief.'
            },
            {
              step: 4,
              title: 'Run your first workflow',
              body: 'Execute workflows with Codex in a durable context.'
            }
          ].map((card, idx, arr) => (
            <div
              key={card.step}
              className="relative flex flex-col gap-3 rounded-lg px-5 py-5"
              style={{
                background: 'var(--color-surface-card)',
                border: '1px solid var(--color-hairline)'
              }}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
                style={{
                  background: idx === 0 ? 'var(--color-primary)' : 'var(--color-surface-strong)',
                  color: idx === 0 ? 'var(--color-on-primary)' : 'var(--color-ink)'
                }}
              >
                {card.step}
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                {card.title}
              </span>
              <span className="text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                {card.body}
              </span>
              {/* Connector */}
              {idx < arr.length - 1 && (
                <span
                  className="absolute right-0 top-1/2 hidden h-px w-4 translate-x-full lg:block"
                  style={{ background: 'var(--color-hairline-strong)' }}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom Diagnostics Grid ── */}
      <section className="mx-auto w-full px-8 pb-12" style={{ maxWidth: '1440px' }}>
        <div className="grid grid-cols-3 gap-4">
          {/* Column 1: Codex Readiness */}
          <div
            className="flex flex-col gap-4 rounded-lg px-5 py-5"
            style={{
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              Codex Readiness
            </h3>
            <Tooltip content={codexReadiness.detail}>
              <div className="w-fit">
                <StatusChip
                  tone={readinessChipTone}
                  label={readinessStatusLabel}
                  animate={isProviderCapabilitiesLoading}
                />
              </div>
            </Tooltip>
            <div
              className="flex flex-col gap-2 text-xs"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-body)' }}
            >
              <div className="flex justify-between">
                <span>Codex CLI</span>
                <span style={{ color: 'var(--color-muted)' }}>
                  {codexRawReadiness?.code === 'cli_missing' ? 'Not found' : '1.0.7'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Authentication</span>
                <span style={{ color: 'var(--color-muted)' }}>
                  {codexRawReadiness?.code === 'auth_missing'
                    ? 'Not authenticated'
                    : 'Authenticated'}
                </span>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const api = window.api as unknown as Record<string, () => void> | undefined
                if (api?.openCodexTerminal) {
                  void api.openCodexTerminal()
                }
              }}
              className="mt-auto w-full"
            >
              <Terminal size={13} />
              Open Codex Terminal
            </Button>
          </div>

          {/* Column 2: Repository Signals */}
          <div
            className="flex flex-col gap-4 rounded-lg px-5 py-5"
            style={{
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              Repository Signals Detected
            </h3>
            <div className="flex flex-wrap gap-2">
              {['TypeScript', 'React', 'Vite', 'ESLint', 'Prettier'].map((tech) => (
                <span
                  key={tech}
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{
                    background: 'var(--color-surface-strong)',
                    color: 'var(--color-ink)'
                  }}
                >
                  {tech}
                </span>
              ))}
            </div>
            <p className="text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
              We&apos;ll use these signals to customize the context for your project.
            </p>
          </div>

          {/* Column 3: Help */}
          <div
            className="flex flex-col gap-4 rounded-lg px-5 py-5"
            style={{
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              Need Help?
            </h3>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-xs font-medium transition-colors hover:bg-[var(--color-canvas)]"
              style={{
                color: 'var(--color-ink)',
                border: '1px solid var(--color-hairline)',
                background: 'var(--color-surface-card)'
              }}
            >
              <BookOpen size={14} style={{ color: 'var(--color-muted)' }} />
              <span className="flex-1">Read the Documentation</span>
              <ExternalLink size={12} style={{ color: 'var(--color-muted-soft)' }} />
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-xs font-medium transition-colors hover:bg-[var(--color-canvas)]"
              style={{
                color: 'var(--color-ink)',
                border: '1px solid var(--color-hairline)',
                background: 'var(--color-surface-card)'
              }}
            >
              <MessageCircle size={14} style={{ color: 'var(--color-muted)' }} />
              <span className="flex-1">Join our Community</span>
              <ExternalLink size={12} style={{ color: 'var(--color-muted-soft)' }} />
            </button>
          </div>
        </div>
      </section>

      {/* ── Bottom Footer ── */}
      <footer
        className="mx-auto flex w-full items-center justify-between px-8 pb-6 pt-2"
        style={{ maxWidth: '1440px' }}
      >
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-muted)' }}>
          <ShieldCheck size={14} />
          <span>Fluxion never stores your code. Everything stays on your machine.</span>
        </div>
        <span
          className="text-[11px]"
          style={{ color: 'var(--color-muted-soft)', fontFamily: 'var(--font-mono)' }}
        >
          Fluxion v0.1.0
        </span>
      </footer>

      <GlobalSettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      {trustDialog}
      <WorkspaceOpeningOverlay />
    </div>
  )
}
