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
      runCommand: async () => ({
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
      }),
    });

    expect(capabilities.available).toBe(true);
    expect(capabilities.auth.status).toBe('authenticated');
    expect(capabilities.defaultModel).toBe('gpt-5.5');
    expect(capabilities.models.map((model) => model.id)).toEqual(['gpt-5.4-mini', 'gpt-5.5']);
  });
});
