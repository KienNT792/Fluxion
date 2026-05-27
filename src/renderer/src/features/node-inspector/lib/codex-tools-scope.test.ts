import { describe, expect, it } from 'vitest'
import type { CodexResolvedMcpServer } from '@shared'
import { buildToolScopeState, parseInlineToolList } from './codex-tools-scope'

const baseServer: CodexResolvedMcpServer = {
  id: 'workspace',
  transport: 'stdio',
  enabled: true,
  readiness: 'ready',
  enabledTools: ['read_file', 'write_file'],
  disabledTools: ['delete_file'],
  toolPolicies: [
    {
      name: 'search_repo',
      approvalMode: 'prompt'
    }
  ]
}

describe('codex tools scope helpers', () => {
  it('normalizes and deduplicates inline tool lists', () => {
    const config = {
      'mcp_servers.workspace.enabled_tools': ' write_file, read_file, write_file '
    }

    expect(parseInlineToolList(config, 'workspace', 'enabled_tools')).toEqual(['read_file', 'write_file'])
  })

  it('builds overlap-aware scope previews with deny precedence', () => {
    const config = {
      'mcp_servers.workspace.enabled_tools': 'read_file, write_file, write_file',
      'mcp_servers.workspace.disabled_tools': 'write_file, delete_file'
    }

    const scope = buildToolScopeState(baseServer, config)

    expect(scope.mode).toBe('allow-and-deny')
    expect(scope.enabledTools).toEqual(['read_file', 'write_file'])
    expect(scope.disabledTools).toEqual(['delete_file', 'write_file'])
    expect(scope.duplicateEnabledTools).toEqual(['write_file'])
    expect(scope.overlappingTools).toEqual(['write_file'])
    expect(scope.effectiveAllowedTools).toEqual(['read_file'])
    expect(scope.effectiveDeniedTools).toEqual(['delete_file', 'write_file'])
    expect(scope.availableTools).toEqual(['delete_file', 'read_file', 'search_repo', 'write_file'])
    expect(scope.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'workspace-overlap',
          severity: 'warning',
          title: 'Some tools are both allowed and denied'
        })
      ])
    )
  })

  it('keeps inherited exposure when no node allowlist is set', () => {
    const config = {
      'mcp_servers.workspace.disabled_tools': 'delete_file'
    }

    const scope = buildToolScopeState(baseServer, config)

    expect(scope.mode).toBe('deny-some')
    expect(scope.effectiveAllowedTools).toBeNull()
    expect(scope.effectiveDeniedTools).toEqual(['delete_file'])
    expect(scope.dependencyState).toBe('ready')
    expect(scope.dependencySummary).toContain('ready MCP server')
  })

  it('marks disabled MCP server overrides as blocked dependencies', () => {
    const scope = buildToolScopeState(
      {
        ...baseServer,
        enabled: false,
        readiness: 'disabled'
      },
      {
        'mcp_servers.workspace.enabled_tools': 'read_file'
      }
    )

    expect(scope.dependencyState).toBe('blocked')
    expect(scope.dependencySummary).toBe('Node override targets a disabled MCP server.')
    expect(scope.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'workspace-disabled-server',
          severity: 'blocked'
        })
      ])
    )
  })

  it('marks policy-constrained ready servers as warning dependencies', () => {
    const scope = buildToolScopeState(
      {
        ...baseServer,
        constrainedByPolicy: true
      },
      {
        'mcp_servers.workspace.enabled_tools': 'read_file'
      }
    )

    expect(scope.dependencyState).toBe('warning')
    expect(scope.dependencySummary).toBe('Server is reachable but constrained by MCP tool policy.')
  })

  it('flags unknown tool references as warning dependencies and keeps them visible', () => {
    const scope = buildToolScopeState(
      baseServer,
      {
        'mcp_servers.workspace.enabled_tools': 'read_file, unknown_tool',
        'mcp_servers.workspace.disabled_tools': 'unknown_block'
      }
    )

    expect(scope.unknownEnabledTools).toEqual(['unknown_tool'])
    expect(scope.unknownDisabledTools).toEqual(['unknown_block'])
    expect(scope.dependencyState).toBe('warning')
    expect(scope.dependencySummary).toContain('not visible in the current MCP topology preview')
    expect(scope.effectiveAllowedTools).toEqual(['read_file', 'unknown_tool'])
    expect(scope.resolvedAllowedTools).toEqual(['read_file'])
    expect(scope.effectiveDeniedTools).toEqual(['unknown_block'])
    expect(scope.resolvedDeniedTools).toEqual([])
    expect(scope.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'workspace-unknown-tools',
          severity: 'warning'
        })
      ])
    )
  })

  it('flags allowlists that resolve to no known tools as blocked', () => {
    const scope = buildToolScopeState(baseServer, {
      'mcp_servers.workspace.enabled_tools': 'missing_tool'
    })

    expect(scope.resolvedAllowedTools).toEqual([])
    expect(scope.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'workspace-empty-allowlist',
          severity: 'blocked',
          title: 'Allowlist currently resolves to no known tools'
        })
      ])
    )
  })

  it('builds approval preview from server-level and per-tool MCP policy', () => {
    const scope = buildToolScopeState(baseServer, undefined)

    expect(scope.approvalPreview).toEqual(['search_repo:prompt'])
  })
})
