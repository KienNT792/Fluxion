import React from 'react'
import { Button } from '@renderer/components/ui/Button'
import { StatusChip, StatusChipTone } from '@renderer/components/ui/StatusChip'
import { POPOVER_SURFACE_STYLE } from '../lib/topbar-styles'

interface CodexReadinessView {
  catalogSource?: string
  detail: string
  label: string
  summary: string
}

interface CodexReadinessPopoverProps {
  codexReadiness: CodexReadinessView
  disabled: boolean
  isLoading: boolean
  isOpen: boolean
  onRefresh: () => void
  onToggle: () => void
  readinessPopoverRef: React.RefObject<HTMLDivElement | null>
  readinessTone: StatusChipTone
}

export const CodexReadinessPopover: React.FC<CodexReadinessPopoverProps> = ({
  codexReadiness,
  disabled,
  isLoading,
  isOpen,
  onRefresh,
  onToggle,
  readinessPopoverRef,
  readinessTone
}) => (
  <div className="relative" ref={readinessPopoverRef}>
    <button
      type="button"
      aria-label={`Codex readiness: ${codexReadiness.label}`}
      aria-expanded={isOpen}
      onClick={onToggle}
      className="inline-flex items-center"
    >
      <StatusChip
        tone={readinessTone}
        label={isLoading ? 'Codex Checking' : `Codex ${codexReadiness.label}`}
        title={codexReadiness.detail}
        animate={isLoading}
        className="max-w-[170px]"
      />
    </button>

    {isOpen && (
      <div
        className="absolute right-0 top-[calc(100%+10px)] z-50 w-[360px] p-3"
        style={POPOVER_SURFACE_STYLE}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span
              className="text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
            >
              Codex Runtime
            </span>
            <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              {codexReadiness.summary}
            </p>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
              {codexReadiness.detail}
            </p>
          </div>
          <StatusChip tone={readinessTone} label={codexReadiness.label} />
        </div>

        <div
          className="mt-3 rounded-md px-3 py-2 text-[11px] leading-5"
          style={{
            color: 'var(--color-muted)',
            background: 'var(--color-canvas)',
            border: '1px solid var(--color-hairline)'
          }}
        >
          Windows native Fluxion only sees Codex installed in the Windows PATH. A Codex binary
          installed only inside WSL is not available to this runner yet.
        </div>

        <div className="mt-3 grid gap-2 text-[11px]" style={{ color: 'var(--color-body)' }}>
          <div style={{ fontFamily: 'var(--font-mono)' }}>Install: pnpm add -g @openai/codex</div>
          <div style={{ fontFamily: 'var(--font-mono)' }}>Login: codex login</div>
          <div style={{ fontFamily: 'var(--font-mono)' }}>Check: codex login status</div>
          {codexReadiness.catalogSource && (
            <div style={{ fontFamily: 'var(--font-mono)' }}>
              Catalog: {codexReadiness.catalogSource}
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading || disabled}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>
    )}
  </div>
)
