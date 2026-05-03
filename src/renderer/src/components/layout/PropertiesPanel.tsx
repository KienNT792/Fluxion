import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightFromLine, RotateCcw, Trash2 } from 'lucide-react';
import { z } from 'zod';
import {
  AgentNodeData,
  ModelId,
  NodeStatus,
  OPENAI_DEFAULT_MODEL,
  OPENAI_DEFAULT_REASONING_LEVEL,
  OPENAI_MVP_MODELS,
  getOpenAIModelDisplayName,
  getOpenAIModelPreset,
  isOpenAIReasoningModel,
} from '@shared';
import { retryWorkflowFromNode } from '../../lib/workflow-session';
import { useExecutionStore } from '../../stores/execution.store';
import { useThemeStore } from '../../stores/theme.store';
import { useWorkflowStore } from '../../stores/workflow.store';

import openaiDark from '../../assets/logo/openai-dark.svg';
import openaiLight from '../../assets/logo/openai-light.svg';
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

const nodeDataSchema = z.object({
  provider: z.literal('openai'),
  model: z.string().min(1),
  label: z.string().optional(),
  prompt: z.string(),
  systemInstruction: z.string().optional(),
  maxTokens: z.preprocess(coerceOptionalPositiveInteger, z.number().optional()),
  temperature: z.preprocess(
    (value) => coerceNumber(value, 0.7),
    z.number().min(0).max(2).optional()
  ),
  reasoningLevel: z.enum(['low', 'medium', 'high', 'xhigh']).optional(),
});

const REASONING_LEVEL_OPTIONS = [
  { value: 'low', label: 'Low', hint: 'Fast' },
  { value: 'medium', label: 'Med', hint: 'Balanced' },
  { value: 'high', label: 'High', hint: 'Deep' },
  { value: 'xhigh', label: 'XHigh', hint: 'Max' },
] as const;

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

function buildModelOptions(currentModel: string) {
  const options = OPENAI_MVP_MODELS.map((model) => ({
    id: model.id,
    label: model.displayName,
    description: model.description,
  }));

  if (!currentModel || options.some((model) => model.id === currentModel)) {
    return options;
  }

  return [
    ...options,
    {
      id: currentModel,
      label: getOpenAIModelDisplayName(currentModel),
      description: 'Custom OpenAI model from an older workflow.',
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
  const theme = useThemeStore((state) => state.theme);
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const setSelectedNode = useWorkflowStore((state) => state.setSelectedNode);
  const nodes = useWorkflowStore((state) => state.nodes);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const deleteNode = useWorkflowStore((state) => state.deleteNode);
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities);
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
      provider: 'openai',
      model:
        typeof selectedNode.data.model === 'string' && selectedNode.data.model.trim()
          ? selectedNode.data.model
          : OPENAI_DEFAULT_MODEL,
      label: selectedNode.data.label,
      prompt: typeof selectedNode.data.prompt === 'string' ? selectedNode.data.prompt : '',
      systemInstruction:
        typeof selectedNode.data.systemInstruction === 'string'
          ? selectedNode.data.systemInstruction
          : '',
      maxTokens: coerceOptionalPositiveInteger(selectedNode.data.maxTokens) ?? 2048,
      temperature: coerceNumber(selectedNode.data.temperature, 0.7),
      reasoningLevel: selectedNode.data.reasoningLevel,
    });
  }, [selectedNode]);

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
          provider: 'openai',
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

  const currentModel = String(localData.model ?? selectedNode.data.model) as ModelId;
  const modelOptions = buildModelOptions(currentModel);
  const currentModelDisplayName = getOpenAIModelDisplayName(currentModel);
  const isReasoningModel = isOpenAIReasoningModel(currentModel);
  const modelDescription =
    getOpenAIModelPreset(currentModel)?.description
    ?? modelOptions.find((option) => option.id === currentModel)?.description;
  const authState = providerCapabilities.openai?.auth;
  const providerNote = [
    modelDescription ?? 'OpenAI workflow node.',
    providerCapabilities.openai?.version
      ? `Version: ${providerCapabilities.openai.version}.`
      : undefined,
    authState
      ? `Auth: ${authState.status}${authState.envVar ? ` via ${authState.envVar}` : ''}.`
      : undefined,
    providerCapabilities.openai?.error ?? authState?.message,
  ]
    .filter(Boolean)
    .join(' ');
  const currentTemperature = coerceNumber(localData.temperature, 0.7);
  const currentMaxTokens = coerceOptionalPositiveInteger(localData.maxTokens) ?? 2048;

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
            }}
          >
            <img
              src={theme === 'dark' ? openaiDark : openaiLight}
              alt="OpenAI"
              className="h-5 w-5"
            />
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
            <div style={READONLY_INLINE_STYLE}>OpenAI</div>
          </div>

          <div>
            <label style={LABEL_STYLE}>Model</label>
            <Select
              value={currentModel}
              onChange={(event) =>
                setLocalData((prev) => ({
                  ...prev,
                  model: event.target.value as ModelId,
                  reasoningLevel: isOpenAIReasoningModel(event.target.value)
                    ? prev.reasoningLevel ?? OPENAI_DEFAULT_REASONING_LEVEL
                    : undefined,
                }))
              }
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
          {isReasoningModel ? (
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
                {REASONING_LEVEL_OPTIONS.map((level) => {
                  const isActive =
                    (localData.reasoningLevel ?? OPENAI_DEFAULT_REASONING_LEVEL) === level.value;

                  return (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() =>
                        setLocalData((prev) => ({
                          ...prev,
                          reasoningLevel: level.value,
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
                        {level.label}
                      </div>
                      <div
                        className="mt-0.5 text-[9px]"
                        style={{
                          color: isActive
                            ? 'rgba(255,255,255,0.7)'
                            : 'var(--color-muted)',
                        }}
                      >
                        {level.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <label style={LABEL_STYLE}>
                Temperature
                <span
                  style={{
                    float: 'right',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 400,
                    letterSpacing: 0,
                    textTransform: 'none',
                    color: 'var(--color-primary)',
                  }}
                >
                  {currentTemperature.toFixed(1)}
                </span>
              </label>
              <input
                type="range"
                step="0.1"
                min="0"
                max="2"
                value={currentTemperature}
                onChange={(event) =>
                  setLocalData((prev) => ({
                    ...prev,
                    temperature: parseFloat(event.target.value),
                  }))
                }
                className="w-full"
                style={{ accentColor: 'var(--color-primary)' }}
              />
            </div>
          )}

          <div>
            <label style={LABEL_STYLE}>Max Tokens</label>
            <Input
              type="number"
              value={currentMaxTokens}
              onChange={(event) =>
                setLocalData((prev) => ({
                  ...prev,
                  maxTokens: parseInt(event.target.value, 10) || 0,
                }))
              }
              font="mono"
            />
          </div>
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
              disabled={workflowStatus === 'running'}
              className="flex w-full items-center justify-center gap-2 rounded-md py-2 transition-colors"
              style={{
                background:
                  workflowStatus === 'running'
                    ? 'var(--color-canvas-soft)'
                    : 'var(--color-surface-card)',
                border: '1px solid var(--color-hairline)',
                color:
                  workflowStatus === 'running'
                    ? 'var(--color-muted-soft)'
                    : 'var(--color-primary)',
                cursor: workflowStatus === 'running' ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
              title={nodeError || 'Retry this node and its downstream subtree'}
            >
              <RotateCcw size={13} />
              Retry From This Node
            </button>
          )}
        </Section>
      </div>
    </aside>
  );
};
