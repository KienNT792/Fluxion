import React, { useEffect, useRef, useState } from 'react';
import { Plus, TerminalSquare, X } from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflow.store';
import { Tooltip } from '../ui/Tooltip';
import {
  getCodexCapabilities,
  getCodexModelDisplayName,
  getDefaultCodexModel,
} from '../../lib/provider-capabilities';

export const AgentPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
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

  const codexCapabilities = getCodexCapabilities(providerCapabilities);
  const paletteModel = getDefaultCodexModel(providerCapabilities);
  const paletteHint =
    codexCapabilities?.available && codexCapabilities.auth.status === 'authenticated'
      ? getCodexModelDisplayName(providerCapabilities, paletteModel)
      : codexCapabilities?.error
        ?? codexCapabilities?.auth.message
        ?? 'Codex CLI unavailable';

  const handleDragStart = (event: React.DragEvent): void => {
    event.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({
        provider: 'codex',
        model: paletteModel,
      })
    );
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div ref={containerRef} className="pointer-events-auto relative ml-2 mt-2">
      <Tooltip content={isOpen ? 'Close Agent' : 'Add Codex Agent'} side="right">
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
              title={paletteHint}
              onDragStart={handleDragStart}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = 'var(--color-surface-strong)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent';
              }}
            >
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
                style={{
                  background: 'var(--color-canvas-soft)',
                  border: '1px solid var(--color-hairline)',
                  color: 'var(--color-primary)',
                }}
              >
                <TerminalSquare size={15} />
              </div>
              <div className="min-w-0">
                <div
                  className="truncate text-sm font-medium"
                  style={{ color: 'var(--color-ink)' }}
                >
                  Codex
                </div>
                <div
                  className="truncate text-[11px]"
                  style={{
                    color:
                      codexCapabilities?.available && codexCapabilities.auth.status === 'authenticated'
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
