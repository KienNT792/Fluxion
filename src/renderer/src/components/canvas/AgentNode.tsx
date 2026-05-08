import React from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { Eye, RotateCcw, Settings, Terminal, TerminalSquare } from 'lucide-react';
import { AgentNodeData } from '@shared';
import { useWorkflowStore } from '../../stores/workflow.store';
import { useExecutionStore } from '../../stores/execution.store';
import { retryWorkflowFromNode } from '../../lib/workflow-session';
import { getCodexModelDisplayName } from '../../lib/provider-capabilities';

type AgentFlowNode = Node<AgentNodeData, 'agentNode'>;

/**
 * Orchestration-focused node appearance.
 *
 * Design goals (Phase 5):
 * - Reduce visual noise: smaller footprint, no full-width status chips
 * - Execution focus: running/paused/error get visible treatment, idle stays quiet
 * - Selection: subtle left accent instead of full border change
 * - Review mode: warm pulse border + distinct "Review" button
 * - Reading flow: top-to-bottom DAG with quiet handles
 */

// Compact status indicator — just a colored dot + short label in header
const STATUS_DOT: Record<string, { color: string; pulse: boolean }> = {
  running:   { color: 'var(--color-timeline-thinking)', pulse: true  },
  completed: { color: 'var(--color-timeline-grep)',     pulse: false },
  error:     { color: 'var(--color-semantic-error)',    pulse: false },
  stopping:  { color: 'var(--color-timeline-read)',     pulse: true  },
  paused:    { color: 'var(--color-timeline-edit)',     pulse: true  },
  idle:      { color: 'var(--color-hairline-strong)',   pulse: false },
};

const STATUS_LABEL: Record<string, string> = {
  running: 'Running',
  completed: 'Done',
  error: 'Error',
  stopping: 'Stopping',
  paused: 'Review',
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

  const dot = STATUS_DOT[status] ?? STATUS_DOT.idle;
  const isExecuting = status === 'running' || status === 'stopping';
  const isPaused = status === 'paused';

  // Border hierarchy: review > executing > selected > default
  const borderStyle = (): string => {
    if (isPaused) return '1.5px solid var(--color-timeline-edit)';
    if (isExecuting) return '1.5px solid var(--color-timeline-thinking)';
    if (status === 'error') return '1.5px solid var(--color-semantic-error)';
    if (isSelected) return '1.5px solid var(--color-primary)';
    return '1px solid var(--color-hairline)';
  };

  // Left accent strip color for orchestration reading flow
  const accentColor = (): string => {
    if (isPaused) return 'var(--color-timeline-edit)';
    if (isExecuting) return 'var(--color-timeline-thinking)';
    if (status === 'error') return 'var(--color-semantic-error)';
    if (status === 'completed') return 'var(--color-timeline-grep)';
    if (isSelected) return 'var(--color-primary)';
    return 'var(--color-hairline-strong)';
  };

  return (
    <div
      className="flex w-56 flex-col overflow-hidden transition-all duration-200"
      style={{
        background: 'var(--color-surface-card)',
        border: borderStyle(),
        borderRadius: 'var(--radius-lg)',
        opacity: status === 'idle' && workflowStatus === 'running' ? 0.55 : 1,
        boxShadow: isSelected ? '0 0 0 1px var(--color-primary)' : 'none',
      }}
    >
      {/* Top accent strip — thin, colored by execution state */}
      <div
        className="w-full flex-shrink-0 transition-colors duration-300"
        style={{
          height: '2px',
          background: accentColor(),
        }}
      />

      {/* Handles — quiet, minimal */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-1 !w-5 !cursor-crosshair !rounded-full !border-none !bg-transparent transition-all duration-150 hover:!w-7"
      >
        <div className="h-full w-full rounded-full bg-[var(--color-hairline)] transition-colors hover:bg-[var(--color-muted)]" />
      </Handle>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-1 !w-5 !cursor-crosshair !rounded-full !border-none !bg-transparent transition-all duration-150 hover:!w-7"
      >
        <div className="h-full w-full rounded-full bg-[var(--color-hairline)] transition-colors hover:bg-[var(--color-muted)]" />
      </Handle>

      {/* Header row — agent identity + execution dot */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ background: 'var(--color-canvas-soft)' }}
      >
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md"
          style={{
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-hairline)',
            color: isExecuting ? 'var(--color-timeline-thinking)' : 'var(--color-muted)',
          }}
        >
          <TerminalSquare size={14} />
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[11px] font-semibold leading-tight"
            style={{ color: 'var(--color-ink)', letterSpacing: '-0.1px' }}
          >
            {displayName}
          </div>
          {!isFreshOnboarding && (
            <div
              className="mt-0.5 truncate text-[9px]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted-soft)' }}
            >
              {data.model}
            </div>
          )}
        </div>

        {/* Status dot — always present, quiet when idle */}
        <div className="flex shrink-0 items-center gap-1.5">
          {status !== 'idle' && (
            <span
              className="text-[8px] uppercase"
              style={{
                color: dot.color,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.06em',
              }}
            >
              {STATUS_LABEL[status] ?? ''}
            </span>
          )}
          <span
            className={`h-[6px] w-[6px] shrink-0 rounded-full transition-colors duration-300 ${dot.pulse ? 'animate-pulse' : ''}`}
            style={{ background: dot.color }}
            title={`Status: ${status}`}
          />
        </div>
      </div>

      {/* Instruction preview — only when meaningful, single-line */}
      {data.prompt && (
        <div
          className="px-3 py-2"
          style={{ borderTop: '1px solid var(--color-hairline-soft)' }}
        >
          <p
            className="truncate text-[10px]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-body)' }}
          >
            {String(data.prompt).slice(0, 72)}
          </p>
        </div>
      )}

      {/* Error indicator — compact inline */}
      {status === 'error' && nodeError && (
        <div
          className="px-3 py-1"
          style={{
            borderTop: '1px solid var(--color-hairline-soft)',
            background: 'var(--color-canvas-soft)',
          }}
        >
          <p
            className="truncate text-[9px]"
            style={{ color: 'var(--color-semantic-error)', fontFamily: 'var(--font-mono)' }}
            title={nodeError}
          >
            {nodeError.slice(0, 80)}
          </p>
        </div>
      )}

      {/* Action bar — minimal, context-aware */}
      <div
        className="flex"
        style={{ borderTop: '1px solid var(--color-hairline)' }}
      >
        {/* Config — always available */}
        <ActionButton icon={<Settings size={10} />} label="Config" />

        <div className="w-px" style={{ background: 'var(--color-hairline)' }} />

        {/* Review — prominent when paused */}
        {isPaused && (
          <>
            <ActionButton
              icon={<Eye size={10} />}
              label="Review"
              color="var(--color-timeline-edit)"
              onClick={(event) => {
                event.stopPropagation();
                requestReviewFocus(id);
              }}
            />
            <div className="w-px" style={{ background: 'var(--color-hairline)' }} />
          </>
        )}

        {/* Retry — only on error */}
        {status === 'error' && (
          <>
            <ActionButton
              icon={<RotateCcw size={10} />}
              label="Retry"
              color={canRetry ? 'var(--color-primary)' : 'var(--color-muted-soft)'}
              disabled={!canRetry}
              title={nodeError || 'Retry from this node'}
              onClick={(event) => {
                event.stopPropagation();
                if (canRetry) retryWorkflowFromNode(id);
              }}
            />
            <div className="w-px" style={{ background: 'var(--color-hairline)' }} />
          </>
        )}

        {/* Logs — only when node has executed */}
        <ActionButton
          icon={<Terminal size={10} />}
          label="Logs"
          color={status !== 'idle' ? 'var(--color-muted)' : 'var(--color-muted-soft)'}
          disabled={status === 'idle'}
          title={status === 'idle' ? 'Run first to see logs' : 'View Logs'}
          onClick={(event) => {
            event.stopPropagation();
            useWorkflowStore.getState().setTerminalNodeId(id);
          }}
        />
      </div>
    </div>
  );
};

// ── Compact action button ──
function ActionButton({
  icon,
  label,
  color = 'var(--color-muted)',
  disabled = false,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color?: string;
  disabled?: boolean;
  title?: string;
  onClick?: (event: React.MouseEvent) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="nodrag nopan flex-1 py-1.5 text-[10px] transition-colors"
      style={{
        color,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={(event) => {
        if (!disabled) {
          event.currentTarget.style.background = 'var(--color-canvas)';
          event.currentTarget.style.color = 'var(--color-ink)';
        }
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'transparent';
        event.currentTarget.style.color = color;
      }}
    >
      <span className="flex items-center justify-center gap-1">
        {icon}
        <span>{label}</span>
      </span>
    </button>
  );
}
