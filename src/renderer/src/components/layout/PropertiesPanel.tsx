import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightFromLine, RotateCcw, TerminalSquare, Trash2 } from 'lucide-react';
import { z } from 'zod';
import {
  AgentNodeData,
  CODEX_DEFAULT_REASONING_LEVEL,
  ModelId,
  NodeStatus,
  ReasoningLevel,
} from '@shared';
import {
  approveReviewNode,
  rejectReviewNode,
  rerunReviewNode,
  retryWorkflowFromNode,
} from '../../lib/workflow-session';
import {
  getCodexCapabilities,
  getCodexModelById,
  getCodexModelDisplayName,
  getCodexReadinessBadgeState,
  getDefaultCodexModel,
  modelSupportsReasoning,
} from '../../lib/provider-capabilities';
import { useExecutionStore } from '../../stores/execution.store';
import { useWorkflowStore } from '../../stores/workflow.store';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { getFormControlStyle } from '../ui/form-control';

function coerceNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function coerceOptionalPositiveInteger(value: unknown): number | undefined {
  const parsed = coerceNumber(value, Number.NaN);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.floor(parsed);
}

const nodeDataSchema = z
  .object({
    provider: z.literal('codex'),
    model: z.string().min(1),
    label: z.string().optional(),
    prompt: z.string(),
    systemInstruction: z.string().optional(),
    humanReview: z.boolean().optional(),
    maxTokens: z.preprocess(coerceOptionalPositiveInteger, z.number().optional()),
    temperature: z.preprocess(
      (value) => coerceNumber(value, 0.7),
      z.number().min(0).max(2).optional()
    ),
    reasoningLevel: z.enum(['low', 'medium', 'high', 'xhigh']).optional(),
  })
  .passthrough();

const REASONING_LEVEL_LABELS: Record<ReasoningLevel, { label: string; hint: string }> = {
  low: { label: 'Low', hint: 'Fast' },
  medium: { label: 'Med', hint: 'Balanced' },
  high: { label: 'High', hint: 'Deep' },
  xhigh: { label: 'XHigh', hint: 'Max' },
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
  display: 'block',
  marginBottom: '5px',
};

const READONLY_INLINE_STYLE: React.CSSProperties = {
  ...getFormControlStyle({ font: 'mono' }),
  display: 'flex',
  alignItems: 'center',
  cursor: 'default',
};

const READONLY_BLOCK_STYLE: React.CSSProperties = {
  ...getFormControlStyle({ font: 'mono', multiline: true, resize: 'none' }),
  cursor: 'default',
};

const MUTED_NOTE_STYLE: React.CSSProperties = {
  fontSize: '11px',
  lineHeight: 1.5,
  color: 'var(--color-muted)',
};

interface ModelOption {
  id: string;
  label: string;
  description?: string;
}

function buildModelOptions(models: AgentNodeData['model'], options: ModelOption[]): ModelOption[] {
  if (!models || options.some((option) => option.id === models)) {
    return options;
  }

  return [
    ...options,
    {
      id: models,
      label: `Legacy / Custom (${models})`,
      description: 'Persisted from an older workflow or custom model slug.',
    },
  ];
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div
      className="px-5 py-2"
      style={{ borderBottom: '1px solid var(--color-hairline-soft)' }}
    >
      <span style={LABEL_STYLE}>{title}</span>
    </div>
    <div className="space-y-4 px-5 py-4">{children}</div>
  </div>
);

export const PropertiesPanel: React.FC = () => {
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const setSelectedNode = useWorkflowStore((state) => state.setSelectedNode);
  const nodes = useWorkflowStore((state) => state.nodes);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const deleteNode = useWorkflowStore((state) => state.deleteNode);
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities);
  const executionMode = useWorkflowStore((state) => state.executionMode);
  const hasFetchedProviderCapabilities = useWorkflowStore(
    (state) => state.hasFetchedProviderCapabilities
  );
  const fetchProviderCapabilities = useWorkflowStore((state) => state.fetchProviderCapabilities);
  const nodeStatus = useExecutionStore(
    (state) => (selectedNodeId ? state.nodeStatuses[selectedNodeId] : undefined) ?? 'idle'
  );
  const nodeError = useExecutionStore((state) =>
    selectedNodeId ? state.nodeErrors[selectedNodeId] : undefined
  );
  const nodeExitCode = useExecutionStore((state) =>
    selectedNodeId ? state.nodeExitCodes[selectedNodeId] : undefined
  );
  const nodeOutputPath = useExecutionStore((state) =>
    selectedNodeId ? state.nodeOutputPaths[selectedNodeId] : undefined
  );
  const workflowStatus = useExecutionStore((state) => state.workflowStatus);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const [localData, setLocalData] = useState<Partial<AgentNodeData>>({});
  const skipNextSyncRef = useRef(false);

  useEffect(() => {
    if (!hasFetchedProviderCapabilities) {
      void fetchProviderCapabilities();
    }
  }, [fetchProviderCapabilities, hasFetchedProviderCapabilities]);

  useEffect(() => {
    if (!selectedNode) {
      setLocalData({});
      return;
    }

    skipNextSyncRef.current = true;
    setLocalData({
      provider: 'codex',
      model:
        typeof selectedNode.data.model === 'string' && selectedNode.data.model.trim()
          ? selectedNode.data.model
          : getDefaultCodexModel(providerCapabilities),
      label: selectedNode.data.label,
      prompt: typeof selectedNode.data.prompt === 'string' ? selectedNode.data.prompt : '',
      systemInstruction:
        typeof selectedNode.data.systemInstruction === 'string'
          ? selectedNode.data.systemInstruction
          : '',
      humanReview: Boolean(selectedNode.data.humanReview),
      maxTokens: coerceOptionalPositiveInteger(selectedNode.data.maxTokens),
      temperature:
        typeof selectedNode.data.temperature === 'number'
          ? selectedNode.data.temperature
          : undefined,
      reasoningLevel: selectedNode.data.reasoningLevel,
    });
  }, [providerCapabilities, selectedNode]);

  useEffect(() => {
    if (!selectedNodeId || !selectedNode) {
      return;
    }

    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    const handler = setTimeout(() => {
      try {
        const validated = nodeDataSchema.parse({
          ...selectedNode.data,
          ...localData,
          provider: 'codex',
        });

        const isChanged = Object.keys(validated).some(
          (key) =>
            (validated as Record<string, unknown>)[key]
            !== (selectedNode.data as Record<string, unknown>)[key]
        );

        if (isChanged) {
          updateNodeData(selectedNodeId, validated);
        }
      } catch {
        // Ignore transient invalid form states while the user is typing.
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [localData, selectedNode, selectedNodeId, updateNodeData]);

  if (!selectedNodeId || !selectedNode) {
    return null;
  }

  const codexCapabilities = getCodexCapabilities(providerCapabilities);
  const currentModel = String(
    localData.model ?? selectedNode.data.model ?? getDefaultCodexModel(providerCapabilities)
  ) as ModelId;
  const visibleModels = (codexCapabilities?.models ?? [])
    .filter((model) => model.visibility !== 'hide')
    .map((model) => ({
      id: model.id,
      label: model.displayName,
      description: model.description,
    }));
  const modelOptions = buildModelOptions(currentModel, visibleModels);
  const currentModelCapabilities = getCodexModelById(providerCapabilities, currentModel);
  const currentModelDisplayName = getCodexModelDisplayName(providerCapabilities, currentModel);
  const reasoningOptions = (currentModelCapabilities?.supportedReasoningLevels ?? []).filter(
    (level): level is ReasoningLevel =>
      level === 'low' || level === 'medium' || level === 'high' || level === 'xhigh'
  );
  const isReasoningModel = modelSupportsReasoning(currentModelCapabilities);
  const authState = codexCapabilities?.auth;
  const readiness = getCodexReadinessBadgeState(providerCapabilities, [currentModel]);
  const modelDescription =
    currentModelCapabilities?.description
    ?? modelOptions.find((option) => option.id === currentModel)?.description;
  const providerNote = [
    readiness.summary,
    modelDescription,
    authState
      ? `Auth: ${authState.status}${authState.envVar ? ` via ${authState.envVar}` : ''}.`
      : undefined,
    readiness.detail,
    codexCapabilities?.error ?? authState?.message,
  ]
    .filter(Boolean)
    .join(' ');

  const reviewModeNote =
    executionMode === 'manual'
      ? 'Manual mode pauses every completed node. This checkbox only matters when the workflow returns to Auto.'
      : 'Auto mode continues immediately unless this node explicitly requires review.';

  const statusTone: Record<NodeStatus, string> = {
    idle: 'var(--color-muted)',
    running: 'var(--color-timeline-done)',
    stopping: 'var(--color-timeline-read)',
    completed: 'var(--color-semantic-success)',
    error: 'var(--color-semantic-error)',
    paused: 'var(--color-timeline-edit)',
  };

  return (
    <aside
      className="z-40 flex h-full flex-col overflow-hidden"
      style={{
        width: '300px',
        flexShrink: 0,
        background: 'var(--color-canvas)',
        borderLeft: '1px solid var(--color-hairline)',
      }}
    >
      <div className="h-0.5 w-full flex-shrink-0" style={{ background: '#412991' }} />

      <div
        className="flex h-12 flex-shrink-0 items-center justify-between px-5"
        style={{
          background: 'var(--color-surface-card)',
          borderBottom: '1px solid var(--color-hairline)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md"
            style={{
              background: 'var(--color-canvas)',
              border: '1px solid var(--color-hairline)',
              color: 'var(--color-primary)',
            }}
          >
            <TerminalSquare size={15} />
          </div>
          <span
            className="truncate text-xs font-semibold"
            style={{ color: 'var(--color-ink)', maxWidth: '130px', letterSpacing: '-0.1px' }}
          >
            {localData.label || currentModelDisplayName}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => deleteNode(selectedNodeId)}
            className="rounded-md p-1.5 transition-colors"
            style={{ color: 'var(--color-semantic-error)' }}
            title="Delete Node"
            onMouseEnter={(event) => {
              event.currentTarget.style.background = '#fef2f2';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent';
            }}
          >
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => setSelectedNode(null)}
            className="rounded-md p-1.5 transition-colors"
            style={{ color: 'var(--color-muted)' }}
            title="Close"
            onMouseEnter={(event) => {
              event.currentTarget.style.background = 'var(--color-surface-strong)';
              event.currentTarget.style.color = 'var(--color-ink)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent';
              event.currentTarget.style.color = 'var(--color-muted)';
            }}
          >
            <ArrowRightFromLine size={14} />
          </button>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        style={{ borderTop: '1px solid var(--color-hairline-soft)' }}
      >
        <Section title="Identity">
          <div>
            <label style={LABEL_STYLE}>Node Label</label>
            <Input
              value={localData.label || ''}
              onChange={(event) =>
                setLocalData((prev) => ({ ...prev, label: event.target.value }))
              }
              placeholder={currentModelDisplayName}
            />
          </div>

          <div>
            <label style={LABEL_STYLE}>Provider</label>
            <div style={READONLY_INLINE_STYLE}>Codex</div>
          </div>

          <div>
            <label style={LABEL_STYLE}>Model</label>
            <Select
              value={currentModel}
              onChange={(event) => {
                const nextModel = event.target.value as ModelId;
                const nextModelCapabilities = getCodexModelById(providerCapabilities, nextModel);
                const nextReasoningLevel =
                  !nextModelCapabilities
                    ? localData.reasoningLevel
                    : modelSupportsReasoning(nextModelCapabilities)
                      ? nextModelCapabilities.supportedReasoningLevels.includes(
                          (localData.reasoningLevel ??
                            CODEX_DEFAULT_REASONING_LEVEL) as ReasoningLevel
                        )
                        ? (localData.reasoningLevel ?? CODEX_DEFAULT_REASONING_LEVEL)
                        : (nextModelCapabilities.defaultReasoningLevel as ReasoningLevel | undefined)
                          ?? CODEX_DEFAULT_REASONING_LEVEL
                      : undefined;

                setLocalData((prev) => ({
                  ...prev,
                  model: nextModel,
                  reasoningLevel: nextReasoningLevel,
                }));
              }}
              tone="accent"
            >
              {modelOptions.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </Select>
          </div>

          <div style={MUTED_NOTE_STYLE}>{providerNote}</div>
        </Section>

        <div style={{ height: '1px', background: 'var(--color-hairline-soft)' }} />

        <Section title="Instructions">
          <div>
            <label style={LABEL_STYLE}>Prompt</label>
            <Textarea
              value={localData.prompt || ''}
              onChange={(event) =>
                setLocalData((prev) => ({ ...prev, prompt: event.target.value }))
              }
              placeholder="What should this agent do?"
              font="mono"
              rows={5}
              style={{ resize: 'none' }}
            />
          </div>

          <div>
            <label style={LABEL_STYLE}>
              System Instruction{' '}
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 400,
                  textTransform: 'none',
                  letterSpacing: 0,
                  color: 'var(--color-muted-soft)',
                  marginLeft: '4px',
                }}
              >
                Optional
              </span>
            </label>
            <Textarea
              value={localData.systemInstruction || ''}
              onChange={(event) =>
                setLocalData((prev) => ({
                  ...prev,
                  systemInstruction: event.target.value,
                }))
              }
              placeholder="You are an expert software engineer..."
              font="mono"
              rows={3}
              style={{ resize: 'none' }}
            />
          </div>
        </Section>

        <div style={{ height: '1px', background: 'var(--color-hairline-soft)' }} />

        <Section title="Parameters">
          <div>
            <label style={LABEL_STYLE}>Human Review Checkpoint</label>
            <label
              className="flex items-center gap-2 rounded-md px-3 py-2"
              style={{
                border: '1px solid var(--color-hairline)',
                background: 'var(--color-surface-card)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(localData.humanReview)}
                onChange={(event) =>
                  setLocalData((prev) => ({
                    ...prev,
                    humanReview: event.target.checked,
                  }))
                }
              />
              <span className="text-xs" style={{ color: 'var(--color-ink)' }}>
                Pause after this node when review is required
              </span>
            </label>
            <div className="mt-2" style={MUTED_NOTE_STYLE}>
              {reviewModeNote}
            </div>
          </div>

          {isReasoningModel && reasoningOptions.length > 0 && (
            <div>
              <label style={{ ...LABEL_STYLE, color: 'var(--color-timeline-done)' }}>
                Reasoning Effort
              </label>
              <div
                className="flex gap-1 rounded-lg p-1"
                style={{
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-hairline)',
                }}
              >
                {reasoningOptions.map((level) => {
                  const isActive =
                    (localData.reasoningLevel
                      ?? (currentModelCapabilities?.defaultReasoningLevel as ReasoningLevel | undefined)
                      ?? CODEX_DEFAULT_REASONING_LEVEL) === level;

                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() =>
                        setLocalData((prev) => ({
                          ...prev,
                          reasoningLevel: level,
                        }))
                      }
                      className="flex-1 rounded-md py-2 text-center transition-all"
                      style={{
                        background: isActive ? 'var(--color-timeline-done)' : 'transparent',
                        opacity: isActive ? 1 : 0.7,
                      }}
                    >
                      <div
                        className="text-xs font-semibold"
                        style={{ color: isActive ? '#fff' : 'var(--color-body)' }}
                      >
                        {REASONING_LEVEL_LABELS[level].label}
                      </div>
                      <div
                        className="mt-0.5 text-[9px]"
                        style={{
                          color: isActive
                            ? 'rgba(255,255,255,0.7)'
                            : 'var(--color-muted)',
                        }}
                      >
                        {REASONING_LEVEL_LABELS[level].hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Section>

        <div style={{ height: '1px', background: 'var(--color-hairline-soft)' }} />

        <Section title="Runtime">
          <div>
            <label style={LABEL_STYLE}>Status</label>
            <div
              className="text-xs font-semibold"
              style={{ color: statusTone[nodeStatus], fontFamily: 'var(--font-mono)' }}
            >
              {nodeStatus.toUpperCase()}
            </div>
          </div>

          <div>
            <label style={LABEL_STYLE}>Exit Code</label>
            <div style={READONLY_INLINE_STYLE}>{nodeExitCode ?? 'n/a'}</div>
          </div>

          <div>
            <label style={LABEL_STYLE}>Output File</label>
            <div
              style={{
                ...READONLY_BLOCK_STYLE,
                minHeight: '40px',
                color: nodeOutputPath ? 'var(--color-ink)' : 'var(--color-muted)',
              }}
              title={nodeOutputPath || 'No output written yet'}
            >
              {nodeOutputPath || 'No output written yet'}
            </div>
          </div>

          <div>
            <label style={LABEL_STYLE}>Last Error</label>
            <div
              style={{
                ...READONLY_BLOCK_STYLE,
                minHeight: '64px',
                color: nodeError ? 'var(--color-semantic-error)' : 'var(--color-muted)',
                whiteSpace: 'pre-wrap',
              }}
              title={nodeError || 'No error'}
            >
              {nodeError || 'No error'}
            </div>
          </div>

          {nodeStatus === 'error' && (
            <button
              type="button"
              onClick={() => retryWorkflowFromNode(selectedNodeId)}
              disabled={workflowStatus === 'running' || workflowStatus === 'paused'}
              className="flex w-full items-center justify-center gap-2 rounded-md py-2 transition-colors"
              style={{
                background:
                  workflowStatus === 'running' || workflowStatus === 'paused'
                    ? 'var(--color-canvas-soft)'
                    : 'var(--color-surface-card)',
                border: '1px solid var(--color-hairline)',
                color:
                  workflowStatus === 'running' || workflowStatus === 'paused'
                    ? 'var(--color-muted-soft)'
                    : 'var(--color-primary)',
                cursor:
                  workflowStatus === 'running' || workflowStatus === 'paused'
                    ? 'not-allowed'
                    : 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
              title={nodeError || 'Retry this node and its downstream subtree'}
            >
              <RotateCcw size={13} />
              Retry From This Node
            </button>
          )}

          {nodeStatus === 'paused' && (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => approveReviewNode(selectedNodeId)}
                className="flex items-center justify-center rounded-md py-2 text-xs font-semibold transition-colors"
                style={{
                  background: 'var(--color-timeline-grep)',
                  color: 'var(--color-ink)',
                  border: '1px solid var(--color-hairline)',
                }}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => rerunReviewNode(selectedNodeId)}
                className="flex items-center justify-center rounded-md py-2 text-xs font-semibold transition-colors"
                style={{
                  background: 'var(--color-surface-card)',
                  color: 'var(--color-primary)',
                  border: '1px solid var(--color-hairline)',
                }}
              >
                Rerun
              </button>
              <button
                type="button"
                onClick={() => rejectReviewNode(selectedNodeId)}
                className="flex items-center justify-center rounded-md py-2 text-xs font-semibold transition-colors"
                style={{
                  background: 'var(--color-surface-card)',
                  color: 'var(--color-semantic-error)',
                  border: '1px solid var(--color-hairline)',
                }}
              >
                Reject
              </button>
            </div>
          )}
        </Section>
      </div>
    </aside>
  );
};
