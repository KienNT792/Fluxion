import React from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { Bot, RotateCcw, Settings, Terminal } from 'lucide-react';
import { AgentNodeData } from '@shared';
import { useWorkflowStore } from '../../stores/workflow.store';
import { useExecutionStore } from '../../stores/execution.store';
import { useThemeStore } from '../../stores/theme.store';
import { retryWorkflowFromNode } from '../../lib/workflow-session';

import geminiLight from '../../assets/logo/gemini-light.svg';
import geminiDark from '../../assets/logo/gemini-dark.svg';
import claudeLight from '../../assets/logo/claude-light.svg';
import claudeDark from '../../assets/logo/claude-dark.svg';
import openaiLight from '../../assets/logo/openai-light.svg';
import openaiDark from '../../assets/logo/openai-dark.svg';
import grokLight from '../../assets/logo/grok-light.svg';
import grokDark from '../../assets/logo/grok-dark.svg';

type AgentFlowNode = Node<AgentNodeData, 'agentNode'>;


// ── AI Timeline Pastel Status Pill ────────────────────────────────────────────
// Mapping agent states to DESIGN.md timeline palette
const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  running:   { bg: 'var(--color-timeline-thinking)', text: 'var(--color-ink)', label: 'Running'   },
  completed: { bg: 'var(--color-timeline-grep)',     text: 'var(--color-ink)', label: 'Done'      },
  error:     { bg: 'var(--color-semantic-error)',    text: '#ffffff',           label: 'Error'     },
  stopping:  { bg: 'var(--color-timeline-read)',     text: 'var(--color-ink)', label: 'Stopping'  },
  paused:    { bg: 'var(--color-timeline-edit)',     text: 'var(--color-ink)', label: 'Paused'    },
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const style = STATUS_STYLE[status];
  if (!style) return null;
  return (
    <span
      className="inline-flex items-center text-[9px] font-semibold uppercase tracking-[0.6px] px-2 py-0.5"
      style={{
        background: style.bg,
        color: style.text,
        borderRadius: 'var(--radius-pill)',
        lineHeight: 1.4,
      }}
    >
      {status === 'running' && (
        <span
          className="w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse"
          style={{ background: style.text, opacity: 0.7 }}
        />
      )}
      {style.label}
    </span>
  );
};

// ── Provider accent colors (thin top bar only) ────────────────────────────────
const PROVIDER_ACCENT: Record<string, string> = {
  google:    '#4285F4',
  anthropic: '#D97757',
  openai:    '#412991',
  codex:     '#f54e00',
  mock:      'var(--color-hairline-strong)',
};

// ── Provider Logo ──────────────────────────────────────────────────────────────
const ProviderLogo: React.FC<{ provider: string }> = ({ provider }) => {
  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';

  switch (provider) {
    case 'google':
      return <img src={isDark ? geminiDark : geminiLight} alt="Gemini" className="w-5 h-5" />;
    case 'anthropic':
      return <img src={isDark ? claudeDark : claudeLight} alt="Claude" className="w-5 h-5" />;
    case 'openai':
      return <img src={isDark ? openaiDark : openaiLight} alt="OpenAI" className="w-5 h-5" />;
    case 'codex':
      return <Bot size={18} style={{ color: 'var(--color-primary)' }} />;
    case 'xai':
    case 'grok':
      return <img src={isDark ? grokDark : grokLight} alt="Grok" className="w-5 h-5" />;
    default:
      return (
        <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-muted)' }}>M</span>
      );
  }
};

// ── Model display name ─────────────────────────────────────────────────────────
const MODEL_LABELS: Record<string, string> = {
  'gemini-1.5-pro':   'Gemini 1.5 Pro',
  'gemini-1.5-flash': 'Gemini 1.5 Flash',
  'gemini-exp-1206':  'Gemini Exp',
  'gpt-4o':           'GPT-4o',
  'o1-preview':       'o1 Preview',
  'o1-mini':          'o1 Mini',
  'o4-mini':          'o4 Mini',
  'codex-mini':       'Codex Mini',
  'claude-3-5-sonnet':'Claude 3.5',
  'claude-3-opus':    'Claude Opus',
  'mock-agent':       'Mock Agent',
};

// ── Node Component ─────────────────────────────────────────────────────────────
export const AgentNode: React.FC<NodeProps<AgentFlowNode>> = ({ id, data }) => {
  const setSelectedNode = useWorkflowStore(state => state.setSelectedNode);
  const codexModels = useWorkflowStore(state => state.codexCapabilities.models);
  const status = useExecutionStore(state => state.nodeStatuses[id] ?? 'idle');
  const nodeError = useExecutionStore(state => state.nodeErrors[id]);
  const workflowStatus = useExecutionStore(state => state.workflowStatus);
  const accentColor = PROVIDER_ACCENT[data.provider] ?? 'var(--color-hairline-strong)';
  const codexDisplayName =
    data.provider === 'codex'
      ? codexModels.find((model) => model.id === data.model)?.displayName
      : undefined;
  const resolvedModelName = codexDisplayName || MODEL_LABELS[data.model] || data.model;
  const displayName = data.label || resolvedModelName;
  const modelLabel  = data.label ? resolvedModelName : data.model;
  const canRetry = status === 'error' && workflowStatus !== 'running';

  // Selected border highlight
  const isSelected = useWorkflowStore(state => state.selectedNodeId === id);

  return (
    <div
      className="w-56 flex flex-col overflow-hidden transition-all duration-200"
      style={{
        background: 'var(--color-surface-card)',
        border: isSelected
          ? `1.5px solid ${accentColor}`
          : '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-lg)',
        // NO box-shadow — per DESIGN.md
      }}
    >
      {/* ── Provider accent bar (1.5px hairline, no glow) ── */}
      <div
        className="h-0.5 w-full flex-shrink-0"
        style={{ background: accentColor, opacity: 0.8 }}
      />

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="group/handle !w-6 !h-1.5 !bg-transparent !border-none !rounded-full hover:!w-8 transition-all duration-200 cursor-crosshair"
      >
        <div className="w-full h-full bg-[var(--color-hairline-strong)] group-hover/handle:bg-[var(--color-primary)] rounded-full transition-colors" />
      </Handle>
      <Handle
        type="source"
        position={Position.Bottom}
        className="group/handle !w-6 !h-1.5 !bg-transparent !border-none !rounded-full hover:!w-8 transition-all duration-200 cursor-crosshair"
      >
        <div className="w-full h-full bg-[var(--color-hairline-strong)] group-hover/handle:bg-[var(--color-primary)] rounded-full transition-colors" />
      </Handle>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-2"
        style={{ background: 'var(--color-canvas-soft)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Provider logo in a minimal icon box */}
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
            style={{
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)',
            }}
          >
            <ProviderLogo provider={data.provider} />
          </div>

          <div className="min-w-0">
            <div
              className="text-xs font-semibold truncate leading-tight"
              style={{ color: 'var(--color-ink)', letterSpacing: '-0.1px' }}
            >
              {displayName}
            </div>
            <div
              className="text-[10px] truncate mt-0.5"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}
            >
              {modelLabel}
            </div>
          </div>
        </div>

        {/* Status pill — only when not idle */}
        {status !== 'idle' && (
          <div className="flex-shrink-0 mt-0.5">
            <StatusPill status={status} />
          </div>
        )}
      </div>

      {/* ── Prompt preview ── */}
      {data.prompt && (
        <div
          className="px-3 py-1.5"
          style={{ borderTop: '1px solid var(--color-hairline-soft)' }}
        >
          <p
            className="text-[10px] truncate italic"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}
          >
            {String(data.prompt).slice(0, 64)}{String(data.prompt).length > 64 ? '…' : ''}
          </p>
        </div>
      )}

      {/* ── Action bar ── */}
      <div
        className="flex"
        style={{ borderTop: '1px solid var(--color-hairline)' }}
      >
        <button
          className="flex-1 py-2 flex items-center justify-center gap-1.5 text-[11px] transition-colors"
          style={{ color: 'var(--color-muted)' }}
          title="Configure"
          onClick={e => { e.stopPropagation(); setSelectedNode(id); }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'var(--color-canvas)';
            (e.currentTarget as HTMLElement).style.color = 'var(--color-ink)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)';
          }}
        >
          <Settings size={11} />
          <span>Config</span>
        </button>

        <div className="w-px" style={{ background: 'var(--color-hairline)' }} />

        {status === 'error' && (
          <>
            <button
              className="flex-1 py-2 flex items-center justify-center gap-1.5 text-[11px] transition-colors"
              style={{
                color: canRetry ? 'var(--color-primary)' : 'var(--color-muted-soft)',
                cursor: canRetry ? 'pointer' : 'not-allowed',
              }}
              title={nodeError || 'Retry from this node'}
              disabled={!canRetry}
              onClick={e => {
                e.stopPropagation();
                if (canRetry) {
                  retryWorkflowFromNode(id);
                }
              }}
              onMouseEnter={e => {
                if (canRetry) {
                  (e.currentTarget as HTMLElement).style.background = 'var(--color-canvas)';
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <RotateCcw size={11} />
              <span>Retry</span>
            </button>

            <div className="w-px" style={{ background: 'var(--color-hairline)' }} />
          </>
        )}

        <button
          className="flex-1 py-2 flex items-center justify-center gap-1.5 text-[11px] transition-colors"
          style={{
            color: status !== 'idle' ? 'var(--color-semantic-success)' : 'var(--color-muted-soft)',
            cursor: status === 'idle' ? 'not-allowed' : 'pointer',
          }}
          title={status === 'idle' ? 'Run first to see logs' : 'View Logs'}
          disabled={status === 'idle'}
          onClick={e => { e.stopPropagation(); useWorkflowStore.getState().setTerminalNodeId(id); }}
          onMouseEnter={e => {
            if (status !== 'idle') {
              (e.currentTarget as HTMLElement).style.background = 'var(--color-canvas)';
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <Terminal size={11} />
          <span>Logs</span>
        </button>
      </div>
    </div>
  );
};
