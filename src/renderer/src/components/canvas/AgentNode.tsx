import React from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { RotateCcw, Settings, Terminal, TerminalSquare } from 'lucide-react';
import { AgentNodeData } from '@shared';
import { useWorkflowStore } from '../../stores/workflow.store';
import { useExecutionStore } from '../../stores/execution.store';
import { retryWorkflowFromNode } from '../../lib/workflow-session';
import { getCodexModelDisplayName } from '../../lib/provider-capabilities';

type AgentFlowNode = Node<AgentNodeData, 'agentNode'>;

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  running: { bg: 'var(--color-timeline-thinking)', text: 'var(--color-ink)', label: 'Running' },
  completed: { bg: 'var(--color-timeline-grep)', text: 'var(--color-ink)', label: 'Done' },
  error: { bg: 'var(--color-semantic-error)', text: '#ffffff', label: 'Error' },
  stopping: { bg: 'var(--color-timeline-read)', text: 'var(--color-ink)', label: 'Stopping' },
  paused: { bg: 'var(--color-timeline-edit)', text: 'var(--color-ink)', label: 'Paused' },
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const style = STATUS_STYLE[status];
  if (!style) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.6px]"
      style={{
        background: style.bg,
        color: style.text,
        borderRadius: 'var(--radius-pill)',
        lineHeight: 1.4,
      }}
    >
      {status === 'running' && (
        <span
          className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ background: style.text, opacity: 0.7 }}
        />
      )}
      {style.label}
    </span>
  );
};

export const AgentNode: React.FC<NodeProps<AgentFlowNode>> = ({ id, data }) => {
  const status = useExecutionStore((state) => state.nodeStatuses[id] ?? 'idle');
  const nodeError = useExecutionStore((state) => state.nodeErrors[id]);
  const workflowStatus = useExecutionStore((state) => state.workflowStatus);
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities);
  const displayName =
    data.label || getCodexModelDisplayName(providerCapabilities, data.model);
  const canRetry =
    status === 'error' &&
    workflowStatus !== 'running' &&
    workflowStatus !== 'paused';
  const isSelected = useWorkflowStore((state) => state.selectedNodeId === id);

  return (
    <div
      className="flex w-56 flex-col overflow-hidden transition-all duration-200"
      style={{
        background: 'var(--color-surface-card)',
        border: isSelected
          ? '1.5px solid #412991'
          : '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div
        className="h-0.5 w-full flex-shrink-0"
        style={{ background: '#412991', opacity: 0.8 }}
      />

      <Handle
        type="target"
        position={Position.Top}
        className="group/handle !h-1.5 !w-6 !cursor-crosshair !rounded-full !border-none !bg-transparent transition-all duration-200 hover:!w-8"
      >
        <div className="h-full w-full rounded-full bg-[var(--color-hairline-strong)] transition-colors group-hover/handle:bg-[var(--color-primary)]" />
      </Handle>
      <Handle
        type="source"
        position={Position.Bottom}
        className="group/handle !h-1.5 !w-6 !cursor-crosshair !rounded-full !border-none !bg-transparent transition-all duration-200 hover:!w-8"
      >
        <div className="h-full w-full rounded-full bg-[var(--color-hairline-strong)] transition-colors group-hover/handle:bg-[var(--color-primary)]" />
      </Handle>

      <div
        className="flex items-start justify-between gap-2 px-3 pb-2 pt-2.5"
        style={{ background: 'var(--color-canvas-soft)' }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
            style={{
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)',
              color: 'var(--color-primary)',
            }}
          >
            <TerminalSquare size={16} />
          </div>

          <div className="min-w-0">
            <div
              className="truncate text-xs font-semibold leading-tight"
              style={{ color: 'var(--color-ink)', letterSpacing: '-0.1px' }}
            >
              {displayName}
            </div>
            <div
              className="mt-0.5 truncate text-[10px]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}
            >
              {data.model}
            </div>
          </div>
        </div>

        {status !== 'idle' && (
          <div className="mt-0.5 flex-shrink-0">
            <StatusPill status={status} />
          </div>
        )}
      </div>

      {data.prompt && (
        <div
          className="px-3 py-1.5"
          style={{ borderTop: '1px solid var(--color-hairline-soft)' }}
        >
          <p
            className="truncate text-[10px] italic"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}
          >
            {String(data.prompt).slice(0, 64)}
            {String(data.prompt).length > 64 ? '...' : ''}
          </p>
        </div>
      )}

      <div className="flex" style={{ borderTop: '1px solid var(--color-hairline)' }}>
        <button
          type="button"
          className="nodrag nopan flex-1 py-2 text-[11px] transition-colors"
          style={{ color: 'var(--color-muted)' }}
          title="Configure"
          onMouseEnter={(event) => {
            event.currentTarget.style.background = 'var(--color-canvas)';
            event.currentTarget.style.color = 'var(--color-ink)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = 'transparent';
            event.currentTarget.style.color = 'var(--color-muted)';
          }}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Settings size={11} />
            <span>Config</span>
          </span>
        </button>

        <div className="w-px" style={{ background: 'var(--color-hairline)' }} />

        {status === 'error' && (
          <>
            <button
              type="button"
              className="nodrag nopan flex-1 py-2 text-[11px] transition-colors"
              style={{
                color: canRetry ? 'var(--color-primary)' : 'var(--color-muted-soft)',
                cursor: canRetry ? 'pointer' : 'not-allowed',
              }}
              title={nodeError || 'Retry from this node'}
              disabled={!canRetry}
              onClick={(event) => {
                event.stopPropagation();
                if (canRetry) {
                  retryWorkflowFromNode(id);
                }
              }}
              onMouseEnter={(event) => {
                if (canRetry) {
                  event.currentTarget.style.background = 'var(--color-canvas)';
                }
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent';
              }}
            >
              <span className="flex items-center justify-center gap-1.5">
                <RotateCcw size={11} />
                <span>Retry</span>
              </span>
            </button>

            <div className="w-px" style={{ background: 'var(--color-hairline)' }} />
          </>
        )}

        <button
          type="button"
          className="nodrag nopan flex-1 py-2 text-[11px] transition-colors"
          style={{
            color: status !== 'idle' ? 'var(--color-semantic-success)' : 'var(--color-muted-soft)',
            cursor: status === 'idle' ? 'not-allowed' : 'pointer',
          }}
          title={status === 'idle' ? 'Run first to see logs' : 'View Logs'}
          disabled={status === 'idle'}
          onClick={(event) => {
            event.stopPropagation();
            useWorkflowStore.getState().setTerminalNodeId(id);
          }}
          onMouseEnter={(event) => {
            if (status !== 'idle') {
              event.currentTarget.style.background = 'var(--color-canvas)';
            }
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = 'transparent';
          }}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Terminal size={11} />
            <span>Logs</span>
          </span>
        </button>
      </div>
    </div>
  );
};
