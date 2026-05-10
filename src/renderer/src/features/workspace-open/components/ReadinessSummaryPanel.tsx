import React from 'react'
import { BookOpen, ExternalLink, MessageCircle, Terminal } from 'lucide-react'
import { Button } from '@renderer/components/ui/Button'
import { StatusChip, StatusChipTone } from '@renderer/components/ui/StatusChip'
import { Tooltip } from '@renderer/components/ui/Tooltip'

interface ReadinessSummaryPanelProps {
  authLabel: string
  cliLabel: string
  codexDetail: string
  isProviderCapabilitiesLoading: boolean
  readinessChipTone: StatusChipTone
  readinessStatusLabel: string
}

export const ReadinessSummaryPanel: React.FC<ReadinessSummaryPanelProps> = ({
  authLabel,
  cliLabel,
  codexDetail,
  isProviderCapabilitiesLoading,
  readinessChipTone,
  readinessStatusLabel
}) => (
  <section className="mx-auto w-full px-8 pb-12" style={{ maxWidth: '1440px' }}>
    <div className="grid grid-cols-3 gap-4">
      <div
        className="flex flex-col gap-4 rounded-lg px-5 py-5"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)'
        }}
      >
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
          Codex Readiness
        </h3>
        <Tooltip content={codexDetail}>
          <div className="w-fit">
            <StatusChip
              tone={readinessChipTone}
              label={readinessStatusLabel}
              animate={isProviderCapabilitiesLoading}
            />
          </div>
        </Tooltip>
        <div
          className="flex flex-col gap-2 text-xs"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-body)' }}
        >
          <div className="flex justify-between">
            <span>Codex CLI</span>
            <span style={{ color: 'var(--color-muted)' }}>{cliLabel}</span>
          </div>
          <div className="flex justify-between">
            <span>Authentication</span>
            <span style={{ color: 'var(--color-muted)' }}>{authLabel}</span>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const api = window.api as unknown as Record<string, () => void> | undefined
            if (api?.openCodexTerminal) {
              void api.openCodexTerminal()
            }
          }}
          className="mt-auto w-full"
        >
          <Terminal size={13} />
          Open Codex Terminal
        </Button>
      </div>

      <div
        className="flex flex-col gap-4 rounded-lg px-5 py-5"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)'
        }}
      >
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
          Repository Signals Detected
        </h3>
        <div className="flex flex-wrap gap-2">
          {['TypeScript', 'React', 'Vite', 'ESLint', 'Prettier'].map((tech) => (
            <span
              key={tech}
              className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{
                background: 'var(--color-surface-strong)',
                color: 'var(--color-ink)'
              }}
            >
              {tech}
            </span>
          ))}
        </div>
        <p className="text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
          We&apos;ll use these signals to customize the context for your project.
        </p>
      </div>

      <div
        className="flex flex-col gap-4 rounded-lg px-5 py-5"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)'
        }}
      >
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
          Need Help?
        </h3>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-xs font-medium transition-colors hover:bg-[var(--color-canvas)]"
          style={{
            color: 'var(--color-ink)',
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-surface-card)'
          }}
        >
          <BookOpen size={14} style={{ color: 'var(--color-muted)' }} />
          <span className="flex-1">Read the Documentation</span>
          <ExternalLink size={12} style={{ color: 'var(--color-muted-soft)' }} />
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-xs font-medium transition-colors hover:bg-[var(--color-canvas)]"
          style={{
            color: 'var(--color-ink)',
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-surface-card)'
          }}
        >
          <MessageCircle size={14} style={{ color: 'var(--color-muted)' }} />
          <span className="flex-1">Join our Community</span>
          <ExternalLink size={12} style={{ color: 'var(--color-muted-soft)' }} />
        </button>
      </div>
    </div>
  </section>
)
