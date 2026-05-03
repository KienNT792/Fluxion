import React, { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  ModelId,
  OPENAI_DEFAULT_MODEL,
  ProviderType,
  getOpenAIModelDisplayName,
} from '@shared';
import { useThemeStore } from '../../stores/theme.store';
import { Tooltip } from '../ui/Tooltip';

import openaiDark from '../../assets/logo/openai-dark.svg';
import openaiLight from '../../assets/logo/openai-light.svg';

interface PresetData {
  provider: ProviderType;
  model: ModelId;
}

const OPENAI_PRESET: PresetData = {
  provider: 'openai',
  model: OPENAI_DEFAULT_MODEL,
};

const AgentIcon: React.FC<{ theme: 'light' | 'dark' }> = ({ theme }) => {
  const isDark = theme === 'dark';
  return <img src={isDark ? openaiDark : openaiLight} alt="OpenAI" className="h-4 w-4" />;
};

export const AgentPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useThemeStore((state) => state.theme);
  const containerRef = useRef<HTMLDivElement>(null);

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
              title="Drag to create an OpenAI workflow node. Requires OPENAI_API_KEY in the app environment."
              onDragStart={(event) => handleDragStart(event, OPENAI_PRESET)}
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
                  {getOpenAIModelDisplayName(OPENAI_DEFAULT_MODEL)}
                </div>
                <div
                  className="truncate text-[11px]"
                  style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  OpenAI MVP node
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
