import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

import { useWorkflowStore } from '../../stores/workflow.store';
import { useExecutionStore } from '../../stores/execution.store';
import { useThemeStore } from '../../stores/theme.store';
import { Copy, Terminal, Trash2 } from 'lucide-react';
import {
  copyTextToClipboard,
  ensureTerminalLine,
  formatTerminalLogsForClipboard,
  formatTerminalSystemEntry,
  truncateTerminalText,
} from '../../lib/terminal';
import { logRuntimeDebug } from '../../lib/runtime-debug';

const STATUS_DOT: Record<string, { color: string; pulse: boolean }> = {
  running: { color: 'var(--color-timeline-thinking)', pulse: true },
  completed: { color: 'var(--color-timeline-grep)', pulse: false },
  error: { color: 'var(--color-semantic-error)', pulse: false },
  stopping: { color: 'var(--color-timeline-read)', pulse: false },
  paused: { color: 'var(--color-timeline-edit)', pulse: false },
  idle: { color: 'var(--color-hairline-strong)', pulse: false },
};

type CopyFeedback = 'Copied selection' | 'Copied all' | 'No selection' | 'Copy failed' | null;

function writeLogEntry(term: XTerm, entry: string): void {
  term.write(ensureTerminalLine(entry));
}

function writeLogHistory(term: XTerm, logs: string[]): void {
  logs.forEach((entry) => writeLogEntry(term, entry));
}

export const TerminalViewer: React.FC = () => {
  const terminalNodeId = useWorkflowStore((state) => state.terminalNodeId);
  const terminalFollowMode = useWorkflowStore((state) => state.terminalFollowMode);
  const nodes = useWorkflowStore((state) => state.nodes);
  const clearLogs = useExecutionStore((state) => state.clearLogs);
  const terminalLogs = useExecutionStore((state) =>
    terminalNodeId ? state.terminalLogs[terminalNodeId] ?? [] : []
  );
  const status = useExecutionStore((state) =>
    terminalNodeId ? state.nodeStatuses[terminalNodeId] ?? 'idle' : 'idle'
  );

  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);

  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>(null);

  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === 'dark';

  const activeNode = nodes.find((node) => node.id === terminalNodeId);
  const nodeLabel = activeNode?.data?.label as string | undefined;
  const nodeModel = activeNode?.data?.model as string | undefined;
  const displayName = nodeLabel || nodeModel || terminalNodeId || '';

  useEffect(() => {
    if (!copyFeedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyFeedback(null);
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [copyFeedback]);

  useEffect(() => {
    if (!terminalNodeId) return;
    if (!terminalRef.current) return;

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
        brightWhite: isDark ? '#e8e7e0' : '#26251e',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 12,
      lineHeight: 1.6,
      cursorBlink: true,
      disableStdin: true,
    });

    xtermInstance.current = term;

    const fitAddon = new FitAddon();
    fitAddonInstance.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => webglAddon.dispose());
      term.loadAddon(webglAddon);
    } catch (error) {
      console.warn('WebGL Addon could not be loaded, falling back to Canvas renderer', error);
    }

    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    const executionState = useExecutionStore.getState();
    const historyLogs = executionState.terminalLogs[terminalNodeId] || [];
    let lastLogCursor =
      executionState.terminalLogCursors[terminalNodeId] ?? historyLogs.length;

    if (historyLogs.length > 0) {
      writeLogHistory(term, historyLogs);
    } else {
      term.writeln(formatTerminalSystemEntry(`Listening to ${displayName}...`));
    }

    const unsubscribe = useExecutionStore.subscribe((state) => {
      const newLogs = state.terminalLogs[terminalNodeId] || [];
      const nextLogCursor = state.terminalLogCursors[terminalNodeId] ?? newLogs.length;

      if (newLogs.length === 0) {
        if (nextLogCursor !== lastLogCursor || lastLogCursor !== 0) {
          term.clear();
          lastLogCursor = nextLogCursor;
        }
        return;
      }

      if (nextLogCursor <= lastLogCursor) {
        term.clear();
        writeLogHistory(term, newLogs);
        lastLogCursor = nextLogCursor;
        return;
      }

      const appendedCount = nextLogCursor - lastLogCursor;
      const appendedLogs =
        appendedCount >= newLogs.length
          ? newLogs
          : newLogs.slice(newLogs.length - appendedCount);

      if (appendedCount >= newLogs.length) {
        term.clear();
      }

      writeLogHistory(term, appendedLogs);
      lastLogCursor = nextLogCursor;
    });

    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonInstance.current) {
        requestAnimationFrame(() => fitAddonInstance.current?.fit());
      }
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      unsubscribe();
      resizeObserver.disconnect();
      term.dispose();
      xtermInstance.current = null;
      fitAddonInstance.current = null;
    };
  }, [terminalNodeId, theme, isDark, displayName]);

  if (!terminalNodeId) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-8">
        <div className="text-center">
          <Terminal
            size={20}
            className="mx-auto mb-2"
            style={{ color: 'var(--color-muted-soft)' }}
          />
          <p
            className="text-xs"
            style={{ color: 'var(--color-muted)', lineHeight: '1.6' }}
          >
            {terminalFollowMode === 'auto'
              ? 'Run workflow to follow active node logs in real time.'
              : 'Select a node to inspect execution output manually.'}
          </p>
        </div>
      </div>
    );
  }

  const handleClear = (): void => {
    clearLogs(terminalNodeId);
    if (xtermInstance.current) {
      xtermInstance.current.clear();
      xtermInstance.current.writeln(formatTerminalSystemEntry('Terminal cleared.'));
    }
  };

  const handleCopySelection = async (): Promise<void> => {
    const terminal = xtermInstance.current;
    if (!terminal || !terminal.hasSelection()) {
      setCopyFeedback('No selection');
      logRuntimeDebug('TerminalCopy', 'copy selection skipped', {
        nodeId: terminalNodeId,
        reason: 'no-selection',
      });
      return;
    }

    try {
      const didCopy = await copyTextToClipboard(terminal.getSelection());
      setCopyFeedback(didCopy ? 'Copied selection' : 'Copy failed');
      logRuntimeDebug('TerminalCopy', 'copy selection attempted', {
        nodeId: terminalNodeId,
        result: didCopy ? 'copied-selection' : 'copy-failed',
      });
    } catch (error) {
      setCopyFeedback('Copy failed');
      logRuntimeDebug('TerminalCopy', 'copy selection failed', {
        nodeId: terminalNodeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleCopyAll = async (): Promise<void> => {
    try {
      const didCopy = await copyTextToClipboard(formatTerminalLogsForClipboard(terminalLogs));
      setCopyFeedback(didCopy ? 'Copied all' : 'Copy failed');
      logRuntimeDebug('TerminalCopy', 'copy all attempted', {
        nodeId: terminalNodeId,
        lineCount: terminalLogs.length,
        result: didCopy ? 'copied-all' : 'copy-failed',
      });
    } catch (error) {
      setCopyFeedback('Copy failed');
      logRuntimeDebug('TerminalCopy', 'copy all failed', {
        nodeId: terminalNodeId,
        lineCount: terminalLogs.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const dot = STATUS_DOT[status] ?? STATUS_DOT.idle;
  const copyFeedbackColor = copyFeedback === 'Copy failed'
    ? 'var(--color-semantic-error)'
    : copyFeedback === 'No selection'
      ? 'var(--color-timeline-edit)'
      : 'var(--color-timeline-grep)';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className="flex h-8 flex-shrink-0 items-center justify-between px-3"
        style={{
          background: 'var(--color-canvas-soft)',
          borderBottom: '1px solid var(--color-hairline)',
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
          {copyFeedback ? (
            <span
              className="text-[10px]"
              style={{ color: copyFeedbackColor, fontFamily: 'var(--font-mono)' }}
            >
              {copyFeedback}
            </span>
          ) : null}
          <HeaderActionButton
            ariaLabel="Copy selection"
            title="Copy Selection"
            onClick={() => {
              void handleCopySelection();
            }}
          >
            <Copy size={12} />
            <span>Selection</span>
          </HeaderActionButton>
          <HeaderActionButton
            ariaLabel="Copy all logs"
            title="Copy All"
            onClick={() => {
              void handleCopyAll();
            }}
          >
            <Copy size={12} />
            <span>All</span>
          </HeaderActionButton>
          <HeaderActionButton
            ariaLabel="Clear logs"
            title="Clear"
            onClick={handleClear}
          >
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
  );
};

function HeaderActionButton({
  ariaLabel,
  title,
  onClick,
  children,
}: {
  ariaLabel: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
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
        event.currentTarget.style.background = 'var(--color-surface-strong)';
        event.currentTarget.style.color = 'var(--color-ink)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'transparent';
        event.currentTarget.style.color = 'var(--color-muted)';
      }}
    >
      {children}
    </button>
  );
}
