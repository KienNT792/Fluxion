import {
  OPENAI_DEFAULT_MODEL,
  OPENAI_DEFAULT_REASONING_LEVEL,
  OPENAI_MVP_MODELS,
  ProviderCapabilities,
  ProviderCapabilitiesMap,
  ProviderModel,
  ProviderParameterSpec,
} from '@shared';

const OPENAI_MODELS_TIMEOUT_MS = 10_000;

const OPENAI_PARAMETERS: ProviderParameterSpec[] = [
  {
    id: 'reasoningLevel',
    label: 'Reasoning Effort',
    type: 'select',
    defaultValue: OPENAI_DEFAULT_REASONING_LEVEL,
    appliesTo: 'reasoning-models',
    options: ['low', 'medium', 'high', 'xhigh'].map((level) => ({
      value: level,
      label: level,
    })),
  },
  {
    id: 'temperature',
    label: 'Temperature',
    type: 'number',
    defaultValue: 0.7,
    min: 0,
    max: 2,
    step: 0.1,
    appliesTo: 'standard-models',
  },
  {
    id: 'maxTokens',
    label: 'Max Tokens',
    type: 'number',
    defaultValue: 2048,
    min: 1,
    step: 1,
    appliesTo: 'all',
  },
];

interface OpenAIModelListResponse {
  data?: Array<{
    id?: unknown;
  }>;
}

function buildStaticOpenAIModels(): ProviderModel[] {
  return OPENAI_MVP_MODELS.map((model) => ({
    id: model.id,
    displayName: model.displayName,
    description: model.description,
    visibility: 'list',
    supportedReasoningLevels: model.supportedReasoningLevels,
    defaultReasoningLevel: model.supportsReasoning ? OPENAI_DEFAULT_REASONING_LEVEL : undefined,
  }));
}

async function fetchOpenAIModels(apiKey: string): Promise<ProviderModel[]> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), OPENAI_MODELS_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI model list request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as OpenAIModelListResponse;
    if (!Array.isArray(payload.data)) {
      throw new Error('OpenAI model list returned an invalid payload.');
    }

    const staticModels = new Map(buildStaticOpenAIModels().map((model) => [model.id, model]));

    return payload.data
      .map((item) => (typeof item.id === 'string' ? item.id : undefined))
      .filter((id): id is string => Boolean(id))
      .sort((a, b) => a.localeCompare(b))
      .map((id) => ({
        id,
        displayName: staticModels.get(id)?.displayName ?? id,
        description: staticModels.get(id)?.description,
        visibility: staticModels.has(id) ? 'list' : 'dynamic',
        supportedReasoningLevels: staticModels.get(id)?.supportedReasoningLevels ?? [],
        defaultReasoningLevel: staticModels.get(id)?.defaultReasoningLevel,
      }));
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function getOpenAICapabilities(): Promise<ProviderCapabilities> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const fallbackModels = buildStaticOpenAIModels();

  if (!apiKey) {
    return {
      provider: 'openai',
      displayName: 'OpenAI',
      available: true,
      auth: {
        type: 'api-key-env',
        status: 'missing',
        envVar: 'OPENAI_API_KEY',
        message: 'Set OPENAI_API_KEY in the Electron main process environment.',
      },
      models: fallbackModels,
      defaultModel: OPENAI_DEFAULT_MODEL,
      parameters: OPENAI_PARAMETERS,
      refreshHint: 'Uses /v1/models when OPENAI_API_KEY is available; otherwise shows fallback presets.',
    };
  }

  try {
    const models = await fetchOpenAIModels(apiKey);

    return {
      provider: 'openai',
      displayName: 'OpenAI',
      available: true,
      auth: {
        type: 'api-key-env',
        status: 'authenticated',
        envVar: 'OPENAI_API_KEY',
      },
      models: models.length > 0 ? models : fallbackModels,
      defaultModel: models.some((model) => model.id === OPENAI_DEFAULT_MODEL)
        ? OPENAI_DEFAULT_MODEL
        : models[0]?.id ?? OPENAI_DEFAULT_MODEL,
      parameters: OPENAI_PARAMETERS,
      refreshHint: 'Uses OpenAI /v1/models for live model discovery.',
    };
  } catch (error) {
    return {
      provider: 'openai',
      displayName: 'OpenAI',
      available: true,
      auth: {
        type: 'api-key-env',
        status: 'authenticated',
        envVar: 'OPENAI_API_KEY',
        message: 'API key exists, but live model discovery failed.',
      },
      error: error instanceof Error ? error.message : 'Failed to fetch OpenAI models.',
      models: fallbackModels,
      defaultModel: OPENAI_DEFAULT_MODEL,
      parameters: OPENAI_PARAMETERS,
      refreshHint: 'Uses OpenAI /v1/models for live model discovery.',
    };
  }
}

export class ProviderRegistryService {
  private static instance: ProviderRegistryService;
  private cachedCapabilities: ProviderCapabilitiesMap | null = null;
  private cachedAt = 0;
  private readonly cacheTtlMs = 30_000;

  private constructor() {
    // Singleton
  }

  public static getInstance(): ProviderRegistryService {
    if (!ProviderRegistryService.instance) {
      ProviderRegistryService.instance = new ProviderRegistryService();
    }

    return ProviderRegistryService.instance;
  }

  public async fetchCapabilities(forceRefresh = false): Promise<ProviderCapabilitiesMap> {
    const now = Date.now();
    if (
      !forceRefresh
      && this.cachedCapabilities
      && now - this.cachedAt < this.cacheTtlMs
    ) {
      return this.cachedCapabilities;
    }

    const capabilities: ProviderCapabilitiesMap = {
      openai: await getOpenAICapabilities(),
    };

    this.cachedCapabilities = capabilities;
    this.cachedAt = now;

    return capabilities;
  }
}

export const providerRegistryService = ProviderRegistryService.getInstance();
