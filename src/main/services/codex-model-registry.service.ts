import { execFile } from 'child_process';
import { promisify } from 'util';
import { CodexCapabilities, ProviderModel } from '@shared';
import { CodexAdapter } from '../adapters/codex.adapter';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 10 * 1024 * 1024;

interface RawCodexReasoningLevel {
  effort?: unknown;
}

interface RawCodexModel {
  slug?: unknown;
  display_name?: unknown;
  description?: unknown;
  visibility?: unknown;
  supported_in_api?: unknown;
  default_reasoning_level?: unknown;
  supported_reasoning_levels?: unknown;
  support_verbosity?: unknown;
  default_verbosity?: unknown;
  context_window?: unknown;
  max_context_window?: unknown;
  input_modalities?: unknown;
}

interface RawCodexModelsResponse {
  models?: unknown;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return items.length > 0 ? items : undefined;
}

function normalizeReasoningLevels(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'object' && item !== null ? (item as RawCodexReasoningLevel).effort : undefined))
    .filter((effort): effort is string => typeof effort === 'string' && effort.trim().length > 0);
}

function normalizeModel(rawModel: RawCodexModel): ProviderModel | null {
  const id = asString(rawModel.slug);
  if (!id) {
    return null;
  }

  const inputModalities = asStringArray(rawModel.input_modalities);

  return {
    id,
    displayName: asString(rawModel.display_name) ?? id,
    description: asString(rawModel.description),
    visibility: asString(rawModel.visibility) ?? 'list',
    supportedInApi:
      typeof rawModel.supported_in_api === 'boolean' ? rawModel.supported_in_api : undefined,
    supportedReasoningLevels: normalizeReasoningLevels(rawModel.supported_reasoning_levels),
    defaultReasoningLevel: asString(rawModel.default_reasoning_level),
    supportVerbosity:
      typeof rawModel.support_verbosity === 'boolean' ? rawModel.support_verbosity : undefined,
    defaultVerbosity: asString(rawModel.default_verbosity),
    contextWindow: asNumber(rawModel.context_window),
    maxContextWindow: asNumber(rawModel.max_context_window),
    inputModalities,
    supportsImages: inputModalities?.includes('image') ?? false,
  };
}

export class CodexModelRegistryService {
  private static instance: CodexModelRegistryService;
  private cachedCapabilities: CodexCapabilities | null = null;
  private cachedAt = 0;
  private readonly cacheTtlMs = 30_000;

  private constructor() {
    // Singleton
  }

  public static getInstance(): CodexModelRegistryService {
    if (!CodexModelRegistryService.instance) {
      CodexModelRegistryService.instance = new CodexModelRegistryService();
    }
    return CodexModelRegistryService.instance;
  }

  public async fetchCapabilities(forceRefresh = false): Promise<CodexCapabilities> {
    const requirements = CodexAdapter.checkRequirements();

    if (!requirements.available) {
      return {
        available: false,
        version: requirements.version,
        error: requirements.error,
        models: [],
      };
    }

    const now = Date.now();
    if (
      !forceRefresh
      && this.cachedCapabilities
      && now - this.cachedAt < this.cacheTtlMs
    ) {
      return this.cachedCapabilities;
    }

    try {
      const { stdout, stderr } = await execFileAsync('codex', ['debug', 'models'], {
        encoding: 'utf-8',
        maxBuffer: MAX_BUFFER,
        windowsHide: true,
      });
      const stdoutText = String(stdout);
      const stderrText = String(stderr);

      if (stderrText.trim()) {
        console.warn('Codex model discovery stderr:', stderrText.trim());
      }

      const parsed = JSON.parse(stdoutText) as RawCodexModelsResponse;
      if (!Array.isArray(parsed.models)) {
        throw new Error('Codex debug models returned an invalid payload.');
      }

      const models = parsed.models
        .map((item) =>
          typeof item === 'object' && item !== null
            ? normalizeModel(item as RawCodexModel)
            : null
        )
        .filter((model): model is ProviderModel => model !== null);

      const capabilities: CodexCapabilities = {
        available: true,
        version: requirements.version,
        models,
      };

      this.cachedCapabilities = capabilities;
      this.cachedAt = now;

      return capabilities;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to discover Codex models.';

      return {
        available: true,
        version: requirements.version,
        error: errorMessage,
        models: [],
      };
    }
  }
}

export const codexModelRegistryService = CodexModelRegistryService.getInstance();
