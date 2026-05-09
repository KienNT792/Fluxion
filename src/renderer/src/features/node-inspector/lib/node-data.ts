import { z } from 'zod'
import { AgentNodeData, ProviderCapabilitiesMap, WorkflowNode } from '@shared'
import { getDefaultCodexModel } from '@renderer/lib/provider-capabilities'

export function coerceNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return fallback
}

export function coerceOptionalPositiveInteger(value: unknown): number | undefined {
  const parsed = coerceNumber(value, Number.NaN)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }

  return Math.floor(parsed)
}

const codexExecutionOptionsSchema = z
  .object({
    json: z.boolean().optional(),
    sandboxMode: z.enum(['read-only', 'workspace-write', 'danger-full-access']).optional(),
    approvalPolicy: z.enum(['never', 'on-request', 'untrusted']).optional(),
    windowsSandbox: z.enum(['unelevated', 'elevated']).optional(),
    profile: z.string().optional(),
    config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
  })
  .optional()

export const nodeDataSchema = z
  .object({
    provider: z.literal('codex'),
    model: z.string().min(1),
    label: z.string().optional(),
    prompt: z.string(),
    systemInstruction: z.string().optional(),
    humanReview: z.boolean().optional(),
    maxTokens: z.preprocess(coerceOptionalPositiveInteger, z.number().optional()),
    temperature: z.preprocess(
      (value) => coerceNumber(value, 0.7),
      z.number().min(0).max(2).optional()
    ),
    reasoningLevel: z.enum(['low', 'medium', 'high', 'xhigh']).optional(),
    codex: codexExecutionOptionsSchema
  })
  .passthrough()

export function buildEditableNodeData(
  selectedNode: { data: WorkflowNode['data'] },
  providerCapabilities: ProviderCapabilitiesMap
): Partial<AgentNodeData> {
  return {
    provider: 'codex',
    model:
      typeof selectedNode.data.model === 'string' && selectedNode.data.model.trim()
        ? selectedNode.data.model
        : getDefaultCodexModel(providerCapabilities),
    label: selectedNode.data.label,
    prompt: typeof selectedNode.data.prompt === 'string' ? selectedNode.data.prompt : '',
    systemInstruction:
      typeof selectedNode.data.systemInstruction === 'string'
        ? selectedNode.data.systemInstruction
        : '',
    humanReview: Boolean(selectedNode.data.humanReview),
    maxTokens: coerceOptionalPositiveInteger(selectedNode.data.maxTokens),
    temperature:
      typeof selectedNode.data.temperature === 'number' ? selectedNode.data.temperature : undefined,
    reasoningLevel: selectedNode.data.reasoningLevel,
    codex: selectedNode.data.codex
  }
}
