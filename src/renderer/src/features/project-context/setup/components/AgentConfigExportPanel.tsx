import React from 'react'
import type {
  AgentConfigExportPreview,
  AgentConfigExporterId,
  AgentConfigExporterSummary
} from '@shared'
import { Button } from '@renderer/components/ui/Button'
import { StatusChip } from '@renderer/components/ui/StatusChip'

interface AgentConfigExportPanelProps {
  agentConfigError: string | null
  agentConfigExporters: AgentConfigExporterSummary[]
  agentConfigPreview: AgentConfigExportPreview | null
  canExportAgentConfig: boolean
  clearAgentConfigPreview: () => void
  handleApplyAgentConfigPreview: () => Promise<void>
  handleCreateAgentConfigPreview: (
    exporterId: AgentConfigExporterId,
    includeAdvancedConfig?: boolean
  ) => Promise<void>
  isApplyingAgentConfigPreview: boolean
  isCreatingAgentConfigPreview: boolean
}

export const AgentConfigExportPanel: React.FC<AgentConfigExportPanelProps> = ({
  agentConfigError,
  agentConfigExporters,
  agentConfigPreview,
  canExportAgentConfig,
  clearAgentConfigPreview,
  handleApplyAgentConfigPreview,
  handleCreateAgentConfigPreview,
  isApplyingAgentConfigPreview,
  isCreatingAgentConfigPreview
}) => (
  <div
    className="rounded-lg px-4 py-4"
    style={{
      background: 'var(--color-canvas-soft)',
      border: '1px solid var(--color-hairline)'
    }}
  >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
          Agent config export
        </p>
        <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
          Export Fluxion context into agent-specific workspace files after the canonical context is
          saved.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => void handleCreateAgentConfigPreview('codex', false)}
          disabled={!canExportAgentConfig || isCreatingAgentConfigPreview}
        >
          Codex AGENTS.md
        </Button>
        <Button
          variant="secondary"
          onClick={() => void handleCreateAgentConfigPreview('codex', true)}
          disabled={!canExportAgentConfig || isCreatingAgentConfigPreview}
        >
          Codex Advanced
        </Button>
      </div>
    </div>

    {agentConfigExporters.length > 0 ? (
      <div className="mt-3 flex flex-wrap gap-2">
        {agentConfigExporters
          .filter((exporter) => exporter.id !== 'codex')
          .map((exporter) => (
            <Button
              key={exporter.id}
              variant="ghost"
              onClick={() => void handleCreateAgentConfigPreview(exporter.id)}
              disabled={!canExportAgentConfig || isCreatingAgentConfigPreview}
            >
              {exporter.label} {exporter.status === 'notImplemented' ? '(scaffold)' : ''}
            </Button>
          ))}
      </div>
    ) : null}

    {agentConfigError ? (
      <p className="mt-3 text-xs" style={{ color: 'var(--color-semantic-error)' }}>
        {agentConfigError}
      </p>
    ) : null}

    {agentConfigPreview ? (
      <div className="mt-4 space-y-3">
        {agentConfigPreview.warnings.length > 0 ? (
          <div className="rounded-md px-3 py-3" style={{ background: '#fff8f2' }}>
            {agentConfigPreview.warnings.map((warning) => (
              <p key={warning} className="text-xs leading-5" style={{ color: 'var(--color-body)' }}>
                {warning}
              </p>
            ))}
          </div>
        ) : null}

        {agentConfigPreview.operations.length > 0 ? (
          <div className="space-y-3">
            {agentConfigPreview.operations.map((operation) => (
              <div
                key={`${operation.action}:${operation.relativePath}`}
                className="rounded-md px-3 py-3"
                style={{
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-hairline)'
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
                    {operation.action} {operation.relativePath}
                  </span>
                  <StatusChip tone="idle" label={operation.action} />
                </div>
                <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                  {operation.description}
                </p>
                <pre
                  className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md px-3 py-3 text-[11px] leading-5"
                  style={{
                    background: 'var(--color-canvas-soft)',
                    color: 'var(--color-ink)',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  {operation.content}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
            No file operations are available for this exporter yet.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={clearAgentConfigPreview}
            disabled={isApplyingAgentConfigPreview}
          >
            Clear Preview
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleApplyAgentConfigPreview()}
            disabled={isApplyingAgentConfigPreview || agentConfigPreview.operations.length === 0}
          >
            {isApplyingAgentConfigPreview ? 'Applying...' : 'Apply Export'}
          </Button>
        </div>
      </div>
    ) : null}
  </div>
)
