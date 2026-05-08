import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightFromLine,
  RotateCcw,
  TerminalSquare,
  Trash2,
} from 'lucide-react';
import { z } from 'zod';
import {
  AgentNodeData,
  CODEX_DEFAULT_REASONING_LEVEL,
  CodexApprovalPolicy,
  CodexExecutionOptions,
  CodexSandboxMode,
  CodexWindowsSandbox,
  getNodeCodexApprovalGuardrail,
  getProviderCodexApprovalProtocolStatus,
  ModelId,
  NodeStatus,
  ProviderCapabilitiesMap,
  ReasoningLevel,
  WorkflowNode,
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
import { Button } from '../ui/Button';
import { FilePathCard } from '../ui/FilePathCard';
import { Input } from '../ui/Input';
import { OutputPreview } from '../ui/OutputPreview';
import { Select } from '../ui/Select';
import { StatusChip, StatusChipTone } from '../ui/StatusChip';
import { TextEditorDialog } from '../ui/TextEditorDialog';
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

const codexExecutionOptionsSchema = z
  .object({
    json: z.boolean().optional(),
    sandboxMode: z.enum(['read-only', 'workspace-write', 'danger-full-access']).optional(),
    approvalPolicy: z.enum(['never', 'on-request', 'untrusted']).optional(),
    windowsSandbox: z.enum(['unelevated', 'elevated']).optional(),
    profile: z.string().optional(),
    config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  })
  .optional();

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
    codex: codexExecutionOptionsSchema,
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

interface TextSummary {
  preview: string;
  lineCount: number;
  characterCount: number;
  isEmpty: boolean;
}

interface ModelOption {
  id: string;
  label: string;
  description?: string;
}

interface PropertiesPanelContentProps {
  selectedNodeId: string;
  selectedNode: {
    id: string;
    data: WorkflowNode['data'];
  };
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

function summarizeLongText(value: string | undefined, emptyLabel: string): TextSummary {
  const text = value ?? '';
  const trimmed = text.trim();
  const lines = text ? text.split(/\r\n|\r|\n/) : [];
  const previewLines = lines.slice(0, 5).join('\n').trim();
  const isClipped = lines.length > 5 || previewLines.length < trimmed.length;

  return {
    preview: trimmed ? `${previewLines}${isClipped ? '\n...' : ''}` : emptyLabel,
    lineCount: trimmed ? lines.length : 0,
    characterCount: text.length,
    isEmpty: !trimmed,
  };
}

function buildEditableNodeData(
  selectedNode: PropertiesPanelContentProps['selectedNode'],
  providerCapabilities: ProviderCapabilitiesMap
): Partial<AgentNodeData> {
  return {
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
    codex: selectedNode.data.codex,
  };
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

const PreviewCard: React.FC<{
  summary: TextSummary;
  emptyTone?: boolean;
}> = ({ summary, emptyTone = false }) => (
  <div
    className="rounded-md px-3 py-2"
    style={{
      background: 'var(--color-surface-card)',
      border: '1px solid var(--color-hairline)',
    }}
  >
    <pre
      className="max-h-[120px] overflow-hidden whitespace-pre-wrap text-[11px] leading-5"
      style={{
        color: emptyTone || summary.isEmpty ? 'var(--color-muted)' : 'var(--color-body)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {summary.preview}
    </pre>
    <div
      className="mt-2 text-[10px]"
      style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
    >
      {summary.lineCount} lines / {summary.characterCount} chars
    </div>
  </div>
);

export const PropertiesPanel: React.FC = () => {
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const nodes = useWorkflowStore((state) => state.nodes);
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  if (!selectedNodeId || !selectedNode) {
    return null;
  }

  return (
    <PropertiesPanelContent
      key={selectedNodeId}
      selectedNodeId={selectedNodeId}
      selectedNode={selectedNode}
    />
  );
};

const PropertiesPanelContent: React.FC<PropertiesPanelContentProps> = ({
  selectedNodeId,
  selectedNode,
}) => {
  const setSelectedNode = useWorkflowStore((state) => state.setSelectedNode);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const deleteNode = useWorkflowStore((state) => state.deleteNode);
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities);
  const executionMode = useWorkflowStore((state) => state.executionMode);
  const workspacePath = useWorkflowStore((state) => state.workspacePath);
  const hasFetchedProviderCapabilities = useWorkflowStore(
    (state) => state.hasFetchedProviderCapabilities
  );
  const fetchProviderCapabilities = useWorkflowStore((state) => state.fetchProviderCapabilities);
  const reviewFocusRequest = useWorkflowStore((state) => state.reviewFocusRequest);
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
  const nodeAttemptCount = useExecutionStore((state) =>
    selectedNodeId ? state.nodeAttemptCounts[selectedNodeId] : undefined
  );
  const reviewActionInFlight = useExecutionStore((state) =>
    selectedNodeId ? state.reviewActionInFlightByNodeId[selectedNodeId] : undefined
  );
  const setWorkflowError = useExecutionStore((state) => state.setWorkflowError);
  const workflowStatus = useExecutionStore((state) => state.workflowStatus);

  const [localData, setLocalData] = useState<Partial<AgentNodeData>>(() =>
    buildEditableNodeData(selectedNode, providerCapabilities)
  );
  const [activeTextEditor, setActiveTextEditor] = useState<
    'prompt' | 'systemInstruction' | null
  >(null);
  const skipNextSyncRef = useRef(true);
  const reviewSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasFetchedProviderCapabilities) {
      void fetchProviderCapabilities();
    }
  }, [fetchProviderCapabilities, hasFetchedProviderCapabilities]);

  useEffect(() => {
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

  useEffect(() => {
    if (!selectedNodeId || reviewFocusRequest?.nodeId !== selectedNodeId) {
      return;
    }

    window.requestAnimationFrame(() => {
      reviewSectionRef.current?.scrollIntoView({
        block: 'start',
        behavior: 'smooth',
      });
      reviewSectionRef.current?.focus();
    });
  }, [reviewFocusRequest, selectedNodeId]);

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
  const currentCodexOptions: CodexExecutionOptions = {
    ...(selectedNode.data.codex ?? {}),
    ...(localData.codex ?? {}),
  };
  const currentSandboxMode: CodexSandboxMode =
    currentCodexOptions.sandboxMode ?? 'workspace-write';
  const currentApprovalPolicy: CodexApprovalPolicy =
    currentCodexOptions.approvalPolicy ?? 'never';
  const currentWindowsSandbox = currentCodexOptions.windowsSandbox ?? '';
  const nodeApprovalGuardrail = getNodeCodexApprovalGuardrail(
    {
      id: selectedNodeId,
      label: String(localData.label ?? selectedNode.data.label ?? currentModelDisplayName),
      data: {
        label:
          typeof localData.label === 'string'
            ? localData.label
            : selectedNode.data.label,
        codex: currentCodexOptions,
      },
    },
    {
      approvalProtocolStatus: getProviderCodexApprovalProtocolStatus(providerCapabilities),
    }
  );
  const updateCodexOptions = (nextOptions: Partial<CodexExecutionOptions>): void => {
    setLocalData((prev) => ({
      ...prev,
      codex: {
        ...(selectedNode.data.codex ?? {}),
        ...(prev.codex ?? {}),
        ...nextOptions,
      },
    }));
  };
  const updateWindowsSandbox = (value: string): void => {
    setLocalData((prev) => {
      const nextCodex: CodexExecutionOptions = {
        ...(selectedNode.data.codex ?? {}),
        ...(prev.codex ?? {}),
      };

      if (value) {
        nextCodex.windowsSandbox = value as CodexWindowsSandbox;
      } else {
        delete nextCodex.windowsSandbox;
      }

      return {
        ...prev,
        codex: nextCodex,
      };
    });
  };
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

  const statusTone: Record<NodeStatus, StatusChipTone> = {
    idle: 'idle',
    running: 'running',
    stopping: 'stopping',
    completed: 'completed',
    error: 'error',
    paused: 'paused',
  };
  const promptSummary = summarizeLongText(
    localData.prompt,
    'No prompt configured. Add instructions before running this node.'
  );
  const systemInstructionSummary = summarizeLongText(
    localData.systemInstruction,
    'No node-level override. Workspace/global rules will apply.'
  );
  const nodeStatusLabel =
    nodeStatus === 'completed'
      ? 'Done'
      : nodeStatus.charAt(0).toUpperCase() + nodeStatus.slice(1);
  const isReviewActionPending = Boolean(reviewActionInFlight);
  const reviewActionLabel = {
    approve: reviewActionInFlight === 'approve' ? 'Approving...' : 'Approve',
    rerun: reviewActionInFlight === 'rerun' ? 'Rerunning...' : 'Rerun',
    reject: reviewActionInFlight === 'reject' ? 'Rejecting...' : 'Reject',
  };

  return (
    <>
    <div
      className="flex h-full flex-col overflow-hidden"
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
            style={{ color: 'var(--color-ink)', maxWidth: '220px', letterSpacing: '-0.1px' }}
          >
            {localData.label || currentModelDisplayName}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Delete node"
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
            aria-label="Close node inspector"
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
        <Section title="Overview">
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

          <div style={MUTED_NOTE_STYLE}>{providerNote}</div>
        </Section>

        <div style={{ height: '1px', background: 'var(--color-hairline-soft)' }} />

        <Section title="Instructions">
          <div>
            <label style={LABEL_STYLE}>Prompt</label>
            <PreviewCard summary={promptSummary} />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setActiveTextEditor('prompt')}
            >
              Edit Prompt
            </Button>
          </div>
        </Section>

        <div style={{ height: '1px', background: 'var(--color-hairline-soft)' }} />

        <Section title="Parameters">
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

        <Section title="Codex Permissions">
          <div>
            <label style={LABEL_STYLE}>Sandbox Mode</label>
            <Select
              value={currentSandboxMode}
              onChange={(event) =>
                updateCodexOptions({
                  sandboxMode: event.target.value as CodexSandboxMode,
                })
              }
            >
              <option value="read-only">read-only</option>
              <option value="workspace-write">workspace-write</option>
              <option value="danger-full-access">danger-full-access</option>
            </Select>
          </div>

          <div>
            <label style={LABEL_STYLE}>Approval Policy</label>
            <Select
              value={currentApprovalPolicy}
              onChange={(event) =>
                updateCodexOptions({
                  approvalPolicy: event.target.value as CodexApprovalPolicy,
                })
              }
              invalid={nodeApprovalGuardrail.severity === 'blocked'}
            >
              <option value="never">never</option>
              <option value="on-request">on-request</option>
              <option value="untrusted">untrusted</option>
            </Select>
          </div>

          <div>
            <label style={LABEL_STYLE}>Windows Sandbox</label>
            <Select
              value={currentWindowsSandbox}
              onChange={(event) => updateWindowsSandbox(event.target.value)}
            >
              <option value="">Default</option>
              <option value="unelevated">unelevated</option>
              <option value="elevated">elevated</option>
            </Select>
          </div>

          {nodeApprovalGuardrail.severity !== 'ok' && (
            <div
              className="rounded-md px-3 py-2"
              style={{
                background: 'var(--color-surface-card)',
                border:
                  nodeApprovalGuardrail.severity === 'blocked'
                    ? '1px solid var(--color-semantic-error)'
                    : '1px solid var(--color-timeline-done)',
              }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={15}
                  className="mt-0.5 shrink-0"
                  style={{
                    color:
                      nodeApprovalGuardrail.severity === 'blocked'
                        ? 'var(--color-semantic-error)'
                        : 'var(--color-timeline-done)',
                  }}
                />
                <div className="min-w-0">
                  {nodeApprovalGuardrail.severity === 'blocked' && (
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
                      Interactive Codex approval requires a supported Phase 2A protocol probe.
                      Set approval policy to never to run this workflow.
                    </p>
                  )}
                  <p
                    className={`${nodeApprovalGuardrail.severity === 'blocked' ? 'mt-2' : ''} text-xs leading-5`}
                    style={{ color: 'var(--color-body)' }}
                  >
                    {nodeApprovalGuardrail.message}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Section>

        <div style={{ height: '1px', background: 'var(--color-hairline-soft)' }} />

        {nodeStatus === 'paused' && (
          <>
            <div ref={reviewSectionRef} tabIndex={-1}>
              <Section title="Review">
                <div
                  className="rounded-md px-3 py-2"
                  style={{
                    background: 'var(--color-surface-card)',
                    border: '1px solid var(--color-hairline)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusChip
                      tone="paused"
                      label={
                        reviewActionInFlight === 'rerun'
                          ? 'Rerunning'
                          : 'Awaiting Review'
                      }
                      animate={reviewActionInFlight === 'rerun'}
                    />
                    <span
                      className="text-[10px]"
                      style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                    >
                      attempt {nodeAttemptCount ?? 1}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
                    Review the latest output, then approve to continue, rerun this node, or reject
                    the workflow.
                  </p>
                </div>

                <OutputPreview
                  workspacePath={workspacePath}
                  path={nodeOutputPath}
                  attemptCount={nodeAttemptCount}
                  onError={setWorkflowError}
                />

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => void approveReviewNode(selectedNodeId)}
                    disabled={isReviewActionPending}
                    className="flex items-center justify-center rounded-md py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                    style={{
                      background: 'var(--color-timeline-grep)',
                      color: 'var(--color-ink)',
                      border: '1px solid var(--color-hairline)',
                      opacity: isReviewActionPending && reviewActionInFlight !== 'approve' ? 0.55 : 1,
                    }}
                  >
                    {reviewActionLabel.approve}
                  </button>
                  <button
                    type="button"
                    onClick={() => void rerunReviewNode(selectedNodeId)}
                    disabled={isReviewActionPending}
                    className="flex items-center justify-center rounded-md py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                    style={{
                      background: 'var(--color-surface-card)',
                      color: 'var(--color-primary)',
                      border: '1px solid var(--color-hairline)',
                      opacity: isReviewActionPending && reviewActionInFlight !== 'rerun' ? 0.55 : 1,
                    }}
                  >
                    {reviewActionLabel.rerun}
                  </button>
                  <button
                    type="button"
                    onClick={() => void rejectReviewNode(selectedNodeId)}
                    disabled={isReviewActionPending}
                    className="flex items-center justify-center rounded-md py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                    style={{
                      background: 'var(--color-surface-card)',
                      color: 'var(--color-semantic-error)',
                      border: '1px solid var(--color-hairline)',
                      opacity: isReviewActionPending && reviewActionInFlight !== 'reject' ? 0.55 : 1,
                    }}
                  >
                    {reviewActionLabel.reject}
                  </button>
                </div>
              </Section>
            </div>

            <div style={{ height: '1px', background: 'var(--color-hairline-soft)' }} />
          </>
        )}

        <Section title="Runtime">
          <div>
            <label style={LABEL_STYLE}>Status</label>
            <StatusChip
              tone={statusTone[nodeStatus]}
              label={nodeStatusLabel}
              animate={nodeStatus === 'running' || nodeStatus === 'stopping'}
            />
          </div>

          <div>
            <label style={LABEL_STYLE}>Exit Code</label>
            <div style={READONLY_INLINE_STYLE}>{nodeExitCode ?? 'n/a'}</div>
          </div>

          <div>
            <label style={LABEL_STYLE}>Output File</label>
            <FilePathCard
              path={nodeOutputPath}
              onError={setWorkflowError}
            />
          </div>

          {nodeStatus !== 'paused' && (
            <div>
              <label style={LABEL_STYLE}>Output Preview</label>
              <OutputPreview
                workspacePath={workspacePath}
                path={nodeOutputPath}
                attemptCount={nodeAttemptCount}
                onError={setWorkflowError}
              />
            </div>
          )}

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
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => retryWorkflowFromNode(selectedNodeId)}
              disabled={
                workflowStatus === 'running'
                || workflowStatus === 'stopping'
                || workflowStatus === 'paused'
              }
              className="w-full"
              title={nodeError || 'Retry this node and its downstream subtree'}
            >
              <RotateCcw size={13} />
              Retry From This Node
            </Button>
          )}

        </Section>

        <div style={{ height: '1px', background: 'var(--color-hairline-soft)' }} />

        <Section title="Advanced">
          <div>
            <label style={LABEL_STYLE}>
              Node System Override{' '}
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
            <PreviewCard summary={systemInstructionSummary} emptyTone />
            <div className="mt-2" style={MUTED_NOTE_STYLE}>
              Workspace/global rules stay in Fluxion context. This field only overrides the
              selected node.
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setActiveTextEditor('systemInstruction')}
            >
              Edit Override
            </Button>
          </div>
        </Section>
      </div>
    </div>

    <TextEditorDialog
      isOpen={activeTextEditor === 'prompt'}
      title="Edit Prompt"
      helperText="Use the full editor for long node instructions. Save applies the change to this node."
      value={String(localData.prompt ?? '')}
      defaultValue=""
      placeholder="What should this agent do?"
      showReset
      onSave={(value) => {
        setLocalData((prev) => ({ ...prev, prompt: value }));
        setActiveTextEditor(null);
      }}
      onCancel={() => setActiveTextEditor(null)}
    />

    <TextEditorDialog
      isOpen={activeTextEditor === 'systemInstruction'}
      title="Node System Override"
      helperText="Workspace/global rules remain the default. This override is only for the selected node."
      value={String(localData.systemInstruction ?? '')}
      defaultValue=""
      placeholder="You are an expert software engineer..."
      showReset
      onSave={(value) => {
        setLocalData((prev) => ({ ...prev, systemInstruction: value }));
        setActiveTextEditor(null);
      }}
      onCancel={() => setActiveTextEditor(null)}
    />
    </>
  );
};
