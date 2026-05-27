import {
  CODEX_DEFAULT_MODEL,
  CodexConfigLayerValue,
  ProviderCapabilities,
  ProviderCatalogSource,
  ProviderCapabilitiesMap,
  ProviderModel,
  ProviderReadinessState
} from '@shared'

export interface CodexReadinessBadgeState {
  label:
    | 'Ready'
    | 'Setup needed'
    | 'Catalog warning'
    | 'Model warning'
    | 'MCP warning'
    | 'Config warning'
  tone: 'ready' | 'warning' | 'blocked'
  summary: string
  detail: string
  blocking: boolean
  actionCommand?: string
  catalogSource?: ProviderCatalogSource
  mcpDetail?: string[]
  policySummary?: string
  resolvedConfigDetail?: Array<{
    label: string
    value: string
    source?: string
    detail?: string
    layers?: Array<{ source: string; value: string; detail?: string }>
  }>
  resolvedConfigSummary?: string
  mcpSummary?: string
  actionItems?: Array<{
    id: string
    title: string
    detail: string
    severity: 'warning' | 'blocked'
    kind: 'config' | 'mcp'
  }>
  warnings?: string[]
  unknownModels: string[]
}

export interface ProviderReadinessSummary {
  availableCount: number
  blockingCount: number
  warningCount: number
  primaryLabel: string
  primaryDetail: string
  primaryActionCommand?: string
}

export function getCodexCapabilities(
  providerCapabilities: ProviderCapabilitiesMap
): ProviderCapabilities | undefined {
  return providerCapabilities.codex
}

export function getCodexReadiness(
  providerCapabilities: ProviderCapabilitiesMap
): ProviderReadinessState | undefined {
  return providerCapabilities.codex?.readiness
}

export function getCodexModelById(
  providerCapabilities: ProviderCapabilitiesMap,
  modelId: string
): ProviderModel | undefined {
  return providerCapabilities.codex?.models.find((model) => model.id === modelId)
}

export function getCodexModelDisplayName(
  providerCapabilities: ProviderCapabilitiesMap,
  modelId: string
): string {
  return getCodexModelById(providerCapabilities, modelId)?.displayName ?? modelId
}

export function getDefaultCodexModel(providerCapabilities: ProviderCapabilitiesMap): string {
  return (
    providerCapabilities.codex?.defaultModel ??
    providerCapabilities.codex?.models.find((model) => model.visibility !== 'hide')?.id ??
    providerCapabilities.codex?.models[0]?.id ??
    CODEX_DEFAULT_MODEL
  )
}

export function modelSupportsReasoning(model: ProviderModel | undefined): boolean {
  return (model?.supportedReasoningLevels.length ?? 0) > 0
}

export function isKnownCodexModel(
  providerCapabilities: ProviderCapabilitiesMap,
  modelId: string
): boolean {
  return Boolean(getCodexModelById(providerCapabilities, modelId))
}

export function collectUnknownCodexModels(
  providerCapabilities: ProviderCapabilitiesMap,
  modelIds: string[]
): string[] {
  const unknownModels = new Set<string>()

  for (const modelId of modelIds) {
    if (!modelId || isKnownCodexModel(providerCapabilities, modelId)) {
      continue
    }

    unknownModels.add(modelId)
  }

  return [...unknownModels]
}

export function getCodexReadinessBadgeState(
  providerCapabilities: ProviderCapabilitiesMap,
  modelIds: string[]
): CodexReadinessBadgeState {
  const codexCapabilities = getCodexCapabilities(providerCapabilities)
  const readiness = getCodexReadiness(providerCapabilities)
  const resolvedConfig = codexCapabilities?.resolvedConfig
  const formatLayerValue = (value: unknown): string => {
    if (typeof value === 'string') {
      return value
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
    if (Array.isArray(value)) {
      return value.join(', ')
    }
    if (value && typeof value === 'object' && 'kind' in value && value.kind === 'granular') {
      return 'granular'
    }
    return String(value)
  }
  const getLayerEntries = (field: keyof NonNullable<typeof resolvedConfig>['layers']) =>
    resolvedConfig?.layers?.[field]
  const formatLayerSource = (field: keyof NonNullable<typeof resolvedConfig>['layers']): string | undefined =>
    getLayerEntries(field)?.[0]?.source
  const formatLayerTrace = (field: keyof NonNullable<typeof resolvedConfig>['layers']) =>
    getLayerEntries(field)?.map((entry) => ({
      source: entry.source,
      value: formatLayerValue(entry.value),
      detail: entry.detail
    }))
  const buildConfigItem = (
    label: string,
    value: string,
    field?: keyof NonNullable<typeof resolvedConfig>['layers'],
    detail?: string
  ) => ({
    label,
    value,
    source: field ? formatLayerSource(field) : undefined,
    detail,
    layers: field ? formatLayerTrace(field) : undefined
  })

  const effectiveSummaryItems = resolvedConfig
    ? [
        resolvedConfig.model ? `model=${resolvedConfig.model}` : null,
        resolvedConfig.reviewModel ? `review_model=${resolvedConfig.reviewModel}` : null,
        resolvedConfig.serviceTier ? `tier=${resolvedConfig.serviceTier}` : null,
        `sandbox=${resolvedConfig.sandboxMode}`,
        `approval=${typeof resolvedConfig.approvalPolicy === 'string' ? resolvedConfig.approvalPolicy : 'granular'}`,
        resolvedConfig.trustLevel ? `trust=${resolvedConfig.trustLevel}` : null,
        resolvedConfig.compactPrompt ? 'compact=custom' : null,
        typeof resolvedConfig.memoriesDisableOnExternalContext === 'boolean'
          ? `memories.external=${resolvedConfig.memoriesDisableOnExternalContext ? 'off' : 'on'}`
          : null
      ]
        .filter(Boolean)
        .join(', ')
    : undefined
  const declaredButIgnoredCount = resolvedConfig
    ? (Object.values(resolvedConfig.layers) as Array<CodexConfigLayerValue<unknown>[] | undefined>)
        .flatMap((entries) => entries ?? [])
        .filter((entry) => entry.source === 'ignored-project').length
    : 0
  const resolvedConfigSummary =
    declaredButIgnoredCount > 0 && effectiveSummaryItems
      ? `${effectiveSummaryItems} (+${declaredButIgnoredCount} ignored project override${declaredButIgnoredCount === 1 ? '' : 's'})`
      : effectiveSummaryItems
  const mcpSummary = resolvedConfig?.mcpServers
    ? [
        `${resolvedConfig.mcpServers.filter((server) => server.enabled).length}/${resolvedConfig.mcpServers.length} enabled`,
        `${resolvedConfig.mcpServers.filter((server) => server.enabled && server.readiness === 'ready').length} ready`,
        `${resolvedConfig.mcpServers.filter((server) => server.enabled && server.readiness !== 'ready').length} warning`
      ].join(' | ')
    : undefined
  const actionItems: NonNullable<CodexReadinessBadgeState['actionItems']> = []
  const nonReadyMcpServers =
    resolvedConfig?.mcpServers?.filter((server) => server.enabled && server.readiness !== 'ready') ?? []
  const blockingMcpServers = nonReadyMcpServers.filter((server) => server.required || server.readiness === 'not-ready')
  const ignoredProjectWarnings =
    resolvedConfig?.warnings?.filter((warning) => /trusted projects|ignored|project-scoped/i.test(warning)) ?? []
  const resolvedConfigDetail = resolvedConfig
    ? [
        resolvedConfig.model ? buildConfigItem('Model', resolvedConfig.model, 'model') : null,
        resolvedConfig.reviewModel
          ? buildConfigItem('Review model', resolvedConfig.reviewModel, 'reviewModel')
          : null,
        resolvedConfig.serviceTier
          ? buildConfigItem('Service tier', resolvedConfig.serviceTier, 'serviceTier')
          : null,
        buildConfigItem('Sandbox', resolvedConfig.sandboxMode, 'sandboxMode'),
        buildConfigItem(
          'Approval',
          typeof resolvedConfig.approvalPolicy === 'string' ? resolvedConfig.approvalPolicy : 'granular',
          'approvalPolicy'
        ),
        resolvedConfig.approvalsReviewer
          ? buildConfigItem('Reviewer', resolvedConfig.approvalsReviewer, 'approvalsReviewer')
          : null,
        resolvedConfig.profile
          ? buildConfigItem('Profile', resolvedConfig.profile, 'profile')
          : null,
        resolvedConfig.trustLevel ? buildConfigItem('Trust', resolvedConfig.trustLevel) : null,
        typeof resolvedConfig.networkAccess === 'boolean'
          ? buildConfigItem('Network', resolvedConfig.networkAccess ? 'enabled' : 'disabled')
          : null,
        resolvedConfig.writableRoots && resolvedConfig.writableRoots.length > 0
          ? buildConfigItem('Writable roots', `${resolvedConfig.writableRoots.length}`)
          : null,
        typeof resolvedConfig.modelContextWindow === 'number'
          ? buildConfigItem('Context window', `${resolvedConfig.modelContextWindow}`, 'modelContextWindow')
          : null,
        typeof resolvedConfig.modelAutoCompactTokenLimit === 'number'
          ? buildConfigItem(
              'Auto-compact',
              `${resolvedConfig.modelAutoCompactTokenLimit}`,
              'modelAutoCompactTokenLimit'
            )
          : null,
        resolvedConfig.compactPrompt
          ? buildConfigItem('Compact prompt', 'custom', 'compactPrompt')
          : null,
        typeof resolvedConfig.memoriesDisableOnExternalContext === 'boolean'
          ? buildConfigItem(
              'Memory on external context',
              resolvedConfig.memoriesDisableOnExternalContext ? 'disabled' : 'allowed',
              'memoriesDisableOnExternalContext'
            )
          : null,
        resolvedConfig.modelVerbosity
          ? buildConfigItem('Verbosity', resolvedConfig.modelVerbosity, 'modelVerbosity')
          : null,
        resolvedConfig.modelReasoningSummary
          ? buildConfigItem(
              'Reasoning summary',
              resolvedConfig.modelReasoningSummary,
              'modelReasoningSummary'
            )
          : null,
        typeof resolvedConfig.hideAgentReasoning === 'boolean'
          ? buildConfigItem(
              'Hide reasoning',
              resolvedConfig.hideAgentReasoning ? 'true' : 'false',
              'hideAgentReasoning'
            )
          : null,
        typeof resolvedConfig.showRawAgentReasoning === 'boolean'
          ? buildConfigItem(
              'Raw reasoning',
              resolvedConfig.showRawAgentReasoning ? 'true' : 'false',
              'showRawAgentReasoning'
            )
          : null
      ].filter(Boolean) as Array<{
        label: string
        value: string
        source?: string
        detail?: string
        layers?: Array<{ source: string; value: string; detail?: string }>
      }>
    : undefined
  const policySummary = resolvedConfig
    ? [
        resolvedConfig.trustLevel
          ? `project config ${resolvedConfig.trustLevel === 'trusted' ? 'active' : 'gated by trust'}`
          : 'trust state unknown',
        resolvedConfig.compactPrompt ? 'compaction prompt custom' : 'compaction prompt default',
        typeof resolvedConfig.memoriesDisableOnExternalContext === 'boolean'
          ? resolvedConfig.memoriesDisableOnExternalContext
            ? 'external context kept out of memory generation'
            : 'external context still eligible for memory generation'
          : 'external-context memory policy uses Codex defaults'
      ].join(' | ')
    : undefined
  const mcpDetail = resolvedConfig?.mcpServers?.map((server) => {
    const endpoint = server.transport === 'http' ? server.url : server.command
    const policySummary = [
      server.defaultToolsApprovalMode ? `approval=${server.defaultToolsApprovalMode}` : null,
      server.enabledTools?.length ? `allow=${server.enabledTools.length}` : null,
      server.disabledTools?.length ? `deny=${server.disabledTools.length}` : null,
      server.toolPolicies?.length ? `tool_overrides=${server.toolPolicies.length}` : null
    ]
      .filter(Boolean)
      .join(', ')
    const readinessSummary = [
      server.readiness !== 'ready' ? `state=${server.readiness}` : null,
      server.readinessCategory ? `category=${server.readinessCategory}` : null,
      server.environment ? `env=${server.environment}` : null,
      server.envVarNames?.length ? `env_vars=${server.envVarNames.length}` : null
    ]
      .filter(Boolean)
      .join(', ')
    const tools = [
      readinessSummary || null,
      policySummary || null
    ]
      .filter(Boolean)
      .join(', ')

    return `${server.id}: ${server.enabled ? 'enabled' : 'disabled'}${endpoint ? ` | ${endpoint}` : ''}${tools ? ` | ${tools}` : ''}${server.reason ? ` | ${server.reason}` : ''}`
  })

  const constrainedServers =
    resolvedConfig?.mcpServers?.filter((server) => server.enabled && server.constrainedByPolicy) ?? []

  if (declaredButIgnoredCount > 0) {
    actionItems.push({
      id: 'ignored-project-overrides',
      title: 'Project config is not fully active',
      detail:
        resolvedConfig?.trustLevel === 'untrusted'
          ? 'This workspace is still untrusted, so project-local Codex overrides stay advisory until trust is granted.'
          : `${declaredButIgnoredCount} project-scoped override${declaredButIgnoredCount === 1 ? '' : 's'} are ignored at runtime.`,
      severity: 'warning',
      kind: 'config'
    })
  }

  for (const server of blockingMcpServers) {
    actionItems.push({
      id: `mcp-blocked-${server.id}`,
      title: `${server.id} is blocking expected MCP capability`,
      detail: server.reason ?? `Enabled server is in state ${server.readiness}.`,
      severity: 'blocked',
      kind: 'mcp'
    })
  }

  for (const server of nonReadyMcpServers.filter(
    (candidate) => !blockingMcpServers.some((blockingServer) => blockingServer.id === candidate.id)
  )) {
    actionItems.push({
      id: `mcp-warning-${server.id}`,
      title: `${server.id} still needs verification`,
      detail: server.reason ?? `Enabled server is in state ${server.readiness}.`,
      severity: 'warning',
      kind: 'mcp'
    })
  }

  for (const server of constrainedServers) {
    actionItems.push({
      id: `mcp-policy-${server.id}`,
      title: `${server.id} is narrowed by tool policy`,
      detail:
        server.reason ??
        'The server is reachable, but current allow/deny rules or per-tool approval posture reduce what this workflow can use.',
      severity: 'warning',
      kind: 'mcp'
    })
  }

  if (!codexCapabilities) {
    return {
      label: 'Catalog warning',
      tone: 'warning',
      summary: 'Codex readiness has not been checked.',
      detail: 'Refresh Codex readiness to verify CLI, login, and model catalog state.',
      blocking: false,
      actionCommand: 'codex login status',
      catalogSource: 'none',
      mcpDetail,
      policySummary,
      resolvedConfigDetail,
      resolvedConfigSummary,
      mcpSummary,
      actionItems,
      warnings: resolvedConfig?.warnings,
      unknownModels: []
    }
  }

  const unknownModels = collectUnknownCodexModels(providerCapabilities, modelIds)

  if (readiness?.blocking) {
    return {
      label: 'Setup needed',
      tone: 'blocked',
      summary: readiness.title,
      detail: readiness.message,
      blocking: true,
      actionCommand: readiness.actionCommand,
      catalogSource: readiness.catalogSource,
      mcpDetail,
      policySummary,
      resolvedConfigDetail,
      resolvedConfigSummary,
      mcpSummary,
      actionItems,
      warnings: resolvedConfig?.warnings,
      unknownModels
    }
  }

  if (unknownModels.length > 0) {
    return {
      label: 'Model warning',
      tone: 'warning',
      summary: 'Workflow uses a model outside the current Codex catalog.',
      detail: `Unknown model slug${unknownModels.length === 1 ? '' : 's'}: ${unknownModels.join(', ')}`,
      blocking: false,
      actionCommand: readiness?.actionCommand,
      catalogSource: readiness?.catalogSource,
      mcpDetail,
      policySummary,
      resolvedConfigDetail,
      resolvedConfigSummary,
      mcpSummary,
      actionItems,
      warnings: resolvedConfig?.warnings,
      unknownModels
    }
  }

  if (blockingMcpServers.length > 0) {
    return {
      label: 'MCP warning',
      tone: 'warning',
      summary:
        blockingMcpServers.length === 1
          ? '1 required or invalid MCP server is not ready.'
          : `${blockingMcpServers.length} required or invalid MCP servers are not ready.`,
      detail: blockingMcpServers
        .map((server) => `${server.id}: ${server.reason ?? `state=${server.readiness}`}`)
        .join(' '),
      blocking: false,
      actionCommand: readiness?.actionCommand,
      catalogSource: readiness?.catalogSource,
      mcpDetail,
      policySummary,
      resolvedConfigDetail,
      resolvedConfigSummary,
      mcpSummary,
      actionItems,
      warnings: resolvedConfig?.warnings,
      unknownModels
    }
  }

  if (nonReadyMcpServers.length > 0) {
    return {
      label: 'MCP warning',
      tone: 'warning',
      summary:
        nonReadyMcpServers.length === 1
          ? `1 enabled MCP server still needs attention.`
          : `${nonReadyMcpServers.length} enabled MCP servers still need attention.`,
      detail: nonReadyMcpServers
        .map((server) => `${server.id}: ${server.reason ?? `state=${server.readiness}`}`)
        .join(' '),
      blocking: false,
      actionCommand: readiness?.actionCommand,
      catalogSource: readiness?.catalogSource,
      mcpDetail,
      policySummary,
      resolvedConfigDetail,
      resolvedConfigSummary,
      mcpSummary,
      actionItems,
      warnings: resolvedConfig?.warnings,
      unknownModels
    }
  }

  if (constrainedServers.length > 0) {
    return {
      label: 'MCP warning',
      tone: 'warning',
      summary:
        constrainedServers.length === 1
          ? '1 MCP server is ready but constrained by tool policy.'
          : `${constrainedServers.length} MCP servers are ready but constrained by tool policy.`,
      detail: constrainedServers
        .map((server) => {
          const constraints = [
            server.defaultToolsApprovalMode ? `default approval=${server.defaultToolsApprovalMode}` : null,
            server.enabledTools?.length ? `${server.enabledTools.length} allowed tools` : null,
            server.disabledTools?.length ? `${server.disabledTools.length} denied tools` : null,
            server.toolPolicies?.length ? `${server.toolPolicies.length} per-tool override${server.toolPolicies.length === 1 ? '' : 's'}` : null
          ]
            .filter(Boolean)
            .join(', ')
          return `${server.id}: ${constraints || 'policy-limited'}`
        })
        .join(' '),
      blocking: false,
      actionCommand: readiness?.actionCommand,
      catalogSource: readiness?.catalogSource,
      mcpDetail,
      policySummary,
      resolvedConfigDetail,
      resolvedConfigSummary,
      mcpSummary,
      actionItems,
      warnings: resolvedConfig?.warnings,
      unknownModels
    }
  }

  if (ignoredProjectWarnings.length > 0) {
    return {
      label: 'Config warning',
      tone: 'warning',
      summary:
        declaredButIgnoredCount > 0
          ? `${declaredButIgnoredCount} project override${declaredButIgnoredCount === 1 ? '' : 's'} ignored by Codex.`
          : 'Project Codex config is not fully effective.',
      detail: ignoredProjectWarnings.join(' '),
      blocking: false,
      actionCommand: readiness?.actionCommand,
      catalogSource: readiness?.catalogSource,
      mcpDetail,
      policySummary,
      resolvedConfigDetail,
      resolvedConfigSummary,
      mcpSummary,
      actionItems,
      warnings: resolvedConfig?.warnings,
      unknownModels
    }
  }

  if (
    readiness &&
    (readiness.code === 'catalog_failed' ||
      readiness.code === 'auth_unknown' ||
      readiness.catalogSource === 'bundled')
  ) {
    return {
      label: 'Catalog warning',
      tone: 'warning',
      summary: readiness.title,
      detail: readiness.message,
      blocking: false,
      actionCommand: readiness.actionCommand,
      catalogSource: readiness.catalogSource,
      mcpDetail,
      policySummary,
      resolvedConfigDetail,
      resolvedConfigSummary,
      mcpSummary,
      warnings: resolvedConfig?.warnings,
      unknownModels
    }
  }

  return {
    label: 'Ready',
    tone: 'ready',
    summary: readiness?.title ?? 'Codex CLI ready.',
    detail: readiness?.message ?? 'Live Codex model discovery is available.',
    blocking: false,
    actionCommand: readiness?.actionCommand,
    catalogSource: readiness?.catalogSource,
    mcpDetail,
    policySummary,
    resolvedConfigDetail,
    resolvedConfigSummary,
    mcpSummary,
    actionItems,
    warnings: resolvedConfig?.warnings,
    unknownModels
  }
}

export function getCodexReadinessBlockMessage(readiness: CodexReadinessBadgeState): string | null {
  if (!readiness.blocking) {
    return null
  }

  return readiness.actionCommand
    ? `${readiness.summary} ${readiness.detail} Run \`${readiness.actionCommand}\`, then refresh Codex readiness.`
    : `${readiness.summary} ${readiness.detail}`
}

export function getProviderReadinessSummary(
  providerCapabilities: ProviderCapabilitiesMap
): ProviderReadinessSummary {
  const providers = Object.values(providerCapabilities).filter(
    (capability): capability is ProviderCapabilities => Boolean(capability)
  )

  if (providers.length === 0) {
    return {
      availableCount: 0,
      blockingCount: 0,
      warningCount: 1,
      primaryLabel: 'Provider status not checked',
      primaryDetail: 'Refresh provider readiness to verify local agent tooling.',
      primaryActionCommand: 'codex login status'
    }
  }

  const availableCount = providers.filter((provider) => provider.available).length
  const blockingProviders = providers.filter((provider) => provider.readiness?.blocking)
  const warningProviders = providers.filter(
    (provider) =>
      !provider.readiness?.blocking &&
      (provider.readiness?.code === 'catalog_failed' ||
        provider.readiness?.code === 'auth_unknown' ||
        provider.readiness?.catalogSource === 'bundled')
  )

  const primaryProvider =
    blockingProviders[0] ??
    warningProviders[0] ??
    providers.find((provider) => provider.available) ??
    providers[0]

  return {
    availableCount,
    blockingCount: blockingProviders.length,
    warningCount: warningProviders.length,
    primaryLabel: primaryProvider?.readiness?.title ?? `${primaryProvider.displayName} ready`,
    primaryDetail:
      primaryProvider?.readiness?.message ??
      `${primaryProvider.displayName} is available for local workflow execution.`,
    primaryActionCommand: primaryProvider?.readiness?.actionCommand
  }
}
