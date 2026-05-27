import type { AgentNodeData, ProviderCapabilitiesMap } from '@shared'
import { getCodexCapabilities } from '../../../lib/provider-capabilities'
import { buildToolScopeState } from '../../node-inspector/lib/codex-tools-scope'

export interface WorkflowMcpDependencyEntry {
  serverId: string
  state: 'ready' | 'warning' | 'blocked'
  summary: string
  nodeIds: string[]
}

export interface WorkflowMcpDependencySummary {
  entries: WorkflowMcpDependencyEntry[]
  counts: {
    ready: number
    warning: number
    blocked: number
  }
}

interface WorkflowMcpDependencyNodeLike {
  id: string
  data: AgentNodeData
}

function rankState(state: WorkflowMcpDependencyEntry['state']): number {
  switch (state) {
    case 'blocked':
      return 3
    case 'warning':
      return 2
    default:
      return 1
  }
}

export function buildWorkflowMcpDependencySummary(
  nodes: WorkflowMcpDependencyNodeLike[],
  providerCapabilities: ProviderCapabilitiesMap
): WorkflowMcpDependencySummary {
  const codexCapabilities = getCodexCapabilities(providerCapabilities)
  const mcpServers = codexCapabilities?.resolvedConfig?.mcpServers ?? []
  const entries = new Map<string, WorkflowMcpDependencyEntry>()
  const reasons = new Map<string, string[]>()

  for (const node of nodes) {
    const codexConfig = node.data.codex?.config
    if (!codexConfig) {
      continue
    }

    for (const server of mcpServers) {
      const scope = buildToolScopeState(server, codexConfig)
      if (scope.dependencyState === 'none') {
        continue
      }

      const nextState =
        scope.dependencyState === 'ready'
          ? 'ready'
          : scope.dependencyState === 'warning'
            ? 'warning'
            : 'blocked'
      const existing = entries.get(server.id)

      if (!existing) {
        reasons.set(server.id, scope.dependencySummary ? [scope.dependencySummary] : [])
        entries.set(server.id, {
          serverId: server.id,
          state: nextState,
          summary: scope.dependencySummary ?? 'Workflow node depends on this MCP server.',
          nodeIds: [node.id]
        })
        continue
      }

      if (!existing.nodeIds.includes(node.id)) {
        existing.nodeIds.push(node.id)
      }
      if (scope.dependencySummary) {
        const serverReasons = reasons.get(server.id) ?? []
        if (!serverReasons.includes(scope.dependencySummary)) {
          serverReasons.push(scope.dependencySummary)
          reasons.set(server.id, serverReasons)
        }
      }

      if (rankState(nextState) > rankState(existing.state)) {
        existing.state = nextState
        existing.summary = scope.dependencySummary ?? existing.summary
      }
    }
  }

  const result = Array.from(entries.values())
    .map((entry) => {
      const serverReasons = reasons.get(entry.serverId) ?? []
      const nodeCount = entry.nodeIds.length
      const nodeLabel = nodeCount === 1 ? 'node' : 'nodes'
      const primaryReason = serverReasons[0] ?? entry.summary

      return {
        ...entry,
        summary: `${nodeCount} ${nodeLabel} depend on this server. ${primaryReason}`
      }
    })
    .sort((left, right) => left.serverId.localeCompare(right.serverId))

  return {
    entries: result,
    counts: {
      ready: result.filter((entry) => entry.state === 'ready').length,
      warning: result.filter((entry) => entry.state === 'warning').length,
      blocked: result.filter((entry) => entry.state === 'blocked').length
    }
  }
}
