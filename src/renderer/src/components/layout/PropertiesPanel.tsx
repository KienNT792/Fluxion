import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightFromLine, Bot, RotateCcw, Trash2 } from 'lucide-react';
import { z } from 'zod';
import {
  AgentNodeData,
  ModelId,
  NodeStatus,
  ProviderModel,
  ProviderType,
} from '@shared';
import { retryWorkflowFromNode } from '../../lib/workflow-session';
import { useExecutionStore } from '../../stores/execution.store';
import { useThemeStore } from '../../stores/theme.store';
import { useWorkflowStore } from '../../stores/workflow.store';

import claudeDark from '../../assets/logo/claude-dark.svg';
import claudeLight from '../../assets/logo/claude-light.svg';
import geminiDark from '../../assets/logo/gemini-dark.svg';
import geminiLight from '../../assets/logo/gemini-light.svg';
import openaiDark from '../../assets/logo/openai-dark.svg';
import openaiLight from '../../assets/logo/openai-light.svg';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { getFormControlStyle } from '../ui/form-control';

interface StaticModelOption {
  id: string;
  label: string;
  description?: string;
}

interface ModelOption extends StaticModelOption {
  metadata?: string;
}

const PROVIDERS = [
  { id: 'google', label: 'Google (Gemini)' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'codex', label: 'Codex' },
  { id: 'mock', label: 'Mock' },
] as const;

const STATIC_MODEL_OPTIONS: Record<Exclude<ProviderType, 'codex'>, StaticModelOption[]> = {
  google: [
    {
      id: 'gemini-1.5-pro',
      label: 'Gemini 1.5 Pro',
      description: 'High-capability Gemini preset.',
    },
    {
      id: 'gemini-1.5-flash',
      label: 'Gemini 1.5 Flash',
      description: 'Fast Gemini preset.',
    },
    {
      id: 'gemini-exp-1206',
      label: 'Gemini Exp (Reasoning)',
      description: 'Reasoning-style Gemini preset.',
    },
  ],
  openai: [
    {
      id: 'gpt-4o',
      label: 'GPT-4o',
      description: 'General-purpose OpenAI preset.',
    },
    {
      id: 'o1-preview',
      label: 'o1 Preview (Reasoning)',
      description: 'Reasoning-style OpenAI preset.',
    },
    {
      id: 'o1-mini',
      label: 'o1 Mini (Reasoning)',
      description: 'Smaller reasoning-style OpenAI preset.',
    },
  ],
  anthropic: [
    {
      id: 'claude-3-opus',
      label: 'Claude 3 Opus',
      description: 'High-capability Claude preset.',
    },
    {
      id: 'claude-3-5-sonnet',
      label: 'Claude 3.5 Sonnet',
      description: 'Balanced Claude preset.',
    },
  ],
  mock: [
    {
      id: 'mock-agent',
      label: 'Mock Agent',
      description: 'Local mock adapter for workflow testing.',
    },
  ],
};

const STATIC_MODEL_NAMES: Record<string, string> = {
  'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
  'claude-3-opus': 'Claude 3 Opus',
  'codex-mini': 'Codex Mini',
  'gemini-1.5-flash': 'Gemini 1.5 Flash',
  'gemini-1.5-pro': 'Gemini 1.5 Pro',
  'gemini-exp-1206': 'Gemini Exp 1206',
  'gpt-4o': 'GPT-4o',
  'mock-agent': 'Mock Agent',
  'o1-mini': 'o1 Mini',
  'o1-preview': 'o1 Preview',
  'o4-mini': 'o4 Mini',
};

const STATIC_REASONING_MODELS = new Set(['gemini-exp-1206', 'o1-preview', 'o1-mini']);
const REASONING_LEVEL_OPTIONS = [
  { value: 'low', label: 'Low', hint: 'Fast' },
  { value: 'medium', label: 'Med', hint: 'Balanced' },
  { value: 'high', label: 'High', hint: 'Deep' },
  { value: 'xhigh', label: 'XHigh', hint: 'Max' },
] as const;

const nodeDataSchema = z.object({
  provider: z.enum(['google', 'openai', 'anthropic', 'codex', 'mock']),
  model: z.string().min(1),
  label: z.string().optional(),
  prompt: z.string(),
  systemInstruction: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  reasoningLevel: z.enum(['low', 'medium', 'high', 'xhigh']).optional(),
});

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

const getAgentIcon = (provider: ProviderType, theme: 'light' | 'dark'): React.JSX.Element => {
  const isDark = theme === 'dark';
  switch (provider) {
    case 'google':
      return <img src={isDark ? geminiDark : geminiLight} alt="Google" className="h-6 w-6" />;
    case 'anthropic':
      return <img src={isDark ? claudeDark : claudeLight} alt="Anthropic" className="h-6 w-6" />;
    case 'openai':
      return <img src={isDark ? openaiDark : openaiLight} alt="OpenAI" className="h-6 w-6" />;
    case 'codex':
      return <Bot size={24} style={{ color: 'var(--color-primary)' }} />;
    default:
      return <Bot size={24} style={{ color: 'var(--color-muted)' }} />;
  }
};

function getStaticModelName(model: string): string {
  return STATIC_MODEL_NAMES[model] ?? model;
}

function getCodexModelById(models: ProviderModel[], modelId: string): ProviderModel | undefined {
  return models.find((model) => model.id === modelId);
}

function getSelectableCodexModels(models: ProviderModel[]): ProviderModel[] {
  return models.filter((model) => model.visibility === 'list');
}

function getModelDisplayName(
  provider: ProviderType,
  model: string,
  codexModels: ProviderModel[]
): string {
  if (provider === 'codex') {
    return getCodexModelById(codexModels, model)?.displayName ?? getStaticModelName(model);
  }

  return getStaticModelName(model);
}

function getFirstModelForProvider(
  provider: ProviderType,
  codexModels: ProviderModel[]
): string {
  if (provider === 'codex') {
    return getSelectableCodexModels(codexModels)[0]?.id ?? 'gpt-5.5';
  }

  return STATIC_MODEL_OPTIONS[provider][0]?.id ?? 'mock-agent';
}

function formatTokenCount(tokenCount?: number): string {
  if (typeof tokenCount !== 'number' || !Number.isFinite(tokenCount)) {
    return 'n/a';
  }

  return `${new Intl.NumberFormat().format(tokenCount)} tokens`;
}

function formatModalities(inputModalities?: string[]): string {
  if (!inputModalities || inputModalities.length === 0) {
    return 'n/a';
  }

  return inputModalities.join(', ');
}

function buildCodexModelOptions(
  codexModels: ProviderModel[],
  currentModel: string
): ModelOption[] {
  const selectableModels = getSelectableCodexModels(codexModels).map((model) => ({
    id: model.id,
    label: model.displayName,
    description: model.description,
    metadata: model.contextWindow ? formatTokenCount(model.contextWindow) : undefined,
  }));

  if (!currentModel) {
    return selectableModels;
  }

  const hasCurrentModel = selectableModels.some((model) => model.id === currentModel);
  if (hasCurrentModel) {
    return selectableModels;
  }

  const currentCodexModel = getCodexModelById(codexModels, currentModel);
  return [
    ...selectableModels,
    {
      id: currentModel,
      label: currentCodexModel?.displayName ?? getStaticModelName(currentModel),
      description:
        currentCodexModel?.visibility === 'hide'
          ? 'Hidden Codex model'
          : 'Legacy or custom model',
      metadata: currentCodexModel?.contextWindow
        ? formatTokenCount(currentCodexModel.contextWindow)
        : undefined,
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
  const codexCapabilities = useWorkflowStore((state) => state.codexCapabilities);
  const isCodexCapabilitiesLoading = useWorkflowStore(
    (state) => state.isCodexCapabilitiesLoading
  );
  const hasFetchedCodexCapabilities = useWorkflowStore(
    (state) => state.hasFetchedCodexCapabilities
  );
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
    if (selectedNode) {
      skipNextSyncRef.current = true;
      setLocalData({
        provider: selectedNode.data.provider,
        model: selectedNode.data.model,
        label: selectedNode.data.label,
        prompt: selectedNode.data.prompt,
        systemInstruction: selectedNode.data.systemInstruction,
        maxTokens: selectedNode.data.maxTokens ?? 2048,
        temperature: selectedNode.data.temperature ?? 0.7,
        reasoningLevel: selectedNode.data.reasoningLevel,
      });
      return;
    }

    setLocalData({});
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

  const currentProvider = (localData.provider ?? selectedNode.data.provider) as ProviderType;
  const currentModel = String(localData.model ?? selectedNode.data.model) as ModelId;
  const isCodexProvider = currentProvider === 'codex';
  const codexModels = codexCapabilities.models;
  const currentCodexModel = isCodexProvider
    ? getCodexModelById(codexModels, currentModel)
    : undefined;
  const currentModelDisplayName = getModelDisplayName(
    currentProvider,
    currentModel,
    codexModels
  );
  const modelOptions: ModelOption[] = isCodexProvider
    ? buildCodexModelOptions(codexModels, currentModel)
    : STATIC_MODEL_OPTIONS[currentProvider].map((model) => ({ ...model }));
  const isStaticReasoningModel =
    !isCodexProvider && STATIC_REASONING_MODELS.has(currentModel);
  const codexDiscoveryError =
    hasFetchedCodexCapabilities
    && !isCodexCapabilitiesLoading
    && !codexCapabilities.available
      ? codexCapabilities.error ?? 'Codex CLI is unavailable.'
      : undefined;
  const codexModelDescription =
    currentCodexModel?.description
    ?? modelOptions.find((option) => option.id === currentModel)?.description;

  const handleProviderChange = (newProvider: ProviderType): void => {
    const nextModel = getFirstModelForProvider(newProvider, codexModels);
    setLocalData((prev) => ({
      ...prev,
      provider: newProvider,
      model: nextModel,
    }));
  };

  const accentColor =
    {
      anthropic: '#D97757',
      codex: '#f54e00',
      google: '#4285F4',
      mock: 'var(--color-hairline-strong)',
      openai: '#412991',
    }[currentProvider] ?? 'var(--color-hairline-strong)';

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
      <div className="h-0.5 w-full flex-shrink-0" style={{ background: accentColor }} />

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
            {getAgentIcon(currentProvider, theme)}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={LABEL_STYLE}>Provider</label>
              <Select
                value={currentProvider}
                onChange={(event) =>
                  handleProviderChange(event.target.value as ProviderType)
                }
              >
                {PROVIDERS.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label style={LABEL_STYLE}>Model</label>
              <Select
                value={currentModel}
                onChange={(event) =>
                  setLocalData((prev) => ({ ...prev, model: event.target.value as ModelId }))
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
          </div>

          {isCodexProvider && (
            <div style={MUTED_NOTE_STYLE}>
              {isCodexCapabilitiesLoading
                ? 'Loading Codex capabilities...'
                : codexDiscoveryError
                  ? codexDiscoveryError
                  : codexModelDescription
                    ? codexModelDescription
                    : 'Codex model metadata is available through local CLI discovery.'}
              {modelOptions.find((option) => option.id === currentModel)?.metadata
                ? ` (${modelOptions.find((option) => option.id === currentModel)?.metadata})`
                : ''}
            </div>
          )}
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
          {isCodexProvider ? (
            <div className="space-y-3">
              <div
                style={{
                  ...READONLY_BLOCK_STYLE,
                  minHeight: '64px',
                  color: codexDiscoveryError
                    ? 'var(--color-semantic-error)'
                    : 'var(--color-muted)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {codexDiscoveryError
                  ?? 'Fluxion currently passes only --model to Codex CLI. Capability metadata is shown read-only until a verified runtime mapping exists.'}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={LABEL_STYLE}>Context Window</label>
                  <div style={READONLY_INLINE_STYLE}>
                    {formatTokenCount(currentCodexModel?.contextWindow)}
                  </div>
                </div>

                <div>
                  <label style={LABEL_STYLE}>Visibility</label>
                  <div style={READONLY_INLINE_STYLE}>
                    {currentCodexModel?.visibility ?? 'n/a'}
                  </div>
                </div>
              </div>

              <div>
                <label style={LABEL_STYLE}>Input Modalities</label>
                <div style={READONLY_BLOCK_STYLE}>
                  {formatModalities(currentCodexModel?.inputModalities)}
                </div>
              </div>

              <div>
                <label style={LABEL_STYLE}>Reasoning Levels</label>
                <div style={READONLY_BLOCK_STYLE}>
                  {currentCodexModel?.supportedReasoningLevels.length
                    ? currentCodexModel.supportedReasoningLevels.join(', ')
                    : 'n/a'}
                </div>
              </div>
            </div>
          ) : isStaticReasoningModel ? (
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
                  const isActive = (localData.reasoningLevel ?? 'medium') === level.value;
                  return (
                    <button
                      key={level.value}
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
                  {(localData.temperature ?? 0.7).toFixed(1)}
                </span>
              </label>
              <input
                type="range"
                step="0.1"
                min="0"
                max="2"
                value={localData.temperature ?? 0.7}
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

          {!isCodexProvider && (
            <div>
              <label style={LABEL_STYLE}>Max Tokens</label>
              <Input
                type="number"
                value={localData.maxTokens ?? ''}
                onChange={(event) =>
                  setLocalData((prev) => ({
                    ...prev,
                    maxTokens: parseInt(event.target.value, 10) || 0,
                  }))
                }
                font="mono"
              />
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
