import { describe, expect, it } from 'vitest'
import {
  getWorkflowProviderRuntimePreflight,
  ProviderRuntimePreflightNode
} from './provider-runtime-preflight'
import { ProviderCapabilities } from './workflow.types'

const readyCodex: ProviderCapabilities = {
  provider: 'codex',
  displayName: 'Codex',
  available: true,
  auth: {
    type: 'cli-login',
    status: 'authenticated'
  },
  readiness: {
    code: 'ready',
    blocking: false,
    title: 'Codex CLI ready.',
    message: 'Fluxion can run workflows through the local Codex CLI.',
    catalogSource: 'live'
  },
  models: [],
  parameters: []
}

const readyOpenAI: ProviderCapabilities = {
  provider: 'openai',
  displayName: 'OpenAI',
  available: true,
  auth: {
    type: 'api-key-env',
    status: 'authenticated',
    envVar: 'OPENAI_API_KEY'
  },
  models: [],
  parameters: []
}

function node(data: ProviderRuntimePreflightNode['data']): ProviderRuntimePreflightNode {
  return {
    id: 'node-a',
    label: 'Node A',
    data
  }
}

describe('getWorkflowProviderRuntimePreflight', () => {
  it('allows ready Codex runtime nodes', () => {
    const result = getWorkflowProviderRuntimePreflight(
      [node({ provider: 'codex', model: 'gpt-5.5', prompt: 'Run task' })],
      { codex: readyCodex }
    )

    expect(result).toEqual({
      ok: true,
      message: 'Workflow provider/runtime configuration is runnable.'
    })
  })

  it('blocks missing Codex authentication before run state is created', () => {
    const result = getWorkflowProviderRuntimePreflight(
      [node({ provider: 'codex', model: 'gpt-5.5', prompt: 'Run task' })],
      {
        codex: {
          ...readyCodex,
          auth: {
            type: 'cli-login',
            status: 'missing',
            message: 'Run codex login.'
          }
        }
      }
    )

    expect(result).toMatchObject({
      ok: false,
      nodeId: 'node-a',
      provider: 'codex',
      message: expect.stringContaining('authentication is missing')
    })
  })

  it('blocks provider readiness failures before execution', () => {
    const result = getWorkflowProviderRuntimePreflight(
      [node({ provider: 'codex', model: 'gpt-5.5', prompt: 'Run task' })],
      {
        codex: {
          ...readyCodex,
          available: false,
          readiness: {
            code: 'cli_missing',
            blocking: true,
            title: 'Codex CLI not found.',
            message: 'Install @openai/codex.',
            catalogSource: 'none'
          }
        }
      }
    )

    expect(result).toMatchObject({
      ok: false,
      provider: 'codex',
      message: expect.stringContaining('Codex is unavailable')
    })
  })

  it('allows OpenAI runtime nodes when OpenAI capabilities are ready', () => {
    const result = getWorkflowProviderRuntimePreflight(
      [node({ provider: 'openai', model: 'gpt-5.5', prompt: 'Run task' })],
      { codex: readyCodex, openai: readyOpenAI }
    )

    expect(result).toEqual({
      ok: true,
      message: 'Workflow provider/runtime configuration is runnable.'
    })
  })

  it('blocks OpenAI runtime nodes when OpenAI capabilities are missing', () => {
    const result = getWorkflowProviderRuntimePreflight(
      [node({ provider: 'openai', model: 'gpt-5.5', prompt: 'Run task' })],
      { codex: readyCodex }
    )

    expect(result).toMatchObject({
      ok: false,
      provider: 'openai',
      message: expect.stringContaining('provider capabilities have not been loaded')
    })
  })
})
