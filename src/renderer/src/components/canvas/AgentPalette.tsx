import React, { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { OPENAI_DEFAULT_MODEL, getOpenAIModelDisplayName } from '@shared';
import { useThemeStore } from '../../stores/theme.store';
import { useWorkflowStore } from '../../stores/workflow.store';
import { Tooltip } from '../ui/Tooltip';

import openaiDark from '../../assets/logo/openai-dark.svg';
import openaiLight from '../../assets/logo/openai-light.svg';

const AgentIcon: React.FC<{ theme: 'light' | 'dark' }> = ({ theme }) => {
  const isDark = theme === 'dark';
  return <img src={isDark ? openaiDark : openaiLight} alt="OpenAI" className="h-4 w-4" />;
};

export const AgentPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useThemeStore((state) => state.theme);
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities);
  const hasFetchedProviderCapabilities = useWorkflowStore(
    (state) => state.hasFetchedProviderCapabilities
  );
  const fetchProviderCapabilities = useWorkflowStore((state) => state.fetchProviderCapabilities);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasFetchedProviderCapabilities) {
      void fetchProviderCapabilities();
    }
  }, [fetchProviderCapabilities, hasFetchedProviderCapabilities]);

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

  const handleDragStart = (event: React.DragEvent): void => {
    const model =
      providerCapabilities.openai?.defaultModel
      ?? providerCapabilities.openai?.models.find((item) => item.visibility === 'list')?.id
      ?? providerCapabilities.openai?.models[0]?.id
      ?? OPENAI_DEFAULT_MODEL;

    event.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({
        provider: 'openai',
        model,
      })
    );
    event.dataTransfer.effectAllowed = 'move';
  };

  const paletteModel =
    providerCapabilities.openai?.defaultModel
    ?? providerCapabilities.openai?.models.find((item) => item.visibility === 'list')?.id
    ?? providerCapabilities.openai?.models[0]?.id
    ?? OPENAI_DEFAULT_MODEL;
  const paletteHint =
    providerCapabilities.openai?.auth.status === 'authenticated'
      ? getOpenAIModelDisplayName(paletteModel)
      : providerCapabilities.openai?.auth.message ?? 'OPENAI_API_KEY missing';

  return (
    <div ref={containerRef} className="relative ml-2 mt-2 pointer-events-auto">
      <Tooltip content={isOpen ? 'Close Agent' : 'Add OpenAI Agent'} side="right">
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
          className="animate-in slide-in-from-left-2 absolute left-12 top-0 z-50 w-52 overflow-hidden rounded-xl border fade-in duration-200"
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
            <div
              className="flex cursor-grab items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors"
              style={{ background: 'transparent' }}
              draggable
              title={providerCapabilities.openai?.auth.message ?? 'Drag to create an OpenAI workflow node.'}
              onDragStart={handleDragStart}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = 'var(--color-surface-strong)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent';
              }}
            >
              <div className="flex-shrink-0">
                <AgentIcon theme={theme} />
              </div>
              <div className="min-w-0">
                <div
                  className="truncate text-sm font-medium"
                  style={{ color: 'var(--color-ink)' }}
                >
                  OpenAI
                </div>
                <div
                  className="truncate text-[11px]"
                  style={{
                    color:
                      providerCapabilities.openai?.auth.status === 'authenticated'
                        ? 'var(--color-muted)'
                        : 'var(--color-semantic-error)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {paletteHint}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
