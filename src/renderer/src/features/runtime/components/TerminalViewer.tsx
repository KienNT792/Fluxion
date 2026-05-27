import React from 'react'
import '@xterm/xterm/css/xterm.css'

import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { useExecutionStore } from '@renderer/stores/execution.store'
import { useThemeStore } from '@renderer/stores/theme.store'
import { Copy, ExternalLink, Terminal, Trash2 } from 'lucide-react'
import { truncateTerminalText } from '@renderer/lib/terminal'
import { useXtermTerminal } from '../hooks/useXtermTerminal'
import { STATUS_DOT } from '../lib/runtime-status'
import { RuntimeLogCategory } from '@renderer/stores/execution.store'
import { buildNodeTerminalLaunchPayload } from '../lib/terminal-launch'

const EMPTY_TERMINAL_LOGS: string[] = []

export const TerminalViewer: React.FC = () => {
  const terminalNodeId = useWorkflowStore((state) => state.terminalNodeId)
  const terminalFollowMode = useWorkflowStore((state) => state.terminalFollowMode)
  const workspacePath = useWorkflowStore((state) => state.workspacePath)
  const nodes = useWorkflowStore((state) => state.nodes)
  const clearLogs = useExecutionStore((state) => state.clearLogs)
  const terminalLogs = useExecutionStore((state) =>
    terminalNodeId
      ? (state.terminalLogs[terminalNodeId] ?? EMPTY_TERMINAL_LOGS)
      : EMPTY_TERMINAL_LOGS
  )
  const runtimeLogs = useExecutionStore((state) =>
    terminalNodeId ? (state.runtimeLogs[terminalNodeId] ?? []) : []
  )
  const status = useExecutionStore((state) =>
    terminalNodeId ? (state.nodeStatuses[terminalNodeId] ?? 'idle') : 'idle'
  )
  const activeRunId = useExecutionStore((state) => state.activeRunId)
  const [logFilter, setLogFilter] = React.useState<RuntimeLogCategory>('progress')

  const theme = useThemeStore((state) => state.theme)
  const isDark = theme === 'dark'

  const activeNode = nodes.find((node) => node.id === terminalNodeId)
  const nodeLabel = activeNode?.data?.label as string | undefined
  const nodeModel = activeNode?.data?.model as string | undefined
  const displayName = nodeLabel || nodeModel || terminalNodeId || ''
  const outputPath = useExecutionStore((state) =>
    terminalNodeId ? (state.nodeOutputPaths[terminalNodeId] ?? undefined) : undefined
  )
  const filteredLogs = React.useMemo(() => {
    if (runtimeLogs.length === 0) {
      return terminalLogs
    }
    return runtimeLogs
      .filter((entry) => entry.category === logFilter)
      .map((entry) => entry.content)
  }, [logFilter, runtimeLogs, terminalLogs])
  const filteredCursor = filteredLogs.length
  const { copyFeedback, handleClear, handleCopyAll, handleCopySelection, terminalRef } =
    useXtermTerminal({
      clearLogs,
      displayName,
      getLiveCursor: () => filteredCursor,
      getLiveLogs: () => filteredLogs,
      isDark,
      terminalLogs: filteredLogs,
      terminalNodeId,
      theme
    })
  if (!terminalNodeId) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-8">
        <div className="text-center">
          <Terminal
            size={20}
            className="mx-auto mb-2"
            style={{ color: 'var(--color-muted-soft)' }}
          />
          <p className="text-xs" style={{ color: 'var(--color-muted)', lineHeight: '1.6' }}>
            {terminalFollowMode === 'auto'
              ? 'Run workflow to follow active node logs in real time.'
              : 'Select a node to inspect execution output manually.'}
          </p>
        </div>
      </div>
    )
  }

  const dot = STATUS_DOT[status] ?? STATUS_DOT.idle
  const copyFeedbackColor =
    copyFeedback === 'Copy failed'
      ? 'var(--color-semantic-error)'
      : copyFeedback === 'No selection'
        ? 'var(--color-timeline-edit)'
        : 'var(--color-timeline-grep)'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className="flex h-8 flex-shrink-0 items-center justify-between px-3"
        style={{
          background: 'var(--color-canvas-soft)',
          borderBottom: '1px solid var(--color-hairline)'
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${dot.pulse ? 'animate-pulse' : ''}`}
            style={{ background: dot.color }}
            title={`Status: ${status}`}
          />
          <span
            className="truncate text-[11px] font-medium"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}
            title={displayName}
          >
            {truncateTerminalText(displayName)}
          </span>
          {nodeLabel && nodeModel ? (
            <span
              className="shrink-0 text-[10px]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}
            >
              {nodeModel}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          <LogFilterTabs value={logFilter} onChange={setLogFilter} />
          {copyFeedback ? (
            <span
              className="text-[10px]"
              style={{ color: copyFeedbackColor, fontFamily: 'var(--font-mono)' }}
            >
              {copyFeedback}
            </span>
          ) : null}
          <HeaderActionButton
            ariaLabel="Open Windows Terminal"
            title="Open Windows Terminal"
            onClick={() => {
              if (!workspacePath) {
                return
              }

              void window.api.openTerminal(
                buildNodeTerminalLaunchPayload({
                  workspacePath,
                  runId: activeRunId,
                  nodeId: terminalNodeId,
                  nodeLabel,
                  outputPath
                })
              )
            }}
          >
            <ExternalLink size={12} />
            <span>Terminal</span>
          </HeaderActionButton>
          <HeaderActionButton
            ariaLabel="Copy selection"
            title="Copy Selection"
            onClick={() => {
              void handleCopySelection()
            }}
          >
            <Copy size={12} />
            <span>Selection</span>
          </HeaderActionButton>
          <HeaderActionButton
            ariaLabel="Copy all logs"
            title="Copy All"
            onClick={() => {
              void handleCopyAll()
            }}
          >
            <Copy size={12} />
            <span>All</span>
          </HeaderActionButton>
          <HeaderActionButton ariaLabel="Clear logs" title="Clear" onClick={handleClear}>
            <Trash2 size={12} />
            <span>Clear</span>
          </HeaderActionButton>
        </div>
      </div>

      <div
        className="flex-1 overflow-hidden p-1"
        style={{ background: isDark ? '#161614' : '#fafaf7' }}
        ref={terminalRef}
      />
    </div>
  )
}

function LogFilterTabs({
  value,
  onChange
}: {
  value: RuntimeLogCategory
  onChange: (value: RuntimeLogCategory) => void
}): React.JSX.Element {
  const options: RuntimeLogCategory[] = ['progress', 'output', 'diagnostics']

  return (
    <div
      className="flex items-center rounded-sm p-0.5"
      style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-hairline-soft)' }}
    >
      {options.map((option) => {
        const active = option === value
        return (
          <button
            key={option}
            type="button"
            className="rounded-sm px-1.5 py-0.5 text-[10px]"
            style={{
              background: active ? 'var(--color-canvas)' : 'transparent',
              color: active ? 'var(--color-ink)' : 'var(--color-muted)',
              fontFamily: 'var(--font-mono)'
            }}
            onClick={() => onChange(option)}
          >
            {option === 'progress' ? 'Progress' : option === 'output' ? 'Output' : 'Diagnostics'}
          </button>
        )
      })}
    </div>
  )
}

function HeaderActionButton({
  ariaLabel,
  title,
  onClick,
  children
}: {
  ariaLabel: string
  title: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-[10px] transition-colors"
      style={{ color: 'var(--color-muted)' }}
      title={title}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = 'var(--color-surface-strong)'
        event.currentTarget.style.color = 'var(--color-ink)'
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'transparent'
        event.currentTarget.style.color = 'var(--color-muted)'
      }}
    >
      {children}
    </button>
  )
}
