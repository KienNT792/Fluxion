import { RefObject, useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import {
  copyTextToClipboard,
  ensureTerminalLine,
  formatTerminalLogsForClipboard,
  formatTerminalSystemEntry
} from '@renderer/lib/terminal'
import { logRuntimeDebug } from '@renderer/lib/runtime-debug'
import { useExecutionStore } from '@renderer/stores/execution.store'

export type CopyFeedback = 'Copied selection' | 'Copied all' | 'No selection' | 'Copy failed' | null

interface UseXtermTerminalOptions {
  clearLogs: (nodeId: string) => void
  displayName: string
  isDark: boolean
  terminalLogs: string[]
  terminalNodeId: string | null
  theme: string
}

function writeLogEntry(term: XTerm, entry: string): void {
  term.write(ensureTerminalLine(entry))
}

function writeLogHistory(term: XTerm, logs: string[]): void {
  logs.forEach((entry) => writeLogEntry(term, entry))
}

export function useXtermTerminal({
  clearLogs,
  displayName,
  isDark,
  terminalLogs,
  terminalNodeId,
  theme
}: UseXtermTerminalOptions): {
  copyFeedback: CopyFeedback
  handleClear: () => void
  handleCopyAll: () => Promise<void>
  handleCopySelection: () => Promise<void>
  terminalRef: RefObject<HTMLDivElement | null>
} {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermInstance = useRef<XTerm | null>(null)
  const fitAddonInstance = useRef<FitAddon | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>(null)

  useEffect(() => {
    if (!copyFeedback) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setCopyFeedback(null)
    }, 1200)

    return () => window.clearTimeout(timeoutId)
  }, [copyFeedback])

  useEffect(() => {
    if (!terminalNodeId) return
    if (!terminalRef.current) return

    const term = new XTerm({
      theme: {
        background: isDark ? '#161614' : '#fafaf7',
        foreground: isDark ? '#e8e7e0' : '#26251e',
        cursor: '#f54e00',
        cursorAccent: isDark ? '#161614' : '#fafaf7',
        selectionBackground: isDark ? '#2a2925' : '#e6e5e0',
        black: isDark ? '#0f0f0d' : '#26251e',
        brightBlack: isDark ? '#6b6860' : '#807d72',
        red: '#cf2d56',
        brightRed: '#cf2d56',
        green: '#1f8a65',
        brightGreen: '#1f8a65',
        yellow: '#c08532',
        brightYellow: '#dfa88f',
        blue: '#4285F4',
        brightBlue: '#9fbbe0',
        magenta: '#c0a8dd',
        brightMagenta: '#c0a8dd',
        cyan: '#9fc9a2',
        brightCyan: '#9fc9a2',
        white: isDark ? '#a09c92' : '#5a5852',
        brightWhite: isDark ? '#e8e7e0' : '#26251e'
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 12,
      lineHeight: 1.6,
      cursorBlink: true,
      disableStdin: true
    })

    xtermInstance.current = term

    const fitAddon = new FitAddon()
    fitAddonInstance.current = fitAddon
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)

    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => webglAddon.dispose())
      term.loadAddon(webglAddon)
    } catch (error) {
      console.warn('WebGL Addon could not be loaded, falling back to Canvas renderer', error)
    }

    requestAnimationFrame(() => {
      fitAddon.fit()
    })

    const executionState = useExecutionStore.getState()
    const historyLogs = executionState.terminalLogs[terminalNodeId] || []
    let lastLogCursor = executionState.terminalLogCursors[terminalNodeId] ?? historyLogs.length

    if (historyLogs.length > 0) {
      writeLogHistory(term, historyLogs)
    } else {
      term.writeln(formatTerminalSystemEntry(`Listening to ${displayName}...`))
    }

    const unsubscribe = useExecutionStore.subscribe((state) => {
      const newLogs = state.terminalLogs[terminalNodeId] || []
      const nextLogCursor = state.terminalLogCursors[terminalNodeId] ?? newLogs.length

      if (newLogs.length === 0) {
        if (nextLogCursor !== lastLogCursor || lastLogCursor !== 0) {
          term.clear()
          lastLogCursor = nextLogCursor
        }
        return
      }

      if (nextLogCursor <= lastLogCursor) {
        term.clear()
        writeLogHistory(term, newLogs)
        lastLogCursor = nextLogCursor
        return
      }

      const appendedCount = nextLogCursor - lastLogCursor
      const appendedLogs =
        appendedCount >= newLogs.length ? newLogs : newLogs.slice(newLogs.length - appendedCount)

      if (appendedCount >= newLogs.length) {
        term.clear()
      }

      writeLogHistory(term, appendedLogs)
      lastLogCursor = nextLogCursor
    })

    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonInstance.current) {
        requestAnimationFrame(() => fitAddonInstance.current?.fit())
      }
    })
    resizeObserver.observe(terminalRef.current)

    return () => {
      unsubscribe()
      resizeObserver.disconnect()
      term.dispose()
      xtermInstance.current = null
      fitAddonInstance.current = null
    }
  }, [terminalNodeId, theme, isDark, displayName])

  const handleClear = (): void => {
    if (!terminalNodeId) {
      return
    }

    clearLogs(terminalNodeId)
    if (xtermInstance.current) {
      xtermInstance.current.clear()
      xtermInstance.current.writeln(formatTerminalSystemEntry('Terminal cleared.'))
    }
  }

  const handleCopySelection = async (): Promise<void> => {
    const terminal = xtermInstance.current
    if (!terminal || !terminal.hasSelection()) {
      setCopyFeedback('No selection')
      logRuntimeDebug('TerminalCopy', 'copy selection skipped', {
        nodeId: terminalNodeId,
        reason: 'no-selection'
      })
      return
    }

    try {
      const didCopy = await copyTextToClipboard(terminal.getSelection())
      setCopyFeedback(didCopy ? 'Copied selection' : 'Copy failed')
      logRuntimeDebug('TerminalCopy', 'copy selection attempted', {
        nodeId: terminalNodeId,
        result: didCopy ? 'copied-selection' : 'copy-failed'
      })
    } catch (error) {
      setCopyFeedback('Copy failed')
      logRuntimeDebug('TerminalCopy', 'copy selection failed', {
        nodeId: terminalNodeId,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  const handleCopyAll = async (): Promise<void> => {
    try {
      const didCopy = await copyTextToClipboard(formatTerminalLogsForClipboard(terminalLogs))
      setCopyFeedback(didCopy ? 'Copied all' : 'Copy failed')
      logRuntimeDebug('TerminalCopy', 'copy all attempted', {
        nodeId: terminalNodeId,
        lineCount: terminalLogs.length,
        result: didCopy ? 'copied-all' : 'copy-failed'
      })
    } catch (error) {
      setCopyFeedback('Copy failed')
      logRuntimeDebug('TerminalCopy', 'copy all failed', {
        nodeId: terminalNodeId,
        lineCount: terminalLogs.length,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return {
    copyFeedback,
    handleClear,
    handleCopyAll,
    handleCopySelection,
    terminalRef
  }
}
