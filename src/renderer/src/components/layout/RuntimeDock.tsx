import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  FileOutput,
  Terminal,
} from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflow.store';
import { useExecutionStore, WorkflowRuntimeStatus } from '../../stores/execution.store';
import { TerminalViewer } from '../terminal/TerminalViewer';

type DockTab = 'timeline' | 'logs' | 'output';

const STATUS_LABEL: Record<WorkflowRuntimeStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  stopping: 'Stopping',
  paused: 'Paused',
  aborted: 'Aborted',
  completed: 'Completed',
  error: 'Error',
};

const STATUS_DOT_COLOR: Record<WorkflowRuntimeStatus, string> = {
  idle: 'var(--color-hairline-strong)',
  running: 'var(--color-timeline-thinking)',
  stopping: 'var(--color-timeline-read)',
  paused: 'var(--color-timeline-edit)',
  aborted: 'var(--color-muted)',
  completed: 'var(--color-timeline-grep)',
  error: 'var(--color-semantic-error)',
};

const PULSE_STATUSES = new Set<WorkflowRuntimeStatus>(['running', 'stopping']);

function DockTabButton({
  label,
  icon,
  active,
  attention,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  attention?: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors"
      style={{
        color: active ? 'var(--color-ink)' : 'var(--color-muted)',
        borderBottom: active ? '1.5px solid var(--color-primary)' : '1.5px solid transparent',
        background: active ? 'var(--color-canvas-soft)' : 'transparent',
      }}
      onMouseEnter={(event) => {
        if (!active) {
          event.currentTarget.style.color = 'var(--color-ink)';
          event.currentTarget.style.background = 'var(--color-canvas-soft)';
        }
      }}
      onMouseLeave={(event) => {
        if (!active) {
          event.currentTarget.style.color = 'var(--color-muted)';
          event.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {icon}
      {label}
      {attention && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--color-primary)' }}
        />
      )}
    </button>
  );
}

function TimelineEmptyState(): React.JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-8">
      <div className="text-center">
        <Activity
          size={20}
          className="mx-auto mb-2"
          style={{ color: 'var(--color-muted-soft)' }}
        />
        <p
          className="text-xs"
          style={{ color: 'var(--color-muted)', lineHeight: '1.6' }}
        >
          No execution yet. Run workflow to see timeline.
        </p>
      </div>
    </div>
  );
}

function ExecutionTimeline(): React.JSX.Element {
  const workflowStatus = useExecutionStore((state) => state.workflowStatus);
  const nodeStatuses = useExecutionStore((state) => state.nodeStatuses);
  const nodes = useWorkflowStore((state) => state.nodes);
  const reviewNodeIds = useExecutionStore((state) => state.reviewNodeIds);

  const hasAnyExecution = workflowStatus !== 'idle' ||
    Object.values(nodeStatuses).some((s) => s !== 'idle');

  if (!hasAnyExecution) {
    return <TimelineEmptyState />;
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <div className="space-y-1">
        {nodes.map((node) => {
          const status = nodeStatuses[node.id] ?? 'idle';
          const isReview = reviewNodeIds.includes(node.id);
          const label = (node.data.label as string) || node.id;
          const dotColor = STATUS_DOT_COLOR[status as WorkflowRuntimeStatus] ?? STATUS_DOT_COLOR.idle;
          const shouldPulse = PULSE_STATUSES.has(status as WorkflowRuntimeStatus);

          return (
            <div
              key={node.id}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5"
              style={{
                background: isReview ? 'var(--color-surface-card)' : 'transparent',
              }}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${shouldPulse ? 'animate-pulse' : ''}`}
                style={{ background: dotColor }}
              />
              <span
                className="min-w-0 truncate text-xs"
                style={{
                  color: status === 'idle' ? 'var(--color-muted-soft)' : 'var(--color-body)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {label}
              </span>
              <span
                className="ml-auto shrink-0 text-[10px] uppercase"
                style={{
                  color: dotColor,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.05em',
                }}
              >
                {status === 'idle' ? '' : STATUS_LABEL[status as WorkflowRuntimeStatus] ?? status}
              </span>
              {isReview && (
                <span
                  className="shrink-0 text-[9px] uppercase"
                  style={{
                    color: 'var(--color-timeline-edit)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.06em',
                  }}
                >
                  Review
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OutputEmptyState(): React.JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-8">
      <div className="text-center">
        <FileOutput
          size={20}
          className="mx-auto mb-2"
          style={{ color: 'var(--color-muted-soft)' }}
        />
        <p
          className="text-xs"
          style={{ color: 'var(--color-muted)', lineHeight: '1.6' }}
        >
          No output selected yet.
        </p>
      </div>
    </div>
  );
}

function OutputPreview(): React.JSX.Element {
  const nodeOutputPaths = useExecutionStore((state) => state.nodeOutputPaths);
  const hasOutputs = Object.values(nodeOutputPaths).some(Boolean);

  if (!hasOutputs) {
    return <OutputEmptyState />;
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <div className="space-y-1.5">
        {Object.entries(nodeOutputPaths).map(([nodeId, outputPath]) => {
          if (!outputPath) return null;
          return (
            <div
              key={nodeId}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
              style={{ background: 'var(--color-surface-card)' }}
            >
              <FileOutput size={12} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
              <span
                className="min-w-0 truncate text-[11px]"
                style={{ color: 'var(--color-body)', fontFamily: 'var(--font-mono)' }}
              >
                {outputPath}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Integrated Runtime Dock — Region 6 of the AppShell.
 *
 * Persistent panel below the canvas. Shows execution state,
 * logs, and output artifacts. Not a VSCode terminal — it's an
 * orchestration-centric dock for workflow runtime visibility.
 *
 * - Collapsed: thin status bar with workflow status + expand toggle
 * - Expanded: tabbed panel (Timeline | Logs | Output)
 * - Runtime state persists independently from node selection
 */
export const RuntimeDock: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<DockTab>('timeline');

  const workflowStatus = useExecutionStore((state) => state.workflowStatus);
  const terminalNodeId = useWorkflowStore((state) => state.terminalNodeId);
  const reviewNodeIds = useExecutionStore((state) => state.reviewNodeIds);
  const nodeAttemptCounts = useExecutionStore((state) => state.nodeAttemptCounts);
  const executionMode = useWorkflowStore((state) => state.executionMode);
  const setExecutionMode = useWorkflowStore((state) => state.setExecutionMode);

  const totalRuns = Object.values(nodeAttemptCounts).reduce((acc, val) => acc + (val || 0), 0);

  const isActive = workflowStatus !== 'idle';
  const dotColor = STATUS_DOT_COLOR[workflowStatus];
  const shouldPulse = PULSE_STATUSES.has(workflowStatus);
  const hasReviewQueue = reviewNodeIds.length > 0;

  const prevTerminalNodeIdRef = useRef(terminalNodeId);
  const prevWorkflowStatusRef = useRef(workflowStatus);

  useEffect(() => {
    // Auto-expand + switch to logs when a terminal node is opened
    if (terminalNodeId && terminalNodeId !== prevTerminalNodeIdRef.current) {
      setIsExpanded(true);
      setActiveTab('logs');
    }
    prevTerminalNodeIdRef.current = terminalNodeId;
  }, [terminalNodeId]);

  useEffect(() => {
    // Auto-expand when workflow transitions to running
    if (workflowStatus === 'running' && prevWorkflowStatusRef.current !== 'running') {
      setIsExpanded(true);
    }
    prevWorkflowStatusRef.current = workflowStatus;
  }, [workflowStatus]);

  return (
    <div
      className="flex flex-col"
      style={{
        flexShrink: 0,
        borderTop: '1px solid var(--color-hairline-strong)',
        background: 'var(--color-canvas)',
      }}
    >
      {/* ── Dock Header (always visible) ── */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex h-9 w-full items-center justify-between px-4 transition-colors"
        style={{
          background: isExpanded ? 'var(--color-surface-card)' : 'var(--color-canvas)',
          borderBottom: isExpanded ? '1px solid var(--color-hairline)' : 'none',
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.background = 'var(--color-surface-card)';
        }}
        onMouseLeave={(event) => {
          if (!isExpanded) {
            event.currentTarget.style.background = 'var(--color-canvas)';
          }
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${shouldPulse ? 'animate-pulse' : ''}`}
            style={{ background: dotColor }}
          />
          <div className="flex flex-col">
            <span
              className="text-xs font-semibold"
              style={{
                color: isActive ? 'var(--color-ink)' : 'var(--color-body)',
                letterSpacing: '-0.1px',
              }}
            >
              {STATUS_LABEL[workflowStatus]}
              {!isActive && (
                <span className="ml-1.5 font-normal" style={{ color: 'var(--color-muted)' }}>
                  · {totalRuns} run{totalRuns !== 1 ? 's' : ''}
                </span>
              )}
            </span>
            {hasReviewQueue && (
              <span
                className="mt-0.5 text-[10px]"
                style={{
                  color: 'var(--color-timeline-edit)',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                }}
              >
                {reviewNodeIds.length} review{reviewNodeIds.length > 1 ? 's' : ''} pending
              </span>
            )}
            {!isActive && !hasReviewQueue && totalRuns === 0 && (
              <span
                className="mt-0.5 text-[10px]"
                style={{ color: 'var(--color-muted-soft)' }}
              >
                No execution yet
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4" style={{ color: 'var(--color-muted)' }}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setExecutionMode(executionMode === 'auto' ? 'manual' : 'auto');
            }}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors"
            style={{
              background: executionMode === 'manual' ? 'var(--color-surface-strong)' : 'transparent',
            }}
            title={executionMode === 'auto' ? 'Auto mode' : 'Manual mode'}
            onMouseEnter={(event) => {
              event.currentTarget.style.color = 'var(--color-ink)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.color = 'var(--color-muted)';
            }}
          >
            <span
              className="text-[9px] font-semibold uppercase tracking-wider"
              style={{
                color: executionMode === 'manual' ? 'var(--color-timeline-done)' : 'inherit',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {executionMode === 'auto' ? 'Auto' : 'Manual'}
            </span>
          </button>
          
          <div>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </div>
        </div>
      </button>

      {/* ── Expanded Content ── */}
      {isExpanded && (
        <div
          className="flex flex-col overflow-hidden"
          style={{ height: 'clamp(180px, 30vh, 320px)' }}
        >
          {/* Tab bar */}
          <div
            className="flex shrink-0 items-center gap-0.5 px-2"
            style={{
              background: 'var(--color-surface-card)',
              borderBottom: '1px solid var(--color-hairline)',
            }}
          >
            <DockTabButton
              label="Timeline"
              icon={<Activity size={12} />}
              active={activeTab === 'timeline'}
              onClick={() => setActiveTab('timeline')}
            />
            <DockTabButton
              label="Logs"
              icon={<Terminal size={12} />}
              active={activeTab === 'logs'}
              attention={Boolean(terminalNodeId)}
              onClick={() => setActiveTab('logs')}
            />
            <DockTabButton
              label="Output"
              icon={<FileOutput size={12} />}
              active={activeTab === 'output'}
              onClick={() => setActiveTab('output')}
            />
          </div>

          {/* Tab content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {activeTab === 'timeline' && <ExecutionTimeline />}
            {activeTab === 'logs' && <TerminalViewer />}
            {activeTab === 'output' && <OutputPreview />}
          </div>
        </div>
      )}
    </div>
  );
};
