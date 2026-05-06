import { execFile } from 'child_process';
import {
  CODEX_DEFAULT_MODEL,
  CODEX_DEFAULT_REASONING_LEVEL,
  CODEX_REASONING_LEVELS,
  OPENAI_DEFAULT_MODEL,
  OPENAI_DEFAULT_REASONING_LEVEL,
  OPENAI_MVP_MODELS,
  ProviderCapabilities,
  ProviderCapabilitiesMap,
  ProviderModel,
  ProviderParameterSpec,
  ProviderReadinessState,
  ReasoningLevel,
} from '@shared';
import { settingsService } from './settings.service';
import {
  CODEX_CLI_NOT_FOUND_MESSAGE,
  ResolvedCodexCli,
  resolveCodexCliCandidates,
} from '../runners/codex-cli-resolver';

const OPENAI_MODELS_TIMEOUT_MS = 10_000;
const CODEX_MODELS_TIMEOUT_MS = 10_000;
const EXEC_FILE_MAX_BUFFER = 1024 * 1024;

const OPENAI_PARAMETERS: ProviderParameterSpec[] = [
  {
    id: 'reasoningLevel',
    label: 'Reasoning Effort',
    type: 'select',
    defaultValue: OPENAI_DEFAULT_REASONING_LEVEL,
    appliesTo: 'reasoning-models',
    options: CODEX_REASONING_LEVELS.map((level) => ({
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

const CODEX_PARAMETERS: ProviderParameterSpec[] = [
  {
    id: 'reasoningLevel',
    label: 'Reasoning Effort',
    type: 'select',
    defaultValue: CODEX_DEFAULT_REASONING_LEVEL,
    appliesTo: 'reasoning-models',
    options: CODEX_REASONING_LEVELS.map((level) => ({
      value: level,
      label: level,
    })),
  },
];

interface OpenAIModelListResponse {
  data?: Array<{
    id?: unknown;
  }>;
}

interface CodexDebugReasoningLevel {
  effort?: unknown;
}

export interface CodexDebugModel {
  slug?: unknown;
  display_name?: unknown;
  description?: unknown;
  visibility?: unknown;
  supported_in_api?: unknown;
  default_reasoning_level?: unknown;
  supported_reasoning_levels?: unknown;
}

interface CodexDebugModelsResponse {
  models?: CodexDebugModel[];
}

interface ExecFileResult {
  stdout: string;
  stderr: string;
}

interface ExecFileErrorWithOutput extends Error {
  code?: string;
  stdout?: string;
  stderr?: string;
}

interface CodexCapabilitiesDependencies {
  resolveCli?: () => Promise<ResolvedCodexCli[]>;
  runCommand?: (
    command: string,
    args: string[]
  ) => Promise<ExecFileResult>;
}

interface CodexCommandAttemptResult {
  result?: ExecFileResult;
  error?: unknown;
}

interface CodexDiscoveryContext {
  cliCandidates: ResolvedCodexCli[];
  runCommand: (command: string, args: string[]) => Promise<ExecFileResult>;
}

function normalizeResolvedCliCandidates(
  candidateOrCandidates: ResolvedCodexCli | ResolvedCodexCli[]
): ResolvedCodexCli[] {
  return Array.isArray(candidateOrCandidates) ? candidateOrCandidates : [candidateOrCandidates];
}

function createExecFileRunner(
  timeoutMs = CODEX_MODELS_TIMEOUT_MS
): (command: string, args: string[]) => Promise<ExecFileResult> {
  return (command, args) =>
    new Promise((resolve, reject) => {
      execFile(
        command,
        args,
        {
          encoding: 'utf8',
          windowsHide: true,
          timeout: timeoutMs,
          maxBuffer: EXEC_FILE_MAX_BUFFER,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(Object.assign(error, { stdout, stderr }));
            return;
          }

          resolve({ stdout, stderr });
        }
      );
    });
}

function getErrorOutput(error: unknown): { stdout: string; stderr: string } {
  if (typeof error !== 'object' || error === null) {
    return { stdout: '', stderr: '' };
  }

  const maybeError = error as ExecFileErrorWithOutput;
  return {
    stdout: typeof maybeError.stdout === 'string' ? maybeError.stdout : '',
    stderr: typeof maybeError.stderr === 'string' ? maybeError.stderr : '',
  };
}

function getErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as ExecFileErrorWithOutput).code)
    : undefined;
}

function shouldTryNextCandidate(error: unknown): boolean {
  const code = getErrorCode(error);
  return code === 'EPERM' || code === 'EACCES' || code === 'EINVAL' || code === 'ENOENT';
}

function buildCodexReadiness(
  code: ProviderReadinessState['code'],
  overrides: Partial<Omit<ProviderReadinessState, 'code'>> = {}
): ProviderReadinessState {
  const defaults: Record<ProviderReadinessState['code'], ProviderReadinessState> = {
    ready: {
      code: 'ready',
      blocking: false,
      title: 'Codex CLI ready.',
      message: 'Fluxion can run workflows through the local Codex CLI.',
      catalogSource: 'live',
    },
    cli_missing: {
      code: 'cli_missing',
      blocking: true,
      title: 'Codex CLI not found.',
      message:
        'Install @openai/codex in Windows and make sure the codex command is visible to this app.',
      actionCommand: 'npm i -g @openai/codex',
      catalogSource: 'none',
    },
    auth_missing: {
      code: 'auth_missing',
      blocking: true,
      title: 'Codex CLI is not logged in.',
      message: 'Run codex login, then refresh Codex readiness in Fluxion.',
      actionCommand: 'codex login',
      catalogSource: 'none',
    },
    auth_unknown: {
      code: 'auth_unknown',
      blocking: false,
      title: 'Codex auth status could not be confirmed.',
      message: 'Fluxion will still try to use Codex, but run codex login status if execution fails.',
      actionCommand: 'codex login status',
      catalogSource: 'none',
    },
    catalog_failed: {
      code: 'catalog_failed',
      blocking: false,
      title: 'Codex model catalog could not be loaded.',
      message: 'Fluxion will preserve custom model slugs, but the model picker cannot show live Codex models.',
      actionCommand: 'codex debug models',
      catalogSource: 'none',
    },
  };

  return {
    ...defaults[code],
    ...overrides,
    code,
  };
}

export function isCodexAuthMissingMessage(message: string): boolean {
  return /(codex login|not authenticated|authentication|required login|please log in)/i.test(
    message
  );
}

function toReasoningLevels(input: unknown): ReasoningLevel[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const levels = input
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }

      if (typeof item === 'object' && item !== null && 'effort' in item) {
        return String((item as CodexDebugReasoningLevel).effort ?? '');
      }

      return '';
    })
    .filter(
      (value): value is ReasoningLevel =>
        value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh'
    );

  return [...new Set(levels)];
}

export function mapCodexDebugModelToProviderModel(model: CodexDebugModel): ProviderModel | null {
  if (typeof model.slug !== 'string' || model.slug.trim().length === 0) {
    return null;
  }

  const supportedReasoningLevels = toReasoningLevels(model.supported_reasoning_levels);
  const defaultReasoningLevel =
    typeof model.default_reasoning_level === 'string'
      ? model.default_reasoning_level
      : undefined;

  return {
    id: model.slug,
    displayName:
      typeof model.display_name === 'string' && model.display_name.trim().length > 0
        ? model.display_name
        : model.slug,
    description:
      typeof model.description === 'string' && model.description.trim().length > 0
        ? model.description
        : undefined,
    visibility:
      typeof model.visibility === 'string' && model.visibility.trim().length > 0
        ? model.visibility
        : 'list',
    supportedInApi:
      typeof model.supported_in_api === 'boolean' ? model.supported_in_api : undefined,
    supportedReasoningLevels,
    defaultReasoningLevel:
      defaultReasoningLevel && supportedReasoningLevels.includes(defaultReasoningLevel as ReasoningLevel)
        ? defaultReasoningLevel
        : supportedReasoningLevels[0],
  };
}

export function parseCodexDebugModelsOutput(output: string): ProviderModel[] {
  const payload = JSON.parse(output) as CodexDebugModelsResponse;
  if (!Array.isArray(payload.models)) {
    throw new Error('Codex model discovery returned an invalid payload.');
  }

  return payload.models
    .map(mapCodexDebugModelToProviderModel)
    .filter((model): model is ProviderModel => model !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
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
  const apiKey = await settingsService.resolveOpenAIApiKey();
  const settingsSummary = await settingsService.getProviderSettingsSummary();
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
        message: 'Set the OpenAI API key in Global Settings or via OPENAI_API_KEY.',
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
        envVar:
          settingsSummary.openaiApiKeySource === 'env' ? 'OPENAI_API_KEY' : undefined,
        message:
          settingsSummary.openaiApiKeySource === 'stored'
            ? 'Configured in Fluxion Global Settings.'
            : undefined,
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
        envVar:
          settingsSummary.openaiApiKeySource === 'env' ? 'OPENAI_API_KEY' : undefined,
        message:
          settingsSummary.openaiApiKeySource === 'stored'
            ? 'Configured in Fluxion Global Settings, but live model discovery failed.'
            : 'API key exists, but live model discovery failed.',
      },
      error: error instanceof Error ? error.message : 'Failed to fetch OpenAI models.',
      models: fallbackModels,
      defaultModel: OPENAI_DEFAULT_MODEL,
      parameters: OPENAI_PARAMETERS,
      refreshHint: 'Uses OpenAI /v1/models for live model discovery.',
    };
  }
}

async function createCodexDiscoveryContext(
  dependencies: CodexCapabilitiesDependencies = {}
): Promise<CodexDiscoveryContext> {
  const resolveCli = dependencies.resolveCli ?? resolveCodexCliCandidates;
  const runCommand = dependencies.runCommand ?? createExecFileRunner();
  const cliCandidates = normalizeResolvedCliCandidates(await resolveCli());

  return {
    cliCandidates,
    runCommand,
  };
}

async function runCodexCommandAcrossCandidates(
  context: CodexDiscoveryContext,
  args: string[]
): Promise<CodexCommandAttemptResult> {
  let lastError: unknown;

  for (const cliCandidate of context.cliCandidates) {
    try {
      return {
        result: await context.runCommand(cliCandidate.command, [...cliCandidate.argsPrefix, ...args]),
      };
    } catch (error) {
      lastError = error;
      if (!shouldTryNextCandidate(error)) {
        break;
      }
    }
  }

  return {
    error: lastError ?? new Error(CODEX_CLI_NOT_FOUND_MESSAGE),
  };
}

export async function getCodexCapabilities(
  dependencies: CodexCapabilitiesDependencies = {}
): Promise<ProviderCapabilities> {
  try {
    const discoveryContext = await createCodexDiscoveryContext(dependencies);
    const loginStatus = await runCodexCommandAcrossCandidates(discoveryContext, [
      'login',
      'status',
    ]);

    let authStatus: ProviderCapabilities['auth']['status'] = 'authenticated';
    let authWarning: string | undefined;

    if (loginStatus.error) {
      const { stdout, stderr } = getErrorOutput(loginStatus.error);
      const combinedOutput = `${stderr}\n${stdout}`.trim()
        || (loginStatus.error instanceof Error ? loginStatus.error.message : '');

      if (isCodexAuthMissingMessage(combinedOutput)) {
        const readiness = buildCodexReadiness('auth_missing');
        return {
          provider: 'codex',
          displayName: 'Codex',
          available: true,
          auth: {
            type: 'cli-login',
            status: 'missing',
            loginCommand: 'codex login',
            message: readiness.message,
          },
          readiness,
          error: combinedOutput || readiness.message,
          models: [],
          parameters: CODEX_PARAMETERS,
          refreshHint: 'Run `codex login`, then refresh Codex readiness.',
        };
      }

      authStatus = 'unknown';
      authWarning = combinedOutput || 'Codex auth status could not be confirmed.';
    }

    const liveCatalog = await runCodexCommandAcrossCandidates(discoveryContext, [
      'debug',
      'models',
    ]);
    let catalogResult = liveCatalog.result;
    let catalogSource: ProviderReadinessState['catalogSource'] = 'live';
    let catalogError = liveCatalog.error;

    if (!catalogResult) {
      const bundledCatalog = await runCodexCommandAcrossCandidates(discoveryContext, [
        'debug',
        'models',
        '--bundled',
      ]);
      catalogResult = bundledCatalog.result;
      catalogError = bundledCatalog.error ?? catalogError;
      catalogSource = catalogResult ? 'bundled' : 'none';
    }

    if (!catalogResult) {
      const { stdout, stderr } = getErrorOutput(catalogError);
      const combinedOutput = `${stderr}\n${stdout}`.trim();
      const errorMessage =
        combinedOutput
        || (catalogError instanceof Error ? catalogError.message : 'Codex model discovery failed.');
      const readiness = buildCodexReadiness(
        authStatus === 'unknown' ? 'auth_unknown' : 'catalog_failed',
        {
          message:
            authStatus === 'unknown'
              ? `${authWarning} Catalog discovery also failed: ${errorMessage}`
              : errorMessage,
          catalogSource: 'none',
        }
      );

      return {
        provider: 'codex',
        displayName: 'Codex',
        available: true,
        auth: {
          type: 'cli-login',
          status: authStatus,
          loginCommand: 'codex login',
          message: authWarning,
        },
        readiness,
        error: errorMessage,
        models: [],
        parameters: CODEX_PARAMETERS,
        refreshHint: 'Uses `codex login status` and `codex debug models` for readiness.',
      };
    }

    const models = parseCodexDebugModelsOutput(catalogResult.stdout);
    const defaultModel =
      models.find((model) => model.id === CODEX_DEFAULT_MODEL)?.id
      ?? models.find((model) => model.visibility !== 'hide')?.id
      ?? models[0]?.id;
    const catalogMessage =
      catalogSource === 'bundled'
        ? 'Live model discovery failed, so Fluxion is using the bundled Codex catalog.'
        : 'Fluxion can run workflows through the local Codex CLI.';
    const readiness =
      authStatus === 'unknown'
        ? buildCodexReadiness('auth_unknown', {
            message: authWarning ?? 'Codex auth status could not be confirmed.',
            catalogSource,
          })
        : buildCodexReadiness('ready', {
            message: catalogMessage,
            catalogSource,
            ...(catalogSource === 'bundled'
              ? { title: 'Codex bundled catalog loaded.' }
              : {}),
          });

    return {
      provider: 'codex',
      displayName: 'Codex',
      available: true,
      auth: {
        type: 'cli-login',
        status: authStatus,
        loginCommand: 'codex login',
        message:
          authWarning
          ?? (catalogResult.stderr.trim().length > 0 ? catalogResult.stderr.trim() : undefined),
      },
      readiness,
      models,
      defaultModel,
      parameters: CODEX_PARAMETERS,
      refreshHint: 'Uses `codex login status` and `codex debug models` for readiness.',
    };
  } catch (error) {
    const { stdout, stderr } = getErrorOutput(error);
    const combinedOutput = `${stderr}\n${stdout}`.trim();

    if (
      error instanceof Error &&
      (error.message.includes(CODEX_CLI_NOT_FOUND_MESSAGE) || getErrorCode(error) === 'ENOENT')
    ) {
      const readiness = buildCodexReadiness('cli_missing');
      return {
        provider: 'codex',
        displayName: 'Codex',
        available: false,
        auth: {
          type: 'cli-login',
          status: 'missing',
          loginCommand: 'codex login',
          message: readiness.message,
        },
        readiness,
        error: CODEX_CLI_NOT_FOUND_MESSAGE,
        models: [],
        parameters: CODEX_PARAMETERS,
        refreshHint: 'Install @openai/codex in Windows, then refresh Codex readiness.',
      };
    }

    if (combinedOutput && isCodexAuthMissingMessage(combinedOutput)) {
      const readiness = buildCodexReadiness('auth_missing');
      return {
        provider: 'codex',
        displayName: 'Codex',
        available: true,
        auth: {
          type: 'cli-login',
          status: 'missing',
          loginCommand: 'codex login',
          message: readiness.message,
        },
        readiness,
        error: combinedOutput,
        models: [],
        parameters: CODEX_PARAMETERS,
        refreshHint: 'Run `codex login`, then refresh Codex readiness.',
      };
    }

    const readiness = buildCodexReadiness('catalog_failed', {
      message: combinedOutput || (error instanceof Error ? error.message : 'Codex model discovery failed.'),
    });

    return {
      provider: 'codex',
      displayName: 'Codex',
      available: true,
      auth: {
        type: 'cli-login',
        status: 'unknown',
        loginCommand: 'codex login',
        message: combinedOutput || 'Codex model discovery failed.',
      },
      readiness,
      error:
        combinedOutput
        || (error instanceof Error ? error.message : 'Codex model discovery failed.'),
      models: [],
      parameters: CODEX_PARAMETERS,
      refreshHint: 'Uses `codex login status` and `codex debug models` for readiness.',
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

    const [codex, openai] = await Promise.all([
      getCodexCapabilities(),
      getOpenAICapabilities(),
    ]);

    const capabilities: ProviderCapabilitiesMap = {
      codex,
      openai,
    };

    this.cachedCapabilities = capabilities;
    this.cachedAt = now;

    return capabilities;
  }

  public invalidateCache(): void {
    this.cachedCapabilities = null;
    this.cachedAt = 0;
  }
}

export const providerRegistryService = ProviderRegistryService.getInstance();
