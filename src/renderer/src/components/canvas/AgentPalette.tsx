import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Plus, X } from 'lucide-react';
import { ModelId, ProviderType } from '@shared';
import { useThemeStore } from '../../stores/theme.store';
import { useWorkflowStore } from '../../stores/workflow.store';
import { Tooltip } from '../ui/Tooltip';

import claudeDark from '../../assets/logo/claude-dark.svg';
import claudeLight from '../../assets/logo/claude-light.svg';
import geminiDark from '../../assets/logo/gemini-dark.svg';
import geminiLight from '../../assets/logo/gemini-light.svg';
import openaiDark from '../../assets/logo/openai-dark.svg';
import openaiLight from '../../assets/logo/openai-light.svg';

interface PresetData {
  provider: ProviderType;
  model: ModelId;
}

interface AgentCard {
  preset: PresetData;
  name: string;
  disabled?: boolean;
  title?: string;
}

const STATIC_AGENTS: AgentCard[] = [
  {
    preset: { provider: 'google', model: 'gemini-1.5-pro' },
    name: 'Gemini 1.5 Pro',
  },
  {
    preset: { provider: 'anthropic', model: 'claude-3-opus' },
    name: 'Claude 3 Opus',
  },
  {
    preset: { provider: 'openai', model: 'o1-preview' },
    name: 'OpenAI o1',
  },
  {
    preset: { provider: 'mock', model: 'mock-agent' },
    name: 'Mock Agent',
  },
];

const AgentIcon: React.FC<{ provider: ProviderType; theme: 'light' | 'dark' }> = ({
  provider,
  theme,
}) => {
  const isDark = theme === 'dark';
  switch (provider) {
    case 'google':
      return <img src={isDark ? geminiDark : geminiLight} alt="Gemini" className="h-4 w-4" />;
    case 'anthropic':
      return <img src={isDark ? claudeDark : claudeLight} alt="Claude" className="h-4 w-4" />;
    case 'openai':
      return <img src={isDark ? openaiDark : openaiLight} alt="OpenAI" className="h-4 w-4" />;
    case 'codex':
      return <Bot size={16} style={{ color: 'var(--color-primary)' }} />;
    default:
      return <Bot size={16} style={{ color: 'var(--color-muted)' }} />;
  }
};

export const AgentPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useThemeStore((state) => state.theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const codexCapabilities = useWorkflowStore((state) => state.codexCapabilities);
  const isCodexCapabilitiesLoading = useWorkflowStore(
    (state) => state.isCodexCapabilitiesLoading
  );
  const hasFetchedCodexCapabilities = useWorkflowStore(
    (state) => state.hasFetchedCodexCapabilities
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const codexAgent = useMemo<AgentCard>(() => {
    const selectableModel = codexCapabilities.models.find((model) => model.visibility === 'list');
    const defaultModel = selectableModel?.id ?? 'gpt-5.5';
    const defaultName = selectableModel?.displayName ?? 'Codex Agent';
    const isUnavailable =
      hasFetchedCodexCapabilities
      && !isCodexCapabilitiesLoading
      && !codexCapabilities.available;

    return {
      preset: { provider: 'codex', model: defaultModel },
      name: isUnavailable ? `${defaultName} (Unavailable)` : defaultName,
      disabled: isUnavailable,
      title: isUnavailable
        ? codexCapabilities.error ?? 'Codex CLI is unavailable.'
        : 'Drag to create a Codex-backed agent node.',
    };
  }, [
    codexCapabilities.available,
    codexCapabilities.error,
    codexCapabilities.models,
    hasFetchedCodexCapabilities,
    isCodexCapabilitiesLoading,
  ]);

  const agents = useMemo(() => [...STATIC_AGENTS, codexAgent], [codexAgent]);

  const handleDragStart = (event: React.DragEvent, preset: PresetData): void => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(preset));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div ref={containerRef} className="relative ml-2 mt-2 pointer-events-auto">
      <Tooltip content={isOpen ? 'Close Agents' : 'Add Agent'} side="right">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors shadow-sm"
          style={{
            background: isOpen ? 'var(--color-surface-strong)' : 'var(--color-surface-card)',
            border: '1px solid var(--color-hairline-strong)',
            color: 'var(--color-ink)',
          }}
          onMouseEnter={(event) => {
            if (!isOpen) {
              event.currentTarget.style.background = 'var(--color-canvas-soft)';
            }
          }}
          onMouseLeave={(event) => {
            if (!isOpen) {
              event.currentTarget.style.background = 'var(--color-surface-card)';
            }
          }}
        >
          {isOpen ? <X size={20} /> : <Plus size={20} />}
        </button>
      </Tooltip>

      {isOpen && (
        <div
          className="animate-in slide-in-from-left-2 absolute left-12 top-0 z-50 w-48 overflow-hidden rounded-xl border fade-in duration-200"
          style={{
            background: 'var(--color-surface-card)',
            borderColor: 'var(--color-hairline-strong)',
          }}
        >
          <div
            className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-widest"
            style={{
              borderColor: 'var(--color-hairline)',
              color: 'var(--color-muted)',
              background: 'var(--color-canvas-soft)',
            }}
          >
            Drag to Canvas
          </div>
          <div className="flex flex-col gap-1 p-1.5">
            {agents.map((agent) => (
              <div
                key={`${agent.preset.provider}:${agent.preset.model}`}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors"
                style={{
                  background: 'transparent',
                  cursor: agent.disabled ? 'not-allowed' : 'grab',
                  opacity: agent.disabled ? 0.55 : 1,
                }}
                onDragStart={(event) => {
                  if (!agent.disabled) {
                    handleDragStart(event, agent.preset);
                  }
                }}
                draggable={!agent.disabled}
                title={agent.title}
                onMouseEnter={(event) => {
                  if (!agent.disabled) {
                    event.currentTarget.style.background = 'var(--color-surface-strong)';
                  }
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = 'transparent';
                }}
              >
                <div className="flex-shrink-0">
                  <AgentIcon provider={agent.preset.provider} theme={theme} />
                </div>
                <div
                  className="truncate text-sm font-medium"
                  style={{ color: 'var(--color-ink)' }}
                >
                  {agent.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
