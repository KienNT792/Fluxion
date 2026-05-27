import React from 'react'
import type { ProviderCapabilitiesMap } from '@shared'
import { getCodexCapabilities } from '@renderer/lib/provider-capabilities'
import {
  buildToolScopeState,
  parseInlineToolList,
  type InlineToolListKey,
  type ToolScopeState
} from '../lib/codex-tools-scope'
import { InspectorSection as Section } from './InspectorSection'

interface CodexToolsSectionProps {
  codexConfig?: Record<string, string | number | boolean>
  onCodexConfigChange?: (nextConfig: Record<string, string | number | boolean>) => void
  providerCapabilities: ProviderCapabilitiesMap
}

function formatScopeMode(mode: ToolScopeState['mode']): string {
  switch (mode) {
    case 'allow-only':
      return 'allow-only'
    case 'deny-some':
      return 'deny-some'
    case 'allow-and-deny':
      return 'allow + deny'
    default:
      return 'inherit'
  }
}

function getDependencyTone(
  state: ToolScopeState['dependencyState']
): { label: string; color: string } {
  switch (state) {
    case 'ready':
      return { label: 'dependency ready', color: 'var(--color-timeline-done)' }
    case 'warning':
      return { label: 'dependency warning', color: 'var(--color-timeline-grep)' }
    case 'blocked':
      return { label: 'dependency blocked', color: 'var(--color-semantic-error)' }
    default:
      return { label: 'optional', color: 'var(--color-muted)' }
  }
}

function formatToolList(values: string[]): string {
  return values.join(', ')
}

function renderPreviewValue(value: string[] | null): string {
  if (value === null) {
    return 'inherits server exposure'
  }

  if (value.length === 0) {
    return 'none'
  }

  return value.join(', ')
}

function renderGuidance(scope: ToolScopeState): string | null {
  if (scope.unknownEnabledTools.length > 0 || scope.unknownDisabledTools.length > 0) {
    return 'Some node overrides reference tools that the current MCP topology does not expose.'
  }

  if (scope.overlappingTools.length > 0) {
    return 'Deny rules win for overlapping tools because Codex applies disabled_tools after enabled_tools.'
  }

  if (scope.mode === 'allow-only') {
    return 'This node narrows the server to an explicit allowlist.'
  }

  if (scope.mode === 'deny-some') {
    return 'This node inherits server exposure, then removes selected tools.'
  }

  if (scope.mode === 'allow-and-deny') {
    return 'This node narrows the server and then applies explicit deny rules.'
  }

  return null
}

function issueToneColor(severity: 'warning' | 'blocked'): string {
  return severity === 'blocked' ? 'var(--color-semantic-error)' : 'var(--color-timeline-grep)'
}

export const CodexToolsSection: React.FC<CodexToolsSectionProps> = ({
  codexConfig,
  onCodexConfigChange,
  providerCapabilities
}) => {
  const codexCapabilities = getCodexCapabilities(providerCapabilities)
  const mcpServers = codexCapabilities?.resolvedConfig?.mcpServers ?? []
  const enabledMcpServers = mcpServers.filter((server) => server.enabled)

  const updateInlineToolList = (serverId: string, key: InlineToolListKey, rawValue: string): void => {
    if (!onCodexConfigChange) {
      return
    }

    const nextConfig = { ...(codexConfig ?? {}) }
    const configKey = `mcp_servers.${serverId}.${key}`
    const normalized = parseInlineToolList({ [configKey]: rawValue }, serverId, key).join(', ')

    if (normalized) {
      nextConfig[configKey] = normalized
    } else {
      delete nextConfig[configKey]
    }

    onCodexConfigChange(nextConfig)
  }

  return (
    <Section title="Tools">
      <div
        className="rounded-md px-3 py-3"
        style={{
          border: '1px solid var(--color-hairline)',
          background: 'var(--color-canvas)'
        }}
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted)' }}>
          Built-in
        </div>
        <div className="mt-2 text-[11px] leading-5" style={{ color: 'var(--color-body)' }}>
          Shell and local Codex-native tools follow the active sandbox, approval, and trust posture.
        </div>
      </div>

      <div
        className="rounded-md px-3 py-3"
        style={{
          border: '1px solid var(--color-hairline)',
          background: 'var(--color-canvas)'
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--color-muted)' }}
          >
            MCP
          </div>
          <div className="text-[10px]" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
            {enabledMcpServers.length}/{mcpServers.length} enabled
          </div>
        </div>

        <div className="mt-2 grid gap-2">
          {mcpServers.length === 0 ? (
            <div className="text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
              No MCP servers detected from the effective Codex config.
            </div>
          ) : (
            mcpServers.map((server) => {
              const scope = buildToolScopeState(server, codexConfig)
              const dependencyTone = getDependencyTone(scope.dependencyState)
              const guidance = renderGuidance(scope)
              const summary = [
                server.transport,
                server.environment ? `env=${server.environment}` : null,
                server.required ? 'required' : null,
                server.defaultToolsApprovalMode ? `approval=${server.defaultToolsApprovalMode}` : null,
                server.enabledTools?.length ? `enabled_tools=${server.enabledTools.length}` : null,
                server.disabledTools?.length ? `disabled_tools=${server.disabledTools.length}` : null
              ]
                .filter(Boolean)
                .join(' | ')

              return (
                <div
                  key={server.id}
                  className="rounded-md px-2.5 py-2"
                  style={{
                    border: '1px solid var(--color-hairline)',
                    background: 'var(--color-surface-card)'
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className="text-[11px] font-semibold"
                      style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}
                    >
                      {server.id}
                    </div>
                    <div
                      className="text-[10px]"
                      style={{
                        color:
                          scope.dependencyState === 'blocked'
                            ? 'var(--color-semantic-error)'
                            : server.enabled
                              ? 'var(--color-timeline-done)'
                              : 'var(--color-muted)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {server.enabled ? 'enabled' : 'disabled'}
                    </div>
                  </div>

                    <div
                      className="mt-1 text-[10px] leading-5"
                      style={{ color: 'var(--color-body)', fontFamily: 'var(--font-mono)' }}
                    >
                      node scope: {formatScopeMode(scope.mode)}
                    </div>
                    <div
                      className="mt-1 text-[10px] leading-5"
                      style={{ color: dependencyTone.color, fontFamily: 'var(--font-mono)' }}
                    >
                      {dependencyTone.label}
                    </div>

                  {summary ? (
                    <div
                      className="mt-1 text-[10px] leading-5"
                      style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                    >
                      {summary}
                    </div>
                  ) : null}

                  {server.reason ? (
                    <div
                      className="mt-1 text-[10px] leading-5"
                      style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                    >
                      {server.reason}
                    </div>
                  ) : null}

                  {scope.dependencySummary ? (
                    <div
                      className="mt-1 text-[10px] leading-5"
                      style={{
                        color:
                          scope.dependencyState === 'blocked'
                            ? 'var(--color-semantic-error)'
                            : 'var(--color-muted)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {scope.dependencySummary}
                    </div>
                  ) : null}

                  {scope.issues.length > 0 ? (
                    <div
                      className="mt-2 rounded-md px-2.5 py-2"
                      style={{
                        background: 'var(--color-canvas)',
                        border: '1px solid var(--color-hairline-soft)'
                      }}
                    >
                      <div
                        className="mb-2 text-[10px] uppercase tracking-[0.08em]"
                        style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                      >
                        Node issues
                      </div>
                      <div className="grid gap-1.5">
                        {scope.issues.map((issue) => (
                          <div key={issue.id}>
                            <div
                              className="text-[10px] font-semibold"
                              style={{ color: issueToneColor(issue.severity) }}
                            >
                              {issue.title}
                            </div>
                            <div className="mt-0.5 text-[10px] leading-5" style={{ color: 'var(--color-muted)' }}>
                              {issue.detail}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-2 grid gap-1">
                    <div className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                      Effective preview
                    </div>
                    <div
                      className="text-[10px] leading-5"
                      style={{ color: 'var(--color-body)', fontFamily: 'var(--font-mono)' }}
                    >
                      allow: {renderPreviewValue(scope.effectiveAllowedTools)}
                    </div>
                    {(scope.resolvedAllowedTools !== scope.effectiveAllowedTools ||
                      scope.unknownEnabledTools.length > 0) && (
                      <div
                        className="text-[10px] leading-5"
                        style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                      >
                        resolved allow: {renderPreviewValue(scope.resolvedAllowedTools)}
                      </div>
                    )}
                    <div
                      className="text-[10px] leading-5"
                      style={{ color: 'var(--color-body)', fontFamily: 'var(--font-mono)' }}
                    >
                      deny: {renderPreviewValue(scope.effectiveDeniedTools)}
                    </div>
                    {(scope.resolvedDeniedTools.length !== scope.effectiveDeniedTools.length ||
                      scope.unknownDisabledTools.length > 0) && (
                      <div
                        className="text-[10px] leading-5"
                        style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                      >
                        resolved deny: {renderPreviewValue(scope.resolvedDeniedTools)}
                      </div>
                    )}
                    {scope.availableTools.length > 0 ? (
                      <div
                        className="text-[10px] leading-5"
                        style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                      >
                        known tools: {scope.availableTools.join(', ')}
                      </div>
                    ) : null}
                    {scope.approvalPreview.length > 0 ? (
                      <div
                        className="text-[10px] leading-5"
                        style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                      >
                        approval preview: {scope.approvalPreview.join(', ')}
                      </div>
                    ) : null}
                  </div>

                  {scope.duplicateEnabledTools.length > 0 ||
                  scope.duplicateDisabledTools.length > 0 ||
                  scope.overlappingTools.length > 0 ||
                  scope.unknownEnabledTools.length > 0 ||
                  scope.unknownDisabledTools.length > 0 ? (
                    <div className="mt-2 grid gap-1">
                      {scope.duplicateEnabledTools.length > 0 ? (
                        <div className="text-[10px] leading-5" style={{ color: 'var(--color-muted)' }}>
                          Duplicate allowlist entries are normalized away: {formatToolList(scope.duplicateEnabledTools)}
                        </div>
                      ) : null}
                      {scope.duplicateDisabledTools.length > 0 ? (
                        <div className="text-[10px] leading-5" style={{ color: 'var(--color-muted)' }}>
                          Duplicate denylist entries are normalized away: {formatToolList(scope.duplicateDisabledTools)}
                        </div>
                      ) : null}
                      {scope.overlappingTools.length > 0 ? (
                        <div className="text-[10px] leading-5" style={{ color: 'var(--color-muted)' }}>
                          Overlap detected: {formatToolList(scope.overlappingTools)}. Codex applies `disabled_tools` after
                          `enabled_tools`, so these tools stay denied.
                        </div>
                      ) : null}
                      {scope.unknownEnabledTools.length > 0 ? (
                        <div className="text-[10px] leading-5" style={{ color: 'var(--color-muted)' }}>
                          Unknown allowlist tools: {formatToolList(scope.unknownEnabledTools)}
                        </div>
                      ) : null}
                      {scope.unknownDisabledTools.length > 0 ? (
                        <div className="text-[10px] leading-5" style={{ color: 'var(--color-muted)' }}>
                          Unknown denylist tools: {formatToolList(scope.unknownDisabledTools)}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {guidance ? (
                    <div
                      className="mt-2 text-[10px] leading-5"
                      style={{ color: 'var(--color-muted)' }}
                    >
                      {guidance}
                    </div>
                  ) : null}

                  {server.toolPolicies && server.toolPolicies.length > 0 ? (
                    <div
                      className="mt-2 text-[10px] leading-5"
                      style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                    >
                      per-tool overrides:{' '}
                      {server.toolPolicies
                        .map((tool) => `${tool.name}:${tool.approvalMode ?? 'default'}`)
                        .join(', ')}
                    </div>
                  ) : null}

                  <div className="mt-2 grid gap-2">
                    <div>
                      <div className="mb-1 text-[10px]" style={{ color: 'var(--color-muted)' }}>
                        Node allowlist
                      </div>
                      <input
                        type="text"
                        value={scope.enabledTools.join(', ')}
                        onChange={(event) => updateInlineToolList(server.id, 'enabled_tools', event.target.value)}
                        placeholder="tool-a, tool-b"
                        className="w-full rounded-md px-2 py-1.5 text-[11px]"
                        style={{
                          border: '1px solid var(--color-hairline)',
                          background: 'var(--color-canvas)',
                          color: 'var(--color-body)',
                          fontFamily: 'var(--font-mono)'
                        }}
                      />
                      {scope.unknownEnabledTools.length > 0 ? (
                        <div className="mt-1 text-[10px] leading-5" style={{ color: 'var(--color-semantic-error)' }}>
                          Unknown tools will stay in the raw override, but they are not confirmed by the
                          current MCP topology. Known ids: {renderPreviewValue(scope.resolvedAllowedTools)}
                        </div>
                      ) : null}
                      {scope.mode === 'allow-only' &&
                      Array.isArray(scope.resolvedAllowedTools) &&
                      scope.resolvedAllowedTools.length === 0 &&
                      scope.enabledTools.length > 0 ? (
                        <div className="mt-1 text-[10px] leading-5" style={{ color: 'var(--color-semantic-error)' }}>
                          This allowlist currently resolves to no known tools.
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <div className="mb-1 text-[10px]" style={{ color: 'var(--color-muted)' }}>
                        Node denylist
                      </div>
                      <input
                        type="text"
                        value={scope.disabledTools.join(', ')}
                        onChange={(event) => updateInlineToolList(server.id, 'disabled_tools', event.target.value)}
                        placeholder="tool-x, tool-y"
                        className="w-full rounded-md px-2 py-1.5 text-[11px]"
                        style={{
                          border: '1px solid var(--color-hairline)',
                          background: 'var(--color-canvas)',
                          color: 'var(--color-body)',
                          fontFamily: 'var(--font-mono)'
                        }}
                      />
                      {scope.unknownDisabledTools.length > 0 ? (
                        <div className="mt-1 text-[10px] leading-5" style={{ color: 'var(--color-semantic-error)' }}>
                          Unknown deny rules are preserved, but the current MCP topology does not confirm
                          those tool ids. Resolved deny: {renderPreviewValue(scope.resolvedDeniedTools)}
                        </div>
                      ) : null}
                      {scope.overlappingTools.length > 0 ? (
                        <div className="mt-1 text-[10px] leading-5" style={{ color: 'var(--color-muted)' }}>
                          Overlapping tools stay denied here because Codex applies `disabled_tools` after
                          `enabled_tools`.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="mt-2 text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
          Node-level MCP scoping is serialized as inline Codex config overrides using
          `mcp_servers.&lt;id&gt;.enabled_tools` and `disabled_tools`. Codex applies deny rules after
          allow rules for the same server.
        </div>
      </div>
    </Section>
  )
}
