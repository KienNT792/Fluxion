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
