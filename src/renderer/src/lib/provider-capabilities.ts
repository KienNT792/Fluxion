import {
  CODEX_DEFAULT_MODEL,
  ProviderCapabilities,
  ProviderCapabilitiesMap,
  ProviderModel,
} from '@shared';

export function getCodexCapabilities(
  providerCapabilities: ProviderCapabilitiesMap
): ProviderCapabilities | undefined {
  return providerCapabilities.codex;
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
