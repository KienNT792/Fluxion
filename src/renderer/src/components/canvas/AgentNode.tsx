import React from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { Eye, RotateCcw, Settings, Terminal, TerminalSquare } from 'lucide-react';
import { AgentNodeData } from '@shared';
import { useWorkflowStore } from '../../stores/workflow.store';
import { useExecutionStore } from '../../stores/execution.store';
import { retryWorkflowFromNode } from '../../lib/workflow-session';
import { getCodexModelDisplayName } from '../../lib/provider-capabilities';
import { StatusChip, StatusChipTone } from '../ui/StatusChip';

type AgentFlowNode = Node<AgentNodeData, 'agentNode'>;

const STATUS_LABELS: Record<string, { label: string; tone: StatusChipTone }> = {
  running: { label: 'Running', tone: 'running' },
  completed: { label: 'Done', tone: 'completed' },
  error: { label: 'Error', tone: 'error' },
  stopping: { label: 'Stopping', tone: 'stopping' },
  paused: { label: 'Paused', tone: 'paused' },
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
    workflowStatus !== 'stopping' &&
    workflowStatus !== 'paused';
  const isSelected = useWorkflowStore((state) => state.selectedNodeId === id);
  const requestReviewFocus = useWorkflowStore((state) => state.requestReviewFocus);
  const isNewWorkspace = useWorkflowStore((state) => state.isNewWorkspace);
  const isDirty = useWorkflowStore((state) => state.isDirty);
  const isFreshOnboarding = isNewWorkspace && !isDirty;

  return (
    <div
      className="flex w-56 flex-col overflow-hidden transition-all duration-200"
      style={{
        background: 'var(--color-surface-card)',
        border: isSelected
          ? '1.5px solid #412991'
          : status === 'paused'
            ? '1.5px solid var(--color-timeline-edit)'
          : '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div
        className="h-0.5 w-full flex-shrink-0"
        style={{
          background:
            status === 'paused' ? 'var(--color-timeline-edit)' : '#412991',
          opacity: 0.8,
        }}
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
            {!isFreshOnboarding && (
              <div
                className="mt-0.5 truncate text-[10px]"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}
              >
                {data.model}
              </div>
            )}
          </div>
        </div>

        {status !== 'idle' && (
          <div className="mt-0.5 flex-shrink-0">
            <StatusChip
              tone={STATUS_LABELS[status]?.tone ?? 'idle'}
              label={STATUS_LABELS[status]?.label ?? status}
              animate={status === 'running' || status === 'stopping'}
              className="text-[9px] uppercase tracking-[0.6px]"
            />
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

        {status === 'paused' && (
          <>
            <button
              type="button"
              className="nodrag nopan flex-1 py-2 text-[11px] transition-colors"
              style={{
                color: 'var(--color-timeline-edit)',
              }}
              title="Open review panel"
              onClick={(event) => {
                event.stopPropagation();
                requestReviewFocus(id);
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = 'var(--color-canvas)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent';
              }}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Eye size={11} />
                <span>Review</span>
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
