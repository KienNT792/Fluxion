import React, { useEffect, useMemo, useRef, useState } from 'react';
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

function getDisplayName(
  label: string | undefined,
  model: string | undefined,
  fallback: string
): string {
  return label || model || fallback;
}

function pickAutoFollowNodeId(
  terminalNodeId: string | null,
  nodeStatuses: Record<string, string>
): string | null {
  if (terminalNodeId && nodeStatuses[terminalNodeId] === 'running') {
    return terminalNodeId;
  }

  const runningNodeId = Object.entries(nodeStatuses).find(([, status]) => status === 'running')?.[0];
  return runningNodeId ?? terminalNodeId;
}

function DockTabButton({
  label,
  icon,
  active,
  attentionColor,
  attentionPulse = false,
  badge,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  attentionColor?: string;
  attentionPulse?: boolean;
  badge?: number;
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
      {typeof badge === 'number' && badge > 0 ? (
        <span
          className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none"
          style={{
            color: badge > 0 ? 'white' : 'var(--color-ink)',
            background: attentionColor ?? 'var(--color-primary)',
          }}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
      {!badge && attentionColor ? (
        <span
          className={`h-1.5 w-1.5 rounded-full ${attentionPulse ? 'animate-pulse' : ''}`}
          style={{ background: attentionColor }}
        />
      ) : null}
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
  const reviewNodeIds = useExecutionStore((state) => state.reviewNodeIds);
  const terminalNodeId = useWorkflowStore((state) => state.terminalNodeId);
  const nodes = useWorkflowStore((state) => state.nodes);

  const hasAnyExecution = workflowStatus !== 'idle'
    || Object.values(nodeStatuses).some((status) => status !== 'idle');

  if (!hasAnyExecution) {
    return <TimelineEmptyState />;
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <div className="space-y-1">
        {nodes.map((node) => {
          const status = nodeStatuses[node.id] ?? 'idle';
          const isReview = reviewNodeIds.includes(node.id);
          const isFollowed = terminalNodeId === node.id;
          const label = (node.data.label as string) || node.id;
          const dotColor = STATUS_DOT_COLOR[status as WorkflowRuntimeStatus] ?? STATUS_DOT_COLOR.idle;
          const shouldPulse = PULSE_STATUSES.has(status as WorkflowRuntimeStatus);

          return (
            <div
              key={node.id}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5"
              style={{
                background: isFollowed
                  ? 'var(--color-canvas-soft)'
                  : isReview
                    ? 'var(--color-surface-card)'
                    : 'transparent',
                border: isFollowed
                  ? '1px solid var(--color-hairline-strong)'
                  : '1px solid transparent',
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
              {isFollowed ? (
                <span
                  className="shrink-0 text-[9px] uppercase"
                  style={{
                    color: 'var(--color-primary)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.06em',
                  }}
                >
                  Active
                </span>
              ) : null}
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
              {isReview ? (
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
              ) : null}
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

export const RuntimeDock: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<DockTab>('timeline');
  const [allowAutoLogTabActivation, setAllowAutoLogTabActivation] = useState(true);

  const nodes = useWorkflowStore((state) => state.nodes);
  const executionMode = useWorkflowStore((state) => state.executionMode);
  const terminalNodeId = useWorkflowStore((state) => state.terminalNodeId);
  const terminalFollowMode = useWorkflowStore((state) => state.terminalFollowMode);
  const terminalViewRequestId = useWorkflowStore((state) => state.terminalViewRequestId);
  const setExecutionMode = useWorkflowStore((state) => state.setExecutionMode);
  const setTerminalFollowMode = useWorkflowStore((state) => state.setTerminalFollowMode);
  const followTerminalNode = useWorkflowStore((state) => state.followTerminalNode);

  const workflowStatus = useExecutionStore((state) => state.workflowStatus);
  const reviewNodeIds = useExecutionStore((state) => state.reviewNodeIds);
  const nodeAttemptCounts = useExecutionStore((state) => state.nodeAttemptCounts);
  const nodeStatuses = useExecutionStore((state) => state.nodeStatuses);

  const totalRuns = Object.values(nodeAttemptCounts).reduce((acc, value) => acc + (value || 0), 0);
  const runningNodeIds = useMemo(
    () => Object.entries(nodeStatuses).filter(([, status]) => status === 'running').map(([id]) => id),
    [nodeStatuses]
  );
  const errorNodeIds = useMemo(
    () => Object.entries(nodeStatuses).filter(([, status]) => status === 'error').map(([id]) => id),
    [nodeStatuses]
  );

  const isActive = workflowStatus !== 'idle';
  const dotColor = STATUS_DOT_COLOR[workflowStatus];
  const shouldPulse = PULSE_STATUSES.has(workflowStatus);
  const hasReviewQueue = reviewNodeIds.length > 0;
  const followedNode = terminalNodeId ? nodes.find((node) => node.id === terminalNodeId) : null;
  const followedNodeLabel = getDisplayName(
    followedNode?.data?.label as string | undefined,
    followedNode?.data?.model as string | undefined,
    terminalNodeId ?? 'No node selected'
  );
  const followedNodeModel = followedNode?.data?.model as string | undefined;
  const followedNodeStatus = terminalNodeId ? nodeStatuses[terminalNodeId] ?? 'idle' : 'idle';

  const followSummary = terminalNodeId
    ? terminalFollowMode === 'auto'
      ? `Following: ${followedNodeLabel}`
      : `Viewing: ${followedNodeLabel} · Manual`
    : terminalFollowMode === 'auto'
      ? 'Following: waiting for active node'
      : 'Viewing: no node selected · Manual';

  const secondarySummary = runningNodeIds.length > 0
    ? `${runningNodeIds.length} node${runningNodeIds.length === 1 ? '' : 's'} running`
    : hasReviewQueue
      ? `${reviewNodeIds.length} review${reviewNodeIds.length === 1 ? '' : 's'} pending`
      : totalRuns > 0
        ? `${totalRuns} run${totalRuns === 1 ? '' : 's'} recorded`
        : 'No execution yet';

  const logsAttentionColor = errorNodeIds.length > 0
    ? 'var(--color-semantic-error)'
    : terminalNodeId && followedNodeStatus === 'running'
      ? 'var(--color-timeline-thinking)'
      : terminalNodeId
        ? 'var(--color-primary)'
        : undefined;

  const prevTerminalViewRequestIdRef = useRef(terminalViewRequestId);
  const prevWorkflowStatusRef = useRef(workflowStatus);

  useEffect(() => {
    let frameId: number | null = null;

    if (terminalNodeId && terminalViewRequestId !== prevTerminalViewRequestIdRef.current) {
      frameId = window.requestAnimationFrame(() => {
        setIsExpanded(true);
        if (terminalFollowMode === 'manual' || allowAutoLogTabActivation) {
          setActiveTab('logs');
        }
      });
    }

    prevTerminalViewRequestIdRef.current = terminalViewRequestId;

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [allowAutoLogTabActivation, terminalFollowMode, terminalNodeId, terminalViewRequestId]);

  useEffect(() => {
    let frameId: number | null = null;

    if (workflowStatus === 'running' && prevWorkflowStatusRef.current !== 'running') {
      frameId = window.requestAnimationFrame(() => {
        setIsExpanded(true);
        setAllowAutoLogTabActivation(true);
      });
    }

    prevWorkflowStatusRef.current = workflowStatus;

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [workflowStatus]);

  const handleTabChange = (tab: DockTab): void => {
    setActiveTab(tab);
    setAllowAutoLogTabActivation(tab === 'logs');
  };

  const handleFollowRunning = (): void => {
    const nextNodeId = pickAutoFollowNodeId(terminalNodeId, nodeStatuses);
    setTerminalFollowMode('auto');
    if (nextNodeId) {
      followTerminalNode(nextNodeId);
    }
    setIsExpanded(true);
    setActiveTab('logs');
    setAllowAutoLogTabActivation(true);
  };

  return (
    <div
      className="flex flex-col"
      style={{
        flexShrink: 0,
        borderTop: '1px solid var(--color-hairline-strong)',
        background: 'var(--color-canvas)',
      }}
    >
      <div
        className="flex items-stretch justify-between"
        style={{
          background: isExpanded ? 'var(--color-surface-card)' : 'var(--color-canvas)',
          borderBottom: isExpanded ? '1px solid var(--color-hairline)' : 'none',
        }}
      >
        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left transition-colors"
          onMouseEnter={(event) => {
            event.currentTarget.style.background = 'var(--color-surface-card)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = isExpanded
              ? 'var(--color-surface-card)'
              : 'var(--color-canvas)';
          }}
        >
          <span
            className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${shouldPulse ? 'animate-pulse' : ''}`}
            style={{ background: dotColor }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="truncate text-xs font-semibold"
                style={{
                  color: isActive ? 'var(--color-ink)' : 'var(--color-body)',
                  letterSpacing: '-0.1px',
                }}
              >
                {STATUS_LABEL[workflowStatus]}
              </span>
              <span
                className="shrink-0 text-[10px] uppercase"
                style={{
                  color: terminalFollowMode === 'auto'
                    ? 'var(--color-timeline-thinking)'
                    : 'var(--color-timeline-done)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.06em',
                }}
              >
                {terminalFollowMode === 'auto' ? 'Auto-follow' : 'Manual'}
              </span>
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-2">
              <span
                className="truncate text-[11px]"
                style={{ color: 'var(--color-body)' }}
              >
                {followSummary}
              </span>
              {followedNodeModel && terminalNodeId ? (
                <span
                  className="shrink-0 text-[10px]"
                  style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  {followedNodeModel}
                </span>
              ) : null}
            </div>
            <div
              className="mt-0.5 text-[10px]"
              style={{ color: hasReviewQueue ? 'var(--color-timeline-edit)' : 'var(--color-muted)' }}
            >
              {secondarySummary}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 px-3" style={{ color: 'var(--color-muted)' }}>
          {terminalFollowMode === 'manual' ? (
            <button
              type="button"
              onClick={handleFollowRunning}
              className="rounded-md px-2 py-1 text-[10px] font-semibold transition-colors"
              style={{
                color: 'var(--color-timeline-thinking)',
                background: 'var(--color-canvas-soft)',
                fontFamily: 'var(--font-mono)',
              }}
              title="Return terminal focus to running nodes"
              onMouseEnter={(event) => {
                event.currentTarget.style.background = 'var(--color-surface-strong)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'var(--color-canvas-soft)';
              }}
            >
              Follow Running
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setExecutionMode(executionMode === 'auto' ? 'manual' : 'auto')}
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

          <button
            type="button"
            onClick={() => setIsExpanded((value) => !value)}
            className="rounded-md p-1 transition-colors"
            style={{ color: 'inherit' }}
            title={isExpanded ? 'Collapse runtime dock' : 'Expand runtime dock'}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = 'var(--color-canvas-soft)';
              event.currentTarget.style.color = 'var(--color-ink)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent';
              event.currentTarget.style.color = 'inherit';
            }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div
          className="flex flex-col overflow-hidden"
          style={{ height: 'clamp(180px, 30vh, 320px)' }}
        >
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
              onClick={() => handleTabChange('timeline')}
            />
            <DockTabButton
              label="Logs"
              icon={<Terminal size={12} />}
              active={activeTab === 'logs'}
              attentionColor={logsAttentionColor}
              attentionPulse={followedNodeStatus === 'running'}
              badge={errorNodeIds.length > 0 ? errorNodeIds.length : undefined}
              onClick={() => handleTabChange('logs')}
            />
            <DockTabButton
              label="Output"
              icon={<FileOutput size={12} />}
              active={activeTab === 'output'}
              onClick={() => handleTabChange('output')}
            />
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            {activeTab === 'timeline' ? <ExecutionTimeline /> : null}
            {activeTab === 'logs' ? <TerminalViewer /> : null}
            {activeTab === 'output' ? <OutputPreview /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};
