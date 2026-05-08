import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

import { useWorkflowStore } from '../../stores/workflow.store';
import { useExecutionStore } from '../../stores/execution.store';
import { useThemeStore } from '../../stores/theme.store';
import { Terminal, Trash2 } from 'lucide-react';

// Status dot palette — using AI Timeline pastels from DESIGN.md
const STATUS_DOT: Record<string, { color: string; pulse: boolean }> = {
  running:   { color: 'var(--color-timeline-thinking)', pulse: true  },
  completed: { color: 'var(--color-timeline-grep)',     pulse: false },
  error:     { color: 'var(--color-semantic-error)',    pulse: false },
  stopping:  { color: 'var(--color-timeline-read)',     pulse: false },
  paused:    { color: 'var(--color-timeline-edit)',     pulse: false },
  idle:      { color: 'var(--color-hairline-strong)',   pulse: false },
};

function writeLogEntry(term: XTerm, entry: string): void {
  const normalized = entry.replace(/\r?\n/g, '\r\n');
  term.write(normalized.endsWith('\r\n') ? normalized : `${normalized}\r\n`);
}

function writeLogHistory(term: XTerm, logs: string[]): void {
  logs.forEach((entry) => writeLogEntry(term, entry));
}

/**
 * TerminalViewer — embedded log viewer for node execution output.
 *
 * Designed to be mounted inside the RuntimeDock's "Logs" tab.
 * No longer a floating overlay; renders inline in its parent's flex container.
 * Shows an empty state when no node is selected for log viewing.
 * Preserves all existing xterm.js data flow and log subscription logic.
 */
export const TerminalViewer: React.FC = () => {
  const terminalNodeId = useWorkflowStore(state => state.terminalNodeId);
  const nodes = useWorkflowStore(state => state.nodes);
  const clearLogs = useExecutionStore(state => state.clearLogs);
  const status = useExecutionStore(state =>
    terminalNodeId ? state.nodeStatuses[terminalNodeId] ?? 'idle' : 'idle'
  );
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);

  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';

  const activeNode = nodes.find(n => n.id === terminalNodeId);
  const nodeLabel = activeNode?.data?.label as string | undefined;
  const nodeModel = activeNode?.data?.model as string | undefined;
  const displayName = nodeLabel || nodeModel || terminalNodeId || '';

  useEffect(() => {
    if (!terminalNodeId) return;
    if (!terminalRef.current) return;

    const term = new XTerm({
      theme: {
        // ide-pane aesthetic: warm canvas-soft bg with warm ink text
        background: isDark ? '#161614' : '#fafaf7',   // canvas-soft
        foreground: isDark ? '#e8e7e0' : '#26251e',   // ink
        cursor: '#f54e00',       // Cursor Orange
        cursorAccent: isDark ? '#161614' : '#fafaf7',
        selectionBackground: isDark ? '#2a2925' : '#e6e5e0', // surface-strong
        black:         isDark ? '#0f0f0d' : '#26251e',
        brightBlack:   isDark ? '#6b6860' : '#807d72',
        red:           '#cf2d56',
        brightRed:     '#cf2d56',
        green:         '#1f8a65',
        brightGreen:   '#1f8a65',
        yellow:        '#c08532',
        brightYellow:  '#dfa88f',
        blue:          '#4285F4',
        brightBlue:    '#9fbbe0',
        magenta:       '#c0a8dd',
        brightMagenta: '#c0a8dd',
        cyan:          '#9fc9a2',
        brightCyan:    '#9fc9a2',
        white:         isDark ? '#a09c92' : '#5a5852',
        brightWhite:   isDark ? '#e8e7e0' : '#26251e',
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
    } catch (e) {
      console.warn('WebGL Addon could not be loaded, falling back to Canvas renderer', e);
    }

    // Important: fit must happen after open
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
      term.writeln(`\x1b[2m[system]\x1b[0m Listening to \x1b[1m${displayName}\x1b[0m...`);
    }

    const unsubscribe = useExecutionStore.subscribe(state => {
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

  // Empty state: no node selected for log viewing
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
            Select a node&apos;s &ldquo;Logs&rdquo; to view execution output.
          </p>
        </div>
      </div>
    );
  }

  const handleClear = (): void => {
    clearLogs(terminalNodeId);
    if (xtermInstance.current) {
      xtermInstance.current.clear();
      xtermInstance.current.writeln('\x1b[2m[system]\x1b[0m Terminal cleared.');
    }
  };

  const dot = STATUS_DOT[status] ?? STATUS_DOT.idle;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Inline header — node name + actions */}
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
          >
            {displayName}
          </span>
          {nodeLabel && nodeModel && (
            <span
              className="shrink-0 text-[10px]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}
            >
              · {nodeModel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Clear logs"
            onClick={handleClear}
            className="flex items-center justify-center rounded-sm p-1 transition-colors"
            style={{ color: 'var(--color-muted)' }}
            title="Clear"
            onMouseEnter={(event) => {
              event.currentTarget.style.background = 'var(--color-surface-strong)';
              event.currentTarget.style.color = 'var(--color-ink)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent';
              event.currentTarget.style.color = 'var(--color-muted)';
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* xterm.js container */}
      <div
        className="flex-1 overflow-hidden p-1"
        style={{ background: isDark ? '#161614' : '#fafaf7' }}
        ref={terminalRef}
      />
    </div>
  );
};
