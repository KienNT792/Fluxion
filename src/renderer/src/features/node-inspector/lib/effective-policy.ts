import type { CompiledContextDiagnostics, CodexReasoningSummary, CodexVerbosity, ModelId } from '@shared'

export function describeStringOverride(
  value: string | undefined,
  workflowFallback: string | undefined,
  defaultLabel: string,
  overrideLabel = 'node'
): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return `${value} (${overrideLabel})`
  }

  if (typeof workflowFallback === 'string' && workflowFallback.trim().length > 0) {
    return `${workflowFallback} (workflow)`
  }

  return `${defaultLabel} (default)`
}

export function describeBooleanOverride(
  value: boolean | undefined,
  workflowFallback: boolean | undefined,
  defaultValue: boolean
): string {
  if (typeof value === 'boolean') {
    return `${value ? 'true' : 'false'} (node)`
  }

  if (typeof workflowFallback === 'boolean') {
    return `${workflowFallback ? 'true' : 'false'} (workflow)`
  }

  return `${defaultValue ? 'true' : 'false'} (default)`
}

export function buildRuntimePolicyLines(input: {
  model?: string
  effectiveReviewModel?: string
  effectiveServiceTier?: string
  effectiveModelVerbosity?: CodexVerbosity
  effectiveModelReasoningSummary?: CodexReasoningSummary
  effectiveHideAgentReasoning?: boolean
  effectiveShowRawAgentReasoning?: boolean
}): string[] {
  const effectiveModel = input.model ?? 'n/a'
  const reviewModel = input.effectiveReviewModel ?? effectiveModel

  return [
    `run_model = ${effectiveModel}`,
    `review_model = ${reviewModel}`,
    `service_tier = ${input.effectiveServiceTier ?? 'Codex default'}`,
    `model_verbosity = ${input.effectiveModelVerbosity ?? 'model default'}`,
    `model_reasoning_summary = ${input.effectiveModelReasoningSummary ?? 'model default'}`,
    `hide_agent_reasoning = ${input.effectiveHideAgentReasoning ? 'true' : 'false'}`,
    `show_raw_agent_reasoning = ${input.effectiveShowRawAgentReasoning ? 'true' : 'false'}`
  ]
}

export function buildRuntimePolicyLinesFromDiagnostics(
  diagnostics?: CompiledContextDiagnostics
): string[] {
  return buildRuntimePolicyLines({
    model: diagnostics?.model,
    effectiveReviewModel: diagnostics?.effectiveReviewModel,
    effectiveServiceTier: diagnostics?.effectiveServiceTier,
    effectiveModelVerbosity: diagnostics?.effectiveModelVerbosity,
    effectiveModelReasoningSummary: diagnostics?.effectiveModelReasoningSummary,
    effectiveHideAgentReasoning: diagnostics?.effectiveHideAgentReasoning,
    effectiveShowRawAgentReasoning: diagnostics?.effectiveShowRawAgentReasoning
  })
}

export function buildRuntimePolicySummaryFromDiagnostics(
  diagnostics?: CompiledContextDiagnostics
): { headline: string; detail: string } {
  const runModel = diagnostics?.model ?? 'n/a'
  const reviewModel = diagnostics?.effectiveReviewModel ?? runModel
  const serviceTier = diagnostics?.effectiveServiceTier ?? 'Codex default'
  const verbosity = diagnostics?.effectiveModelVerbosity ?? 'model default'
  const reasoningSummary = diagnostics?.effectiveModelReasoningSummary ?? 'model default'
  const reasoningVisibility = diagnostics?.effectiveHideAgentReasoning
    ? 'reasoning hidden in output'
    : diagnostics?.effectiveShowRawAgentReasoning
      ? 'raw reasoning visible when emitted'
      : 'reasoning visibility uses defaults'

  const headline =
    reviewModel !== runModel
      ? `Run ${runModel} with review ${reviewModel}`
      : `Run and review both use ${runModel}`

  const detail = [
    `service tier ${serviceTier}`,
    `verbosity ${verbosity}`,
    `reasoning summary ${reasoningSummary}`,
    reasoningVisibility
  ].join(' | ')

  return { headline, detail }
}

export function describeReviewModelFallback(
  currentReviewModel: ModelId | undefined,
  workflowReviewModel: ModelId | undefined
): string {
  return describeStringOverride(currentReviewModel, workflowReviewModel, 'run model')
}
