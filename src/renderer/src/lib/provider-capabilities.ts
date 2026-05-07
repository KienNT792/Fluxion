import {
  CODEX_DEFAULT_MODEL,
  ProviderCapabilities,
  ProviderCatalogSource,
  ProviderCapabilitiesMap,
  ProviderModel,
  ProviderReadinessState,
} from '@shared';

export interface CodexReadinessBadgeState {
  label: 'Ready' | 'Setup needed' | 'Catalog warning' | 'Model warning';
  tone: 'ready' | 'warning' | 'blocked';
  summary: string;
  detail: string;
  blocking: boolean;
  actionCommand?: string;
  catalogSource?: ProviderCatalogSource;
  unknownModels: string[];
}

export interface ProviderReadinessSummary {
  availableCount: number;
  blockingCount: number;
  warningCount: number;
  primaryLabel: string;
  primaryDetail: string;
  primaryActionCommand?: string;
}

export function getCodexCapabilities(
  providerCapabilities: ProviderCapabilitiesMap
): ProviderCapabilities | undefined {
  return providerCapabilities.codex;
}

export function getCodexReadiness(
  providerCapabilities: ProviderCapabilitiesMap
): ProviderReadinessState | undefined {
  return providerCapabilities.codex?.readiness;
}

export function getCodexModelById(
  providerCapabilities: ProviderCapabilitiesMap,
  modelId: string
): ProviderModel | undefined {
  return providerCapabilities.codex?.models.find((model) => model.id === modelId);
}

export function getCodexModelDisplayName(
  providerCapabilities: ProviderCapabilitiesMap,
  modelId: string
): string {
  return getCodexModelById(providerCapabilities, modelId)?.displayName ?? modelId;
}

export function getDefaultCodexModel(providerCapabilities: ProviderCapabilitiesMap): string {
  return (
    providerCapabilities.codex?.defaultModel
    ?? providerCapabilities.codex?.models.find((model) => model.visibility !== 'hide')?.id
    ?? providerCapabilities.codex?.models[0]?.id
    ?? CODEX_DEFAULT_MODEL
  );
}

export function modelSupportsReasoning(model: ProviderModel | undefined): boolean {
  return (model?.supportedReasoningLevels.length ?? 0) > 0;
}

export function isKnownCodexModel(
  providerCapabilities: ProviderCapabilitiesMap,
  modelId: string
): boolean {
  return Boolean(getCodexModelById(providerCapabilities, modelId));
}

export function collectUnknownCodexModels(
  providerCapabilities: ProviderCapabilitiesMap,
  modelIds: string[]
): string[] {
  const unknownModels = new Set<string>();

  for (const modelId of modelIds) {
    if (!modelId || isKnownCodexModel(providerCapabilities, modelId)) {
      continue;
    }

    unknownModels.add(modelId);
  }

  return [...unknownModels];
}

export function getCodexReadinessBadgeState(
  providerCapabilities: ProviderCapabilitiesMap,
  modelIds: string[]
): CodexReadinessBadgeState {
  const codexCapabilities = getCodexCapabilities(providerCapabilities);
  const readiness = getCodexReadiness(providerCapabilities);

  if (!codexCapabilities) {
    return {
      label: 'Catalog warning',
      tone: 'warning',
      summary: 'Codex readiness has not been checked.',
      detail: 'Refresh Codex readiness to verify CLI, login, and model catalog state.',
      blocking: false,
      actionCommand: 'codex login status',
      catalogSource: 'none',
      unknownModels: [],
    };
  }

  const unknownModels = collectUnknownCodexModels(providerCapabilities, modelIds);

  if (readiness?.blocking) {
    return {
      label: 'Setup needed',
      tone: 'blocked',
      summary: readiness.title,
      detail: readiness.message,
      blocking: true,
      actionCommand: readiness.actionCommand,
      catalogSource: readiness.catalogSource,
      unknownModels,
    };
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
      unknownModels,
    };
  }

  if (
    readiness
    && (
      readiness.code === 'catalog_failed'
      || readiness.code === 'auth_unknown'
      || readiness.catalogSource === 'bundled'
    )
  ) {
    return {
      label: 'Catalog warning',
      tone: 'warning',
      summary: readiness.title,
      detail: readiness.message,
      blocking: false,
      actionCommand: readiness.actionCommand,
      catalogSource: readiness.catalogSource,
      unknownModels,
    };
  }

  return {
    label: 'Ready',
    tone: 'ready',
    summary: readiness?.title ?? 'Codex CLI ready.',
    detail: readiness?.message ?? 'Live Codex model discovery is available.',
    blocking: false,
    actionCommand: readiness?.actionCommand,
    catalogSource: readiness?.catalogSource,
    unknownModels,
  };
}

export function getCodexReadinessBlockMessage(
  readiness: CodexReadinessBadgeState
): string | null {
  if (!readiness.blocking) {
    return null;
  }

  return readiness.actionCommand
    ? `${readiness.summary} ${readiness.detail} Run \`${readiness.actionCommand}\`, then refresh Codex readiness.`
    : `${readiness.summary} ${readiness.detail}`;
}

export function getProviderReadinessSummary(
  providerCapabilities: ProviderCapabilitiesMap
): ProviderReadinessSummary {
  const providers = Object.values(providerCapabilities).filter(
    (capability): capability is ProviderCapabilities => Boolean(capability)
  );

  if (providers.length === 0) {
    return {
      availableCount: 0,
      blockingCount: 0,
      warningCount: 1,
      primaryLabel: 'Provider status not checked',
      primaryDetail: 'Refresh provider readiness to verify local agent tooling.',
      primaryActionCommand: 'codex login status',
    };
  }

  const availableCount = providers.filter((provider) => provider.available).length;
  const blockingProviders = providers.filter((provider) => provider.readiness?.blocking);
  const warningProviders = providers.filter(
    (provider) =>
      !provider.readiness?.blocking
      && (
        provider.readiness?.code === 'catalog_failed'
        || provider.readiness?.code === 'auth_unknown'
        || provider.readiness?.catalogSource === 'bundled'
      )
  );

  const primaryProvider =
    blockingProviders[0]
    ?? warningProviders[0]
    ?? providers.find((provider) => provider.available)
    ?? providers[0];

  return {
    availableCount,
    blockingCount: blockingProviders.length,
    warningCount: warningProviders.length,
    primaryLabel: primaryProvider?.readiness?.title ?? `${primaryProvider.displayName} ready`,
    primaryDetail:
      primaryProvider?.readiness?.message
      ?? `${primaryProvider.displayName} is available for local workflow execution.`,
    primaryActionCommand: primaryProvider?.readiness?.actionCommand,
  };
}
