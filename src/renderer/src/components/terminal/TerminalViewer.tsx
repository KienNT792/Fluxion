import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

import { useWorkflowStore } from '../../stores/workflow.store';
import { useExecutionStore } from '../../stores/execution.store';
import { useThemeStore } from '../../stores/theme.store';
import { TerminalSquare, X, Trash2, Maximize2, Minimize2, ArrowLeft } from 'lucide-react';

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

export const TerminalViewer: React.FC = () => {
  const terminalNodeId = useWorkflowStore(state => state.terminalNodeId);
  const setTerminalNodeId = useWorkflowStore(state => state.setTerminalNodeId);
  const nodes = useWorkflowStore(state => state.nodes);
  const clearLogs = useExecutionStore(state => state.clearLogs);
  const status = useExecutionStore(state =>
    terminalNodeId ? state.nodeStatuses[terminalNodeId] ?? 'idle' : 'idle'
  );
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

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
  }, [terminalNodeId, isExpanded, theme, isDark, displayName]);

  if (!terminalNodeId) return null;

  const handleClear = (): void => {
    clearLogs(terminalNodeId);
    if (xtermInstance.current) {
      xtermInstance.current.clear();
      xtermInstance.current.writeln('\x1b[2m[system]\x1b[0m Terminal cleared.');
    }
  };

  const dot = STATUS_DOT[status] ?? STATUS_DOT.idle;

  const iconBtnStyle = (): React.CSSProperties => ({
    color: 'var(--color-muted)',
    padding: '5px',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 flex flex-col z-50 transition-all duration-300 ${isExpanded ? 'h-[78%]' : 'h-[38%]'}`}
      style={{
        // ide-pane aesthetic per DESIGN.md
        background: 'var(--color-canvas-soft)',
        borderTop: '1px solid var(--color-hairline)',
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height: '40px',
          background: 'var(--color-surface-card)',
          borderBottom: '1px solid var(--color-hairline)',
        }}
      >
        {/* Left: Back + Node info */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            aria-label="Back to Workflow"
            onClick={() => setTerminalNodeId(null)}
            style={iconBtnStyle()}
            className="mr-1"
            title="Back to Workflow"
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-strong)';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)';
            }}
          >
            <ArrowLeft size={14} />
          </button>
          
          <TerminalSquare size={13} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
          <span
            className="font-semibold text-xs truncate"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}
          >
            {displayName}
          </span>
          {nodeLabel && nodeModel && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-muted)' }}>
              · {nodeModel}
            </span>
          )}
          {/* Status dot */}
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${dot.pulse ? 'animate-pulse' : ''}`}
            style={{ background: dot.color }}
            title={`Status: ${status}`}
          />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Clear Terminal"
            onClick={handleClear}
            style={iconBtnStyle()}
            title="Clear"
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-strong)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <Trash2 size={12} />
          </button>
          <button
            type="button"
            aria-label={isExpanded ? 'Collapse Terminal' : 'Expand Terminal'}
            onClick={() => setIsExpanded(!isExpanded)}
            style={iconBtnStyle()}
            title={isExpanded ? 'Collapse' : 'Expand'}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-strong)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <div className="w-px h-4 mx-1" style={{ background: 'var(--color-hairline)' }} />
          <button
            type="button"
            aria-label="Close Terminal"
            onClick={() => setTerminalNodeId(null)}
            style={iconBtnStyle()}
            title="Close"
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-strong)';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-semantic-error)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)';
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── xterm.js Terminal Container ── */}
      <div
        className="flex-1 overflow-hidden p-2"
        style={{ background: 'var(--color-canvas-soft)' }}
        ref={terminalRef}
      />
    </div>
  );
};
