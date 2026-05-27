import type { CodexResolvedMcpServer } from '@shared'

export type InlineToolListKey = 'enabled_tools' | 'disabled_tools'

export interface ToolScopeState {
  enabledTools: string[]
  disabledTools: string[]
  duplicateEnabledTools: string[]
  duplicateDisabledTools: string[]
  overlappingTools: string[]
  unknownEnabledTools: string[]
  unknownDisabledTools: string[]
  effectiveAllowedTools: string[] | null
  effectiveDeniedTools: string[]
  resolvedAllowedTools: string[] | null
  resolvedDeniedTools: string[]
  availableTools: string[]
  approvalPreview: string[]
  mode: 'inherit' | 'allow-only' | 'deny-some' | 'allow-and-deny'
  dependencyState: 'none' | 'ready' | 'warning' | 'blocked'
  dependencySummary?: string
  issues: Array<{
    id: string
    severity: 'warning' | 'blocked'
    title: string
    detail: string
  }>
}

function normalizeToolName(value: string): string {
  return value.trim()
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right))
}

function splitToolList(raw: string | undefined): string[] {
  if (!raw) {
    return []
  }

  return raw
    .split(',')
    .map(normalizeToolName)
    .filter(Boolean)
}

function collectDuplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
      continue
    }
    seen.add(value)
  }

  return uniqueSorted(duplicates)
}

export function parseInlineToolList(
  config: Record<string, string | number | boolean> | undefined,
  serverId: string,
  key: InlineToolListKey
): string[] {
  const raw = config?.[`mcp_servers.${serverId}.${key}`]
  return typeof raw === 'string' ? uniqueSorted(splitToolList(raw)) : []
}

export function buildToolScopeState(
  server: CodexResolvedMcpServer,
  codexConfig: Record<string, string | number | boolean> | undefined
): ToolScopeState {
  const rawEnabledTools = splitToolList(
    typeof codexConfig?.[`mcp_servers.${server.id}.enabled_tools`] === 'string'
      ? String(codexConfig?.[`mcp_servers.${server.id}.enabled_tools`])
      : undefined
  )
  const rawDisabledTools = splitToolList(
    typeof codexConfig?.[`mcp_servers.${server.id}.disabled_tools`] === 'string'
      ? String(codexConfig?.[`mcp_servers.${server.id}.disabled_tools`])
      : undefined
  )

  const enabledTools = uniqueSorted(rawEnabledTools)
  const disabledTools = uniqueSorted(rawDisabledTools)
  const duplicateEnabledTools = collectDuplicates(rawEnabledTools)
  const duplicateDisabledTools = collectDuplicates(rawDisabledTools)
  const overlappingTools = uniqueSorted(enabledTools.filter((tool) => disabledTools.includes(tool)))

  const serverKnownTools = uniqueSorted([
    ...(server.enabledTools ?? []),
    ...(server.disabledTools ?? []),
    ...(server.toolPolicies?.map((tool) => tool.name) ?? [])
  ])
  const unknownEnabledTools = uniqueSorted(
    enabledTools.filter((tool) => !serverKnownTools.includes(tool))
  )
  const unknownDisabledTools = uniqueSorted(
    disabledTools.filter((tool) => !serverKnownTools.includes(tool))
  )
  const availableTools = uniqueSorted([
    ...serverKnownTools,
    ...enabledTools,
    ...disabledTools
  ])

  let mode: ToolScopeState['mode'] = 'inherit'
  if (enabledTools.length > 0 && disabledTools.length > 0) {
    mode = 'allow-and-deny'
  } else if (enabledTools.length > 0) {
    mode = 'allow-only'
  } else if (disabledTools.length > 0) {
    mode = 'deny-some'
  }

  const effectiveAllowedTools =
    enabledTools.length > 0
      ? enabledTools.filter((tool) => !disabledTools.includes(tool))
      : availableTools.length > 0
        ? null
        : []
  const resolvedAllowedTools =
    effectiveAllowedTools === null
      ? null
      : effectiveAllowedTools.filter((tool) => !unknownEnabledTools.includes(tool))
  const resolvedDeniedTools = disabledTools.filter((tool) => !unknownDisabledTools.includes(tool))

  const nodeDependsOnServer = enabledTools.length > 0 || disabledTools.length > 0
  let dependencyState: ToolScopeState['dependencyState'] = 'none'
  let dependencySummary: string | undefined
  const issues: ToolScopeState['issues'] = []
  const approvalPreview = uniqueSorted([
    ...(server.defaultToolsApprovalMode ? [`default:${server.defaultToolsApprovalMode}`] : []),
    ...(server.toolPolicies?.map(
      (tool) => `${tool.name}:${tool.approvalMode ?? 'default'}`
    ) ?? [])
  ])

  if (nodeDependsOnServer) {
    if (!server.enabled) {
      dependencyState = 'blocked'
      dependencySummary = 'Node override targets a disabled MCP server.'
      issues.push({
        id: `${server.id}-disabled-server`,
        severity: 'blocked',
        title: 'Node override targets a disabled MCP server',
        detail: 'Remove the node-level override or re-enable this server in the effective Codex config.'
      })
    } else if (unknownEnabledTools.length > 0 || unknownDisabledTools.length > 0) {
      dependencyState = 'warning'
      dependencySummary =
        'Node override references tools that are not visible in the current MCP topology preview.'
      issues.push({
        id: `${server.id}-unknown-tools`,
        severity: 'warning',
        title: 'Node override references unknown tool ids',
        detail:
          'These tool ids remain in the raw override, but the current MCP topology cannot confirm them.'
      })
    } else if (server.readiness !== 'ready') {
      dependencyState = server.required || server.readiness === 'not-ready' ? 'blocked' : 'warning'
      dependencySummary =
        server.reason ??
        `Node override depends on MCP server state=${server.readiness}.`
      issues.push({
        id: `${server.id}-server-readiness`,
        severity: dependencyState === 'blocked' ? 'blocked' : 'warning',
        title:
          dependencyState === 'blocked'
            ? 'Node override depends on an unavailable MCP server'
            : 'Node override depends on an MCP server that still needs attention',
        detail: dependencySummary
      })
    } else if (server.constrainedByPolicy) {
      dependencyState = 'warning'
      dependencySummary = 'Server is reachable but constrained by MCP tool policy.'
      issues.push({
        id: `${server.id}-policy-constrained`,
        severity: 'warning',
        title: 'Server exposure is narrowed by MCP tool policy',
        detail:
          'This node can still target the server, but policy-level allow/deny or approval posture reduces what is effectively reachable.'
      })
    } else {
      dependencyState = 'ready'
      dependencySummary = 'Node override depends on a ready MCP server.'
    }
  }

  if (overlappingTools.length > 0) {
    issues.push({
      id: `${server.id}-overlap`,
      severity: 'warning',
      title: 'Some tools are both allowed and denied',
      detail: 'Codex applies disabled_tools after enabled_tools, so overlapping tools stay denied.'
    })
  }

  if (
    Array.isArray(resolvedAllowedTools) &&
    resolvedAllowedTools.length === 0 &&
    enabledTools.length > 0
  ) {
    issues.push({
      id: `${server.id}-empty-allowlist`,
      severity: 'blocked',
      title: 'Allowlist currently resolves to no known tools',
      detail: 'This node narrows the server to an empty effective tool set in the current topology preview.'
    })
  }

  return {
    enabledTools,
    disabledTools,
    duplicateEnabledTools,
    duplicateDisabledTools,
    overlappingTools,
    unknownEnabledTools,
    unknownDisabledTools,
    effectiveAllowedTools,
    effectiveDeniedTools: disabledTools,
    resolvedAllowedTools,
    resolvedDeniedTools,
    availableTools,
    approvalPreview,
    mode,
    dependencyState,
    dependencySummary,
    issues
  }
}
