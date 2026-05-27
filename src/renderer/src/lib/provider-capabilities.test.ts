import { describe, expect, it } from 'vitest'
import { ProviderCapabilitiesMap } from '@shared'
import {
  getCodexReadinessBadgeState,
  getCodexReadinessBlockMessage,
  getProviderReadinessSummary
} from './provider-capabilities'

function createCapabilities(
  readiness: NonNullable<ProviderCapabilitiesMap['codex']>['readiness'],
  models: string[] = ['gpt-5.5']
): ProviderCapabilitiesMap {
  return {
    codex: {
      provider: 'codex',
      displayName: 'Codex',
      available:
        readiness?.code !== 'cli_missing' && readiness?.code !== 'windowsapps_alias_blocked',
      auth: {
        type: 'cli-login',
        status: readiness?.code === 'auth_missing' ? 'missing' : 'authenticated',
        loginCommand: 'codex login'
      },
      readiness,
      models: models.map((id) => ({
        id,
        displayName: id,
        visibility: 'list',
        supportedReasoningLevels: []
      })),
      parameters: []
    }
  }
}

describe('provider-capabilities readiness helpers', () => {
  it('blocks setup-needed states', () => {
    const state = getCodexReadinessBadgeState(
      createCapabilities({
        code: 'auth_missing',
        blocking: true,
        title: 'Codex CLI is not logged in.',
        message: 'Run codex login, then refresh Codex readiness in Fluxion.',
        actionCommand: 'codex login',
        catalogSource: 'none'
      }),
      ['gpt-5.5']
    )

    expect(state).toMatchObject({
      label: 'Setup needed',
      tone: 'blocked',
      blocking: true
    })
    expect(getCodexReadinessBlockMessage(state)).toContain('codex login')
  })

  it('warns but does not block catalog failures', () => {
    const state = getCodexReadinessBadgeState(
      createCapabilities({
        code: 'catalog_failed',
        blocking: false,
        title: 'Codex model catalog could not be loaded.',
        message: 'Catalog unavailable.',
        catalogSource: 'none'
      }),
      []
    )

    expect(state).toMatchObject({
      label: 'Catalog warning',
      tone: 'warning',
      blocking: false
    })
    expect(getCodexReadinessBlockMessage(state)).toBeNull()
  })

  it('blocks WindowsApps alias readiness failures as setup-needed states', () => {
    const state = getCodexReadinessBadgeState(
      createCapabilities({
        code: 'windowsapps_alias_blocked',
        blocking: true,
        title: 'Codex WindowsApps alias is blocking execution.',
        message: 'Windows resolved codex to an App Execution Alias that Fluxion cannot spawn.',
        actionCommand: 'npm i -g @openai/codex',
        catalogSource: 'none'
      }),
      ['gpt-5.5']
    )

    expect(state).toMatchObject({
      label: 'Setup needed',
      tone: 'blocked',
      blocking: true,
      actionCommand: 'npm i -g @openai/codex'
    })
    expect(getCodexReadinessBlockMessage(state)).toContain('@openai/codex')
  })

  it('warns but does not block unknown workflow models', () => {
    const state = getCodexReadinessBadgeState(
      createCapabilities({
        code: 'ready',
        blocking: false,
        title: 'Codex CLI ready.',
        message: 'Ready.',
        catalogSource: 'live'
      }),
      ['legacy-model']
    )

    expect(state).toMatchObject({
      label: 'Model warning',
      tone: 'warning',
      blocking: false,
      unknownModels: ['legacy-model']
    })
  })

  it('returns ready when CLI, auth, catalog, and model are aligned', () => {
    const state = getCodexReadinessBadgeState(
      createCapabilities({
        code: 'ready',
        blocking: false,
        title: 'Codex CLI ready.',
        message: 'Ready.',
        catalogSource: 'live'
      }),
      ['gpt-5.5']
    )

    expect(state).toMatchObject({
      label: 'Ready',
      tone: 'ready',
      blocking: false,
      unknownModels: []
    })
  })

  it('warns when enabled MCP servers are still non-ready even if Codex itself is runnable', () => {
    const state = getCodexReadinessBadgeState(
      {
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
          models: [
            {
              id: 'gpt-5.5',
              displayName: 'gpt-5.5',
              visibility: 'list',
              supportedReasoningLevels: []
            }
          ],
          parameters: [],
          resolvedConfig: {
            sandboxMode: 'workspace-write',
            approvalPolicy: 'never',
            trustLevel: 'trusted',
            mcpServers: [
              {
                id: 'repo',
                enabled: true,
                transport: 'stdio',
                command: 'node',
                readiness: 'unknown',
                reason: 'Process spawn failed: command not found'
              }
            ],
            layers: {
              sandboxMode: [{ source: 'runtime-default', value: 'workspace-write' }],
              approvalPolicy: [{ source: 'runtime-default', value: 'never' }]
            }
          }
        }
      },
      ['gpt-5.5']
    )

    expect(state).toMatchObject({
      label: 'MCP warning',
      tone: 'warning',
      blocking: false
    })
    expect(state.detail).toContain('repo')
  })

  it('summarizes ignored project-local overrides separately from effective config', () => {
    const state = getCodexReadinessBadgeState(
      {
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
          models: [
            {
              id: 'gpt-5.5',
              displayName: 'gpt-5.5',
              visibility: 'list',
              supportedReasoningLevels: []
            }
          ],
          parameters: [],
          resolvedConfig: {
            sandboxMode: 'workspace-write',
            approvalPolicy: 'never',
            trustLevel: 'untrusted',
            layers: {
              model: [{ source: 'ignored-project', value: 'gpt-5.5' }],
              sandboxMode: [{ source: 'runtime-default', value: 'workspace-write' }],
              approvalPolicy: [{ source: 'runtime-default', value: 'never' }]
            },
            warnings: ['Project config is ignored until trust is granted.']
          }
        }
      },
      ['gpt-5.5']
    )

    expect(state.label).toBe('Config warning')
    expect(state.resolvedConfigSummary).toContain('ignored project override')
    expect(state.policySummary).toContain('project config gated by trust')
    expect(state.warnings).toEqual(['Project config is ignored until trust is granted.'])
    expect(state.actionItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'ignored-project-overrides',
          kind: 'config',
          severity: 'warning'
        })
      ])
    )
  })

  it('includes compact prompt and memory external-context posture in config detail', () => {
    const state = getCodexReadinessBadgeState(
      {
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
          models: [
            {
              id: 'gpt-5.5',
              displayName: 'gpt-5.5',
              visibility: 'list',
              supportedReasoningLevels: []
            }
          ],
          parameters: [],
          resolvedConfig: {
            sandboxMode: 'workspace-write',
            approvalPolicy: 'never',
            trustLevel: 'trusted',
            compactPrompt: 'Prefer semantic summaries.',
            memoriesDisableOnExternalContext: true,
            layers: {
              sandboxMode: [{ source: 'runtime-default', value: 'workspace-write' }],
              approvalPolicy: [{ source: 'runtime-default', value: 'never' }],
              compactPrompt: [{ source: 'project', value: 'Prefer semantic summaries.' }],
              memoriesDisableOnExternalContext: [{ source: 'project', value: true }]
            }
          }
        }
      },
      ['gpt-5.5']
    )

    expect(state.resolvedConfigSummary).toContain('compact=custom')
    expect(state.resolvedConfigSummary).toContain('memories.external=off')
    expect(state.policySummary).toContain('compaction prompt custom')
    expect(
      state.resolvedConfigDetail?.find((item) => item.label === 'Compact prompt')
    ).toEqual(expect.objectContaining({ value: 'custom', source: 'project' }))
    expect(
      state.resolvedConfigDetail?.find((item) => item.label === 'Memory on external context')
    ).toEqual(expect.objectContaining({ value: 'disabled', source: 'project' }))
  })

  it('summarizes MCP readiness counts, not only enabled totals', () => {
    const state = getCodexReadinessBadgeState(
      {
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
          models: [
            {
              id: 'gpt-5.5',
              displayName: 'gpt-5.5',
              visibility: 'list',
              supportedReasoningLevels: []
            }
          ],
          parameters: [],
          resolvedConfig: {
            sandboxMode: 'workspace-write',
            approvalPolicy: 'never',
            trustLevel: 'trusted',
            mcpServers: [
              {
                id: 'repo',
                enabled: true,
                transport: 'stdio',
                command: 'node',
                readiness: 'ready'
              },
              {
                id: 'browser',
                enabled: true,
                transport: 'http',
                url: 'https://example.test/mcp',
                readiness: 'unknown'
              },
              {
                id: 'search',
                enabled: false,
                transport: 'stdio',
                readiness: 'disabled'
              }
            ],
            layers: {
              sandboxMode: [{ source: 'runtime-default', value: 'workspace-write' }],
              approvalPolicy: [{ source: 'runtime-default', value: 'never' }]
            }
          }
        }
      },
      ['gpt-5.5']
    )

    expect(state.mcpSummary).toBe('2/3 enabled | 1 ready | 1 warning')
    expect(state.actionItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'mcp-warning-browser',
          kind: 'mcp',
          severity: 'warning'
        })
      ])
    )
  })

  it('adds blocked MCP action items for required or invalid servers', () => {
    const state = getCodexReadinessBadgeState(
      {
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
          models: [
            {
              id: 'gpt-5.5',
              displayName: 'gpt-5.5',
              visibility: 'list',
              supportedReasoningLevels: []
            }
          ],
          parameters: [],
          resolvedConfig: {
            sandboxMode: 'workspace-write',
            approvalPolicy: 'never',
            trustLevel: 'trusted',
            mcpServers: [
              {
                id: 'repo',
                enabled: true,
                required: true,
                transport: 'stdio',
                command: 'node',
                readiness: 'not-ready',
                reason: 'Probe failed with exit code 1'
              }
            ],
            layers: {
              sandboxMode: [{ source: 'runtime-default', value: 'workspace-write' }],
              approvalPolicy: [{ source: 'runtime-default', value: 'never' }]
            }
          }
        }
      },
      ['gpt-5.5']
    )

    expect(state.actionItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'mcp-blocked-repo',
          kind: 'mcp',
          severity: 'blocked',
          title: 'repo is blocking expected MCP capability'
        })
      ])
    )
  })

  it('includes config layer traces for explainability instead of only the first source', () => {
    const state = getCodexReadinessBadgeState(
      {
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
          models: [
            {
              id: 'gpt-5.5',
              displayName: 'gpt-5.5',
              visibility: 'list',
              supportedReasoningLevels: []
            }
          ],
          parameters: [],
          resolvedConfig: {
            model: 'gpt-5.5',
            sandboxMode: 'workspace-write',
            approvalPolicy: 'never',
            trustLevel: 'trusted',
            layers: {
              model: [
                { source: 'workflow', value: 'gpt-5.5', detail: 'Workflow fallback.' },
                { source: 'project', value: 'gpt-5.5', detail: 'Declared in .codex/config.toml.' }
              ],
              sandboxMode: [{ source: 'runtime-default', value: 'workspace-write' }],
              approvalPolicy: [{ source: 'runtime-default', value: 'never' }]
            }
          }
        }
      },
      ['gpt-5.5']
    )

    expect(state.resolvedConfigDetail?.find((item) => item.label === 'Model')).toEqual(
      expect.objectContaining({
        source: 'workflow',
        layers: [
          expect.objectContaining({ source: 'workflow', value: 'gpt-5.5' }),
          expect.objectContaining({ source: 'project', value: 'gpt-5.5' })
        ]
      })
    )
  })

  it('prioritizes required non-ready MCP servers over generic catalog-ready state', () => {
    const state = getCodexReadinessBadgeState(
      {
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
          models: [
            {
              id: 'gpt-5.5',
              displayName: 'gpt-5.5',
              visibility: 'list',
              supportedReasoningLevels: []
            }
          ],
          parameters: [],
          resolvedConfig: {
            sandboxMode: 'workspace-write',
            approvalPolicy: 'never',
            trustLevel: 'trusted',
            mcpServers: [
              {
                id: 'repo',
                enabled: true,
                required: true,
                transport: 'stdio',
                command: 'node',
                readiness: 'not-ready',
                reason: 'Enabled MCP stdio server is missing a launcher command.'
              }
            ],
            layers: {
              sandboxMode: [{ source: 'runtime-default', value: 'workspace-write' }],
              approvalPolicy: [{ source: 'runtime-default', value: 'never' }]
            }
          }
        }
      },
      ['gpt-5.5']
    )

    expect(state.label).toBe('MCP warning')
    expect(state.summary).toContain('required or invalid MCP')
    expect(state.detail).toContain('repo')
  })

  it('warns when MCP servers are reachable but constrained by tool policy', () => {
    const state = getCodexReadinessBadgeState(
      {
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
          models: [
            {
              id: 'gpt-5.5',
              displayName: 'gpt-5.5',
              visibility: 'list',
              supportedReasoningLevels: []
            }
          ],
          parameters: [],
          resolvedConfig: {
            sandboxMode: 'workspace-write',
            approvalPolicy: 'never',
            trustLevel: 'trusted',
            mcpServers: [
              {
                id: 'repo',
                enabled: true,
                transport: 'stdio',
                command: 'node',
                readiness: 'ready',
                readinessCategory: 'policy-constrained',
                constrainedByPolicy: true,
                defaultToolsApprovalMode: 'prompt',
                enabledTools: ['search', 'fetch'],
                toolPolicies: [{ name: 'search', approvalMode: 'approve' }]
              }
            ],
            layers: {
              sandboxMode: [{ source: 'runtime-default', value: 'workspace-write' }],
              approvalPolicy: [{ source: 'runtime-default', value: 'never' }]
            }
          }
        }
      },
      ['gpt-5.5']
    )

    expect(state.label).toBe('MCP warning')
    expect(state.summary).toContain('constrained by tool policy')
    expect(state.detail).toContain('default approval=prompt')
    expect(state.mcpDetail?.[0]).toContain('category=policy-constrained')
  })

  it('summarizes provider availability in a provider-neutral way', () => {
    const summary = getProviderReadinessSummary(
      createCapabilities({
        code: 'ready',
        blocking: false,
        title: 'Codex CLI ready.',
        message: 'Ready.',
        catalogSource: 'live'
      })
    )

    expect(summary).toMatchObject({
      availableCount: 1,
      blockingCount: 0,
      warningCount: 0,
      primaryLabel: 'Codex CLI ready.',
      primaryDetail: 'Ready.'
    })
  })
})
