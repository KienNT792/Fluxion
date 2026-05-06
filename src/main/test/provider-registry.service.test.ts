import { describe, expect, it } from 'vitest';
import {
  getCodexCapabilities,
  parseCodexDebugModelsOutput,
} from '../services/provider-registry.service';

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
              { effort: 'xhigh' },
            ],
          },
        ],
      })
    );

    expect(models).toEqual([
      {
        id: 'gpt-5.5',
        displayName: 'GPT-5.5',
        description: 'Top-end model',
        visibility: 'list',
        supportedInApi: true,
        supportedReasoningLevels: ['low', 'medium', 'high', 'xhigh'],
        defaultReasoningLevel: 'medium',
      },
    ]);
  });

  it('returns unavailable when the Codex CLI cannot be resolved', async () => {
    const capabilities = await getCodexCapabilities({
      resolveCli: async () => {
        throw new Error('Codex CLI not found. Install @openai/codex and run codex login.');
      },
    });

    expect(capabilities.available).toBe(false);
    expect(capabilities.auth.status).toBe('missing');
    expect(capabilities.readiness).toMatchObject({
      code: 'cli_missing',
      blocking: true,
    });
    expect(capabilities.models).toEqual([]);
  });

  it('returns auth missing when discovery requires codex login', async () => {
    const capabilities = await getCodexCapabilities({
      resolveCli: async () => [
        {
          command: 'codex',
          argsPrefix: [],
          displayCommand: 'codex',
          source: 'direct',
        },
      ],
      runCommand: async () => {
        throw Object.assign(new Error('not authenticated'), {
          stderr: 'Please run codex login to continue.',
          stdout: '',
        });
      },
    });

    expect(capabilities.available).toBe(true);
    expect(capabilities.auth.status).toBe('missing');
    expect(capabilities.readiness).toMatchObject({
      code: 'auth_missing',
      blocking: true,
    });
    expect(capabilities.models).toEqual([]);
  });

  it('returns authenticated codex capabilities from debug models output', async () => {
    const capabilities = await getCodexCapabilities({
      resolveCli: async () => [
        {
          command: 'codex',
          argsPrefix: [],
          displayCommand: 'codex',
          source: 'direct',
        },
      ],
      runCommand: async (_command, args) => {
        if (args.join(' ') === 'login status') {
          return { stdout: 'Logged in', stderr: '' };
        }

        return {
          stdout: JSON.stringify({
            models: [
              {
                slug: 'gpt-5.4-mini',
                display_name: 'GPT-5.4-Mini',
                visibility: 'list',
                supported_reasoning_levels: [{ effort: 'low' }, { effort: 'medium' }],
              },
              {
                slug: 'gpt-5.5',
                display_name: 'GPT-5.5',
                visibility: 'list',
                default_reasoning_level: 'medium',
                supported_reasoning_levels: [{ effort: 'medium' }, { effort: 'high' }],
              },
            ],
          }),
          stderr: '',
        };
      },
    });

    expect(capabilities.available).toBe(true);
    expect(capabilities.auth.status).toBe('authenticated');
    expect(capabilities.readiness).toMatchObject({
      code: 'ready',
      blocking: false,
      catalogSource: 'live',
    });
    expect(capabilities.defaultModel).toBe('gpt-5.5');
    expect(capabilities.models.map((model) => model.id)).toEqual(['gpt-5.4-mini', 'gpt-5.5']);
  });

  it('reuses the first working Codex CLI candidate across discovery commands', async () => {
    const calls: string[] = [];
    const capabilities = await getCodexCapabilities({
      resolveCli: async () => [
        {
          command: 'blocked-codex',
          argsPrefix: [],
          displayCommand: 'blocked-codex',
          source: 'direct',
        },
        {
          command: 'working-codex',
          argsPrefix: [],
          displayCommand: 'working-codex',
          source: 'direct',
        },
      ],
      runCommand: async (command, args) => {
        calls.push(`${command} ${args.join(' ')}`);

        if (command === 'blocked-codex') {
          throw Object.assign(new Error('permission denied'), {
            code: 'EACCES',
            stderr: '',
            stdout: '',
          });
        }

        if (args.join(' ') === 'login status') {
          return { stdout: 'Logged in', stderr: '' };
        }

        return {
          stdout: JSON.stringify({
            models: [{ slug: 'gpt-5.5', display_name: 'GPT-5.5', visibility: 'list' }],
          }),
          stderr: '',
        };
      },
    });

    expect(capabilities.readiness).toMatchObject({
      code: 'ready',
      blocking: false,
    });
    expect(calls).toEqual([
      'blocked-codex login status',
      'working-codex login status',
      'working-codex debug models',
    ]);
  });

  it('keeps running non-blocking when auth status is unknown but catalog loads', async () => {
    const capabilities = await getCodexCapabilities({
      resolveCli: async () => [
        {
          command: 'codex',
          argsPrefix: [],
          displayCommand: 'codex',
          source: 'direct',
        },
      ],
      runCommand: async (_command, args) => {
        if (args.join(' ') === 'login status') {
          throw Object.assign(new Error('status failed'), {
            stderr: 'Unexpected auth status failure.',
            stdout: '',
          });
        }

        return {
          stdout: JSON.stringify({
            models: [{ slug: 'gpt-5.5', display_name: 'GPT-5.5', visibility: 'list' }],
          }),
          stderr: '',
        };
      },
    });

    expect(capabilities.auth.status).toBe('unknown');
    expect(capabilities.readiness).toMatchObject({
      code: 'auth_unknown',
      blocking: false,
      catalogSource: 'live',
    });
    expect(capabilities.models.map((model) => model.id)).toEqual(['gpt-5.5']);
  });

  it('falls back to the bundled catalog when live model discovery fails', async () => {
    const capabilities = await getCodexCapabilities({
      resolveCli: async () => [
        {
          command: 'codex',
          argsPrefix: [],
          displayCommand: 'codex',
          source: 'direct',
        },
      ],
      runCommand: async (_command, args) => {
        const commandLine = args.join(' ');
        if (commandLine === 'login status') {
          return { stdout: 'Logged in', stderr: '' };
        }

        if (commandLine === 'debug models') {
          throw Object.assign(new Error('network failed'), {
            stderr: 'Could not refresh model catalog.',
            stdout: '',
          });
        }

        return {
          stdout: JSON.stringify({
            models: [{ slug: 'gpt-5.4-mini', display_name: 'GPT-5.4-Mini', visibility: 'list' }],
          }),
          stderr: '',
        };
      },
    });

    expect(capabilities.readiness).toMatchObject({
      code: 'ready',
      blocking: false,
      catalogSource: 'bundled',
    });
    expect(capabilities.models.map((model) => model.id)).toEqual(['gpt-5.4-mini']);
  });

  it('returns a non-blocking catalog failure when auth is valid but discovery fails', async () => {
    const capabilities = await getCodexCapabilities({
      resolveCli: async () => [
        {
          command: 'codex',
          argsPrefix: [],
          displayCommand: 'codex',
          source: 'direct',
        },
      ],
      runCommand: async (_command, args) => {
        if (args.join(' ') === 'login status') {
          return { stdout: 'Logged in', stderr: '' };
        }

        throw Object.assign(new Error('catalog failed'), {
          stderr: 'Catalog unavailable.',
          stdout: '',
        });
      },
    });

    expect(capabilities.auth.status).toBe('authenticated');
    expect(capabilities.readiness).toMatchObject({
      code: 'catalog_failed',
      blocking: false,
      catalogSource: 'none',
    });
    expect(capabilities.models).toEqual([]);
  });
});
