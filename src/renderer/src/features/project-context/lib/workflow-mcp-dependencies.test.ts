import { describe, expect, it } from 'vitest'
import type { ProviderCapabilitiesMap } from '@shared'
import { buildWorkflowMcpDependencySummary } from './workflow-mcp-dependencies'

const providerCapabilities: ProviderCapabilitiesMap = {
  codex: {
    provider: 'codex',
    displayName: 'Codex',
    available: true,
    auth: {
      type: 'cli-login',
      status: 'authenticated',
      loginCommand: 'codex login'
    },
    readiness: {
      code: 'ready',
      blocking: false,
      title: 'Codex CLI ready.',
      message: 'Ready.',
      catalogSource: 'live'
    },
    models: [],
    parameters: [],
    resolvedConfig: {
      sandboxMode: 'workspace-write',
      approvalPolicy: 'never',
      trustLevel: 'trusted',
      mcpServers: [
        {
          id: 'repo',
          transport: 'stdio',
          enabled: true,
          readiness: 'ready'
        },
        {
          id: 'browser',
          transport: 'http',
          enabled: true,
          readiness: 'unknown',
          reason: 'OAuth still required.'
        },
        {
          id: 'search',
          transport: 'stdio',
          enabled: false,
          readiness: 'disabled'
        }
      ],
      layers: {
        sandboxMode: [{ source: 'runtime-default', value: 'workspace-write' }],
        approvalPolicy: [{ source: 'runtime-default', value: 'never' }]
      }
    }
  }
}

function createNode(id: string, config?: Record<string, string | number | boolean>) {
  return {
    id,
    data: {
      provider: 'codex' as const,
      model: 'gpt-5.5',
      prompt: 'test',
      codex: config ? { config } : undefined
    }
  }
}

describe('workflow MCP dependency summary', () => {
  it('aggregates workflow-level MCP dependency state across nodes', () => {
    const summary = buildWorkflowMcpDependencySummary(
      [
        createNode('analyze', { 'mcp_servers.repo.enabled_tools': 'read_file' }),
        createNode('review', { 'mcp_servers.browser.enabled_tools': 'browse' }),
        createNode('retry', { 'mcp_servers.search.enabled_tools': 'search' })
      ],
      providerCapabilities
    )

    expect(summary.counts).toEqual({ ready: 0, warning: 2, blocked: 1 })
    expect(summary.entries).toEqual([
      expect.objectContaining({
        serverId: 'browser',
        state: 'warning',
        nodeIds: ['review'],
        summary: expect.stringContaining('1 node depend on this server.')
      }),
      expect.objectContaining({
        serverId: 'repo',
        state: 'warning',
        nodeIds: ['analyze'],
        summary: expect.stringContaining('not visible in the current MCP topology preview')
      }),
      expect.objectContaining({
        serverId: 'search',
        state: 'blocked',
        nodeIds: ['retry'],
        summary: expect.stringContaining('disabled MCP server')
      })
    ])
  })

  it('keeps the highest-severity state when multiple nodes target the same server', () => {
    const summary = buildWorkflowMcpDependencySummary(
      [
        createNode('first', { 'mcp_servers.browser.enabled_tools': 'browse' }),
        createNode('second', { 'mcp_servers.browser.disabled_tools': 'browse' })
      ],
      providerCapabilities
    )

    expect(summary.counts).toEqual({ ready: 0, warning: 1, blocked: 0 })
    expect(summary.entries[0]).toEqual(
      expect.objectContaining({
        serverId: 'browser',
        state: 'warning',
        nodeIds: ['first', 'second'],
        summary: expect.stringContaining('2 nodes depend on this server.')
      })
    )
  })
})
