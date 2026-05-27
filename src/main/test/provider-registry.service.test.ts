import { describe, expect, it, vi } from 'vitest'
import {
  getCodexCapabilities,
  parseResolvedCodexConfig,
  parseCodexDebugModelsOutput,
  parseCodexVersionOutput,
  probeMcpServerReadiness
} from '../services/provider-registry.service'

vi.mock('electron', () => ({
  app: {
    getPath: () => 'C:\\FluxionTest'
  },
  safeStorage: {
    decryptString: () => '',
    encryptString: () => Buffer.from(''),
    isEncryptionAvailable: () => false
  }
}))

describe('provider-registry.service', () => {
  it('parses codex debug model output into provider models', () => {
    const models = parseCodexDebugModelsOutput(
      JSON.stringify({
        models: [
          {
            slug: 'gpt-5.5',
            display_name: 'GPT-5.5',
            description: 'Top-end model',
            visibility: 'list',
            supported_in_api: true,
            default_reasoning_level: 'medium',
            supported_reasoning_levels: [
              { effort: 'low' },
              { effort: 'medium' },
              { effort: 'high' },
              { effort: 'xhigh' }
            ]
          }
        ]
      })
    )

    expect(models).toEqual([
      {
        id: 'gpt-5.5',
        displayName: 'GPT-5.5',
        description: 'Top-end model',
        visibility: 'list',
        supportedInApi: true,
        supportedReasoningLevels: ['low', 'medium', 'high', 'xhigh'],
        defaultReasoningLevel: 'medium'
      }
    ])
  })

  it('returns unavailable when the Codex CLI cannot be resolved', async () => {
    const capabilities = await getCodexCapabilities({
      resolveCli: async () => {
        throw new Error('Codex CLI not found. Install @openai/codex and run codex login.')
      }
    })

    expect(capabilities.available).toBe(false)
    expect(capabilities.auth.status).toBe('missing')
    expect(capabilities.readiness).toMatchObject({
      code: 'cli_missing',
      blocking: true
    })
    expect(capabilities.models).toEqual([])
  })

  it('returns auth missing when discovery requires codex login', async () => {
    const capabilities = await getCodexCapabilities({
      resolveCli: async () => [
        {
          command: 'codex',
          argsPrefix: [],
          displayCommand: 'codex',
          source: 'direct'
        }
      ],
      runCommand: async () => {
        throw Object.assign(new Error('not authenticated'), {
          stderr: 'Please run codex login to continue.',
          stdout: ''
        })
      }
    })

    expect(capabilities.available).toBe(true)
    expect(capabilities.auth.status).toBe('missing')
    expect(capabilities.readiness).toMatchObject({
      code: 'auth_missing',
      blocking: true
    })
    expect(capabilities.models).toEqual([])
  })

  it('returns authenticated codex capabilities from debug models output', async () => {
    const capabilities = await getCodexCapabilities({
      resolveCli: async () => [
        {
          command: 'codex',
          argsPrefix: [],
          displayCommand: 'codex',
          source: 'direct'
        }
      ],
      runCommand: async (_command, args) => {
        if (args.join(' ') === '--version') {
          return { stdout: 'codex-cli 0.128.0', stderr: '' }
        }

        if (args.join(' ') === 'login status') {
          return { stdout: 'Logged in', stderr: '' }
        }

        return {
          stdout: JSON.stringify({
            models: [
              {
                slug: 'gpt-5.4-mini',
                display_name: 'GPT-5.4-Mini',
                visibility: 'list',
                supported_reasoning_levels: [{ effort: 'low' }, { effort: 'medium' }]
              },
              {
                slug: 'gpt-5.5',
                display_name: 'GPT-5.5',
                visibility: 'list',
                default_reasoning_level: 'medium',
                supported_reasoning_levels: [{ effort: 'medium' }, { effort: 'high' }]
              }
            ]
          }),
          stderr: ''
        }
      }
    })

    expect(capabilities.available).toBe(true)
    expect(capabilities.auth.status).toBe('authenticated')
    expect(capabilities.version).toBe('0.128.0')
    expect(capabilities.readiness).toMatchObject({
      code: 'ready',
      blocking: false,
      catalogSource: 'live'
    })
    expect(capabilities.defaultModel).toBe('gpt-5.5')
    expect(capabilities.models.map((model) => model.id)).toEqual(['gpt-5.4-mini', 'gpt-5.5'])
    expect(capabilities.approvalProtocol).toMatchObject({
      status: 'unknown'
    })
  })

  it('reads extended resolved config fields from trusted project config', async () => {
    const resolved = parseResolvedCodexConfig(
      `
model = "gpt-5.5"
review_model = "gpt-5.5-review"
service_tier = "fast"
sandbox_mode = "workspace-write"
approval_policy = "never"
approvals_reviewer = "auto_review"
model_context_window = 64000
model_auto_compact_token_limit = 28000
model_verbosity = "high"
model_reasoning_summary = "concise"
hide_agent_reasoning = true
show_raw_agent_reasoning = false
sandbox_workspace_write.network_access = true
sandbox_workspace_write.writable_roots = ["D:\\\\extra", "D:\\\\cache"]
`,
      true
    )

    expect(resolved).toMatchObject({
      model: 'gpt-5.5',
      reviewModel: 'gpt-5.5-review',
      serviceTier: 'fast',
      approvalsReviewer: 'auto_review',
      modelContextWindow: 64000,
      modelAutoCompactTokenLimit: 28000,
      modelVerbosity: 'high',
      modelReasoningSummary: 'concise',
      hideAgentReasoning: true,
      showRawAgentReasoning: false,
      networkAccess: true,
      writableRoots: ['D:\\\\extra', 'D:\\\\cache']
    })
  })

  it('marks required MCP servers without transport as not-ready', () => {
    const resolved = parseResolvedCodexConfig(
      `
[mcp_servers.repo]
enabled = true
required = true
`,
      true
    )

    expect(resolved?.mcpServers).toEqual([
      expect.objectContaining({
        id: 'repo',
        enabled: true,
        required: true,
        readiness: 'not-ready',
        reason: expect.stringContaining('missing both command and URL')
      })
    ])
  })

  it('parses MCP tool approval overrides and environment hints', () => {
    const resolved = parseResolvedCodexConfig(
      `
[mcp_servers.repo]
command = "node"
args = ["server.js"]
cwd = "D:\\\\repo-tools"
experimental_environment = "remote"
env_vars = ["GITHUB_TOKEN", "OPENAI_API_KEY"]

[mcp_servers.repo.tools.search]
approval_mode = "prompt"
enabled = true
`,
      true
    )

    expect(resolved?.mcpServers).toEqual([
      expect.objectContaining({
        id: 'repo',
        transport: 'stdio',
        environment: 'remote',
        constrainedByPolicy: true,
        readinessCategory: 'policy-constrained',
        envVarNames: ['GITHUB_TOKEN', 'OPENAI_API_KEY'],
        toolPolicies: [
          expect.objectContaining({
            name: 'search',
            approvalMode: 'prompt',
            enabled: true
          })
        ]
      })
    ])
  })

  it('classifies disabled and malformed MCP servers for downstream diagnostics', () => {
    const resolved = parseResolvedCodexConfig(
      `
[mcp_servers.disabledRepo]
enabled = false
command = "node"

[mcp_servers.badHttp]
enabled = true
required = true
url = "ftp://example.com"
`,
      true
    )

    expect(resolved?.mcpServers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'disabledRepo',
          readiness: 'disabled',
          readinessCategory: 'disabled'
        }),
        expect.objectContaining({
          id: 'badHttp',
          readiness: 'not-ready',
          readinessCategory: 'invalid-config'
        })
      ])
    )
  })

  it('downgrades relative MCP cwd validation to unknown unless required', () => {
    const resolved = parseResolvedCodexConfig(
      `
[mcp_servers.repo]
command = "node"
cwd = "."
`,
      true
    )

    expect(resolved?.mcpServers).toEqual([
      expect.objectContaining({
        id: 'repo',
        readiness: 'unknown',
        reason: expect.stringContaining('cwd is relative')
      })
    ])
  })

  it('treats untrusted project config as declared but ignored by Codex', () => {
    const resolved = parseResolvedCodexConfig(
      `
model = "gpt-5.5"
review_model = "gpt-5.5-review"
profile = "fast-lane"
sandbox_mode = "danger-full-access"
approval_policy = "on-request"
`,
      false
    )

    expect(resolved).toMatchObject({
      model: undefined,
      reviewModel: undefined,
      sandboxMode: 'workspace-write',
      approvalPolicy: 'never',
      trustLevel: 'untrusted',
      mcpServers: []
    })
    expect(resolved?.layers.model).toEqual([
      expect.objectContaining({
        source: 'ignored-project',
        value: 'gpt-5.5'
      })
    ])
    expect(resolved?.layers.profile).toEqual([
      expect.objectContaining({
        source: 'ignored-project',
        value: 'fast-lane'
      })
    ])
    expect(resolved?.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('only loads it for trusted projects'),
        expect.stringContaining('profile keys are ignored')
      ])
    )
  })

  it('reuses the first working Codex CLI candidate across discovery commands', async () => {
    const calls: string[] = []
    const capabilities = await getCodexCapabilities({
      resolveCli: async () => [
        {
          command: 'blocked-codex',
          argsPrefix: [],
          displayCommand: 'blocked-codex',
          source: 'direct'
        },
        {
          command: 'working-codex',
          argsPrefix: [],
          displayCommand: 'working-codex',
          source: 'direct'
        }
      ],
      runCommand: async (command, args) => {
        calls.push(`${command} ${args.join(' ')}`)

        if (command === 'blocked-codex') {
          throw Object.assign(new Error('permission denied'), {
            code: 'EACCES',
            stderr: '',
            stdout: ''
          })
        }

        if (args.join(' ') === 'login status') {
          return { stdout: 'Logged in', stderr: '' }
        }

        return {
          stdout: JSON.stringify({
            models: [{ slug: 'gpt-5.5', display_name: 'GPT-5.5', visibility: 'list' }]
          }),
          stderr: ''
        }
      }
    })

    expect(capabilities.readiness).toMatchObject({
      code: 'ready',
      blocking: false
    })
    expect(calls).toEqual([
      'blocked-codex --version',
      'working-codex --version',
      'working-codex login status',
      'working-codex debug models'
    ])
  })

  it('parses Codex CLI version output', () => {
    expect(parseCodexVersionOutput('codex-cli 0.128.0')).toBe('0.128.0')
    expect(parseCodexVersionOutput('codex v1.2.3-beta.1')).toBe('1.2.3-beta.1')
  })

  it('falls back from a blocked WindowsApps alias to a working Codex CLI candidate', async () => {
    const calls: string[] = []
    const windowsAppsCodex = 'C:\\Program Files\\WindowsApps\\codex.exe'

    const capabilities = await getCodexCapabilities({
      resolveCli: async () => [
        {
          command: windowsAppsCodex,
          argsPrefix: [],
          displayCommand: windowsAppsCodex,
          source: 'direct'
        },
        {
          command: 'C:\\Users\\Test\\AppData\\Roaming\\npm\\node.exe',
          argsPrefix: [
            'C:\\Users\\Test\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js'
          ],
          displayCommand:
            'C:\\Users\\Test\\AppData\\Roaming\\npm\\node.exe C:\\Users\\Test\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js',
          source: 'node-script'
        }
      ],
      runCommand: async (command, args) => {
        calls.push(`${command} ${args.join(' ')}`)

        if (command === windowsAppsCodex) {
          throw Object.assign(new Error('operation not permitted'), {
            code: 'EPERM',
            stderr: '',
            stdout: ''
          })
        }

        if (args.slice(-2).join(' ') === 'login status') {
          return { stdout: 'Logged in', stderr: '' }
        }

        return {
          stdout: JSON.stringify({
            models: [{ slug: 'gpt-5.5', display_name: 'GPT-5.5', visibility: 'list' }]
          }),
          stderr: ''
        }
      }
    })

    expect(capabilities.readiness).toMatchObject({
      code: 'ready',
      blocking: false
    })
    expect(calls).toEqual([
      `${windowsAppsCodex} --version`,
      'C:\\Users\\Test\\AppData\\Roaming\\npm\\node.exe C:\\Users\\Test\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js --version',
      'C:\\Users\\Test\\AppData\\Roaming\\npm\\node.exe C:\\Users\\Test\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js login status',
      'C:\\Users\\Test\\AppData\\Roaming\\npm\\node.exe C:\\Users\\Test\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js debug models'
    ])
  })

  it('returns a dedicated readiness state when every Codex candidate is a blocked WindowsApps alias', async () => {
    const windowsAppsCodex = 'C:\\Program Files\\WindowsApps\\codex.exe'
    const capabilities = await getCodexCapabilities({
      resolveCli: async () => [
        {
          command: windowsAppsCodex,
          argsPrefix: [],
          displayCommand: windowsAppsCodex,
          source: 'direct'
        }
      ],
      runCommand: async () => {
        throw Object.assign(new Error('operation not permitted'), {
          code: 'EPERM',
          stderr: '',
          stdout: ''
        })
      }
    })

    expect(capabilities.available).toBe(false)
    expect(capabilities.auth.status).toBe('unknown')
    expect(capabilities.readiness).toMatchObject({
      code: 'windowsapps_alias_blocked',
      blocking: true,
      actionCommand: 'npm i -g @openai/codex',
      catalogSource: 'none'
    })
    expect(capabilities.refreshHint).toContain('App Execution Alias')
  })

  it('keeps running non-blocking when auth status is unknown but catalog loads', async () => {
    const capabilities = await getCodexCapabilities({
      resolveCli: async () => [
        {
          command: 'codex',
          argsPrefix: [],
          displayCommand: 'codex',
          source: 'direct'
        }
      ],
      runCommand: async (_command, args) => {
        if (args.join(' ') === 'login status') {
          throw Object.assign(new Error('status failed'), {
            stderr: 'Unexpected auth status failure.',
            stdout: ''
          })
        }

        return {
          stdout: JSON.stringify({
            models: [{ slug: 'gpt-5.5', display_name: 'GPT-5.5', visibility: 'list' }]
          }),
          stderr: ''
        }
      }
    })

    expect(capabilities.auth.status).toBe('unknown')
    expect(capabilities.readiness).toMatchObject({
      code: 'auth_unknown',
      blocking: false,
      catalogSource: 'live'
    })
    expect(capabilities.models.map((model) => model.id)).toEqual(['gpt-5.5'])
  })

  it('falls back to the bundled catalog when live model discovery fails', async () => {
    const capabilities = await getCodexCapabilities({
      resolveCli: async () => [
        {
          command: 'codex',
          argsPrefix: [],
          displayCommand: 'codex',
          source: 'direct'
        }
      ],
      runCommand: async (_command, args) => {
        const commandLine = args.join(' ')
        if (commandLine === 'login status') {
          return { stdout: 'Logged in', stderr: '' }
        }

        if (commandLine === 'debug models') {
          throw Object.assign(new Error('network failed'), {
            stderr: 'Could not refresh model catalog.',
            stdout: ''
          })
        }

        return {
          stdout: JSON.stringify({
            models: [{ slug: 'gpt-5.4-mini', display_name: 'GPT-5.4-Mini', visibility: 'list' }]
          }),
          stderr: ''
        }
      }
    })

    expect(capabilities.readiness).toMatchObject({
      code: 'ready',
      blocking: false,
      catalogSource: 'bundled'
    })
    expect(capabilities.models.map((model) => model.id)).toEqual(['gpt-5.4-mini'])
  })

  it('returns a non-blocking catalog failure when auth is valid but discovery fails', async () => {
    const capabilities = await getCodexCapabilities({
      resolveCli: async () => [
        {
          command: 'codex',
          argsPrefix: [],
          displayCommand: 'codex',
          source: 'direct'
        }
      ],
      runCommand: async (_command, args) => {
        if (args.join(' ') === 'login status') {
          return { stdout: 'Logged in', stderr: '' }
        }

        throw Object.assign(new Error('catalog failed'), {
          stderr: 'Catalog unavailable.',
          stdout: ''
        })
      }
    })

    expect(capabilities.auth.status).toBe('authenticated')
    expect(capabilities.readiness).toMatchObject({
      code: 'catalog_failed',
      blocking: false,
      catalogSource: 'none'
    })
    expect(capabilities.models).toEqual([])
  })

  it('treats reachable MCP HTTP endpoints as ready even when auth is required', async () => {
    const originalFetch = global.fetch
    global.fetch = vi.fn(async () => new Response(null, { status: 401 })) as typeof fetch

    try {
      const probed = await probeMcpServerReadiness({
        id: 'remote',
        transport: 'http',
        enabled: true,
        required: true,
        url: 'https://example.com/mcp',
        readiness: 'unknown'
      })

      expect(probed).toMatchObject({
        id: 'remote',
        readiness: 'ready',
        reason: expect.stringContaining('401')
      })
    } finally {
      global.fetch = originalFetch
    }
  })

  it('marks stdio MCP servers unknown when the launcher cannot be spawned', async () => {
    const probed = await probeMcpServerReadiness({
      id: 'repo',
      transport: 'stdio',
      enabled: true,
      command: 'this-command-should-not-exist-fluxion',
      args: ['--help'],
      readiness: 'unknown'
    })

    expect(probed).toMatchObject({
      id: 'repo',
      readiness: 'unknown',
      reason: expect.stringContaining('Process spawn failed')
    })
  })
})
