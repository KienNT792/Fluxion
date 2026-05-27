import React from 'react'
import { Button } from '@renderer/components/ui/Button'
import { StatusChip, StatusChipTone } from '@renderer/components/ui/StatusChip'
import { POPOVER_SURFACE_STYLE } from '../lib/topbar-styles'

interface CodexReadinessView {
  catalogSource?: string
  detail: string
  label: string
  actionItems?: Array<{
    id: string
    title: string
    detail: string
    severity: 'warning' | 'blocked'
    kind: 'config' | 'mcp'
  }>
  mcpDetail?: string[]
  mcpSummary?: string
  resolvedConfigDetail?: Array<{
    label: string
    value: string
    source?: string
    detail?: string
    layers?: Array<{ source: string; value: string; detail?: string }>
  }>
  resolvedConfigSummary?: string
  summary: string
  warnings?: string[]
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
          {codexReadiness.resolvedConfigSummary && (
            <div style={{ fontFamily: 'var(--font-mono)' }}>
              Config: {codexReadiness.resolvedConfigSummary}
            </div>
          )}
          {codexReadiness.mcpSummary && (
            <div style={{ fontFamily: 'var(--font-mono)' }}>MCP: {codexReadiness.mcpSummary}</div>
          )}
        </div>

        {codexReadiness.label === 'MCP warning' && (
          <div
            className="mt-3 rounded-md px-3 py-2 text-[11px] leading-5"
            style={{
              color: 'var(--color-body)',
              background: 'var(--color-canvas)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            Codex itself is runnable, but at least one enabled MCP server is only partially verified,
            auth-gated, or not launchable from the current workspace/runtime posture.
          </div>
        )}

        {codexReadiness.label === 'Config warning' && (
          <div
            className="mt-3 rounded-md px-3 py-2 text-[11px] leading-5"
            style={{
              color: 'var(--color-body)',
              background: 'var(--color-canvas)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            Fluxion detected project-local Codex config, but some values are advisory only until the
            workspace is trusted or are keys that Codex does not honor at project scope.
          </div>
        )}

        {codexReadiness.resolvedConfigDetail && codexReadiness.resolvedConfigDetail.length > 0 && (
          <div
            className="mt-3 rounded-md px-3 py-2 text-[11px] leading-5"
            style={{
              color: 'var(--color-body)',
              background: 'var(--color-canvas)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            <div
              className="mb-2 text-[10px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
            >
              Effective config
            </div>
            <div className="grid gap-1.5">
              {codexReadiness.resolvedConfigDetail.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-3">
                  <span style={{ color: 'var(--color-muted)' }}>{item.label}</span>
                  <div className="text-right">
                    <div style={{ fontFamily: 'var(--font-mono)' }}>{item.value}</div>
                    {item.source && (
                      <div className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                        {item.source}
                      </div>
                    )}
                    {item.layers && item.layers.length > 1 && (
                      <div className="mt-1 grid gap-0.5 text-[10px]" style={{ color: 'var(--color-muted)' }}>
                        {item.layers.map((layer, index) => (
                          <div key={`${item.label}-${layer.source}-${index}`}>
                            {layer.source}: {layer.value}
                          </div>
                        ))}
                      </div>
                    )}
                    {item.detail && (
                      <div className="mt-1 max-w-[18rem] text-[10px]" style={{ color: 'var(--color-muted)' }}>
                        {item.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {codexReadiness.actionItems && codexReadiness.actionItems.length > 0 && (
          <div
            className="mt-3 rounded-md px-3 py-2 text-[11px] leading-5"
            style={{
              color: 'var(--color-body)',
              background: 'var(--color-canvas)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            <div
              className="mb-2 text-[10px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
            >
              Active issues
            </div>
            <div className="grid gap-2">
              {codexReadiness.actionItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md px-2.5 py-2"
                  style={{
                    background: 'var(--color-surface-card)',
                    border: '1px solid var(--color-hairline-soft)'
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium" style={{ color: 'var(--color-ink)' }}>
                        {item.title}
                      </div>
                      <div className="mt-1 text-[10px] leading-5" style={{ color: 'var(--color-muted)' }}>
                        {item.detail}
                      </div>
                    </div>
                    <div
                      className="shrink-0 text-[10px] uppercase"
                      style={{
                        color:
                          item.severity === 'blocked'
                            ? 'var(--color-semantic-error)'
                            : 'var(--color-timeline-grep)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {item.kind} {item.severity}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {codexReadiness.mcpDetail && codexReadiness.mcpDetail.length > 0 && (
          <div
            className="mt-3 rounded-md px-3 py-2 text-[11px] leading-5"
            style={{
              color: 'var(--color-body)',
              background: 'var(--color-canvas)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            <div
              className="mb-2 text-[10px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
            >
              MCP topology
            </div>
            <div className="grid gap-1.5">
              {codexReadiness.mcpDetail.map((item) => (
                <div key={item} style={{ fontFamily: 'var(--font-mono)' }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {codexReadiness.warnings && codexReadiness.warnings.length > 0 && (
          <div
            className="mt-3 rounded-md px-3 py-2 text-[11px] leading-5"
            style={{
              color: 'var(--color-body)',
              background: 'var(--color-canvas)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            {codexReadiness.warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        )}

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
