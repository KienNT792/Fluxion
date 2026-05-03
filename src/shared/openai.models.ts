import { ReasoningLevel } from './workflow.types';

export interface OpenAIModelPreset {
  id: string;
  displayName: string;
  description: string;
  supportsReasoning: boolean;
  supportedReasoningLevels: ReasoningLevel[];
}

export const OPENAI_DEFAULT_REASONING_LEVEL: ReasoningLevel = 'medium';

const OPENAI_REASONING_LEVELS: ReasoningLevel[] = ['low', 'medium', 'high', 'xhigh'];

export const OPENAI_MVP_MODELS: OpenAIModelPreset[] = [
  {
    id: 'gpt-5.4-mini',
    displayName: 'GPT-5.4 mini',
    description: 'Recommended default for fast, lower-cost workflow runs.',
    supportsReasoning: true,
    supportedReasoningLevels: OPENAI_REASONING_LEVELS,
  },
  {
    id: 'gpt-5.4',
    displayName: 'GPT-5.4',
    description: 'Higher-capability model for heavier coding and planning tasks.',
    supportsReasoning: true,
    supportedReasoningLevels: OPENAI_REASONING_LEVELS,
  },
  {
    id: 'gpt-5.5',
    displayName: 'GPT-5.5',
    description: 'Top-end OpenAI model for complex reasoning and coding.',
    supportsReasoning: true,
    supportedReasoningLevels: OPENAI_REASONING_LEVELS,
  },
  {
    id: 'gpt-4.1',
    displayName: 'GPT-4.1',
    description: 'Compatibility fallback for standard text generation.',
    supportsReasoning: false,
    supportedReasoningLevels: [],
  },
];

export const OPENAI_DEFAULT_MODEL = OPENAI_MVP_MODELS[0]?.id ?? 'gpt-5.4-mini';

export function getOpenAIModelPreset(modelId: string): OpenAIModelPreset | undefined {
  return OPENAI_MVP_MODELS.find((model) => model.id === modelId);
}

export function getOpenAIModelDisplayName(modelId: string): string {
  return getOpenAIModelPreset(modelId)?.displayName ?? modelId;
}

export function isOpenAIReasoningModel(modelId: string): boolean {
  return getOpenAIModelPreset(modelId)?.supportsReasoning ?? false;
}
