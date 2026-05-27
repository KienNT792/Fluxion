import { describe, expect, it } from 'vitest'
import type { CompiledContextDiagnostics } from '@shared'
import {
  buildRuntimePolicyLines,
  buildRuntimePolicySummaryFromDiagnostics,
  describeBooleanOverride,
  describeReviewModelFallback,
  describeStringOverride
} from './effective-policy'

describe('effective policy helpers', () => {
  it('describes string override precedence across node, workflow, and default', () => {
    expect(describeStringOverride('gpt-5.5', 'gpt-5', 'run model')).toBe('gpt-5.5 (node)')
    expect(describeStringOverride(undefined, 'gpt-5', 'run model')).toBe('gpt-5 (workflow)')
    expect(describeStringOverride(undefined, undefined, 'run model')).toBe('run model (default)')
  })

  it('describes boolean override precedence across node, workflow, and default', () => {
    expect(describeBooleanOverride(true, false, false)).toBe('true (node)')
    expect(describeBooleanOverride(undefined, true, false)).toBe('true (workflow)')
    expect(describeBooleanOverride(undefined, undefined, false)).toBe('false (default)')
  })

  it('describes review-model fallback to run model when no override exists', () => {
    expect(describeReviewModelFallback(undefined, undefined)).toBe('run model (default)')
    expect(describeReviewModelFallback(undefined, 'gpt-5')).toBe('gpt-5 (workflow)')
  })

  it('builds runtime policy lines with stable default wording', () => {
    expect(
      buildRuntimePolicyLines({
        model: 'gpt-5.5',
        effectiveReviewModel: 'gpt-5',
        effectiveHideAgentReasoning: true,
        effectiveShowRawAgentReasoning: false
      })
    ).toEqual([
      'run_model = gpt-5.5',
      'review_model = gpt-5',
      'service_tier = Codex default',
      'model_verbosity = model default',
      'model_reasoning_summary = model default',
      'hide_agent_reasoning = true',
      'show_raw_agent_reasoning = false'
    ])
  })

  it('builds runtime policy summary that highlights run/review divergence and visibility posture', () => {
    expect(
      buildRuntimePolicySummaryFromDiagnostics({
        model: 'gpt-5.5',
        effectiveReviewModel: 'gpt-5',
        effectiveServiceTier: 'priority',
        effectiveModelVerbosity: 'high',
        effectiveModelReasoningSummary: 'detailed',
        effectiveHideAgentReasoning: false,
        effectiveShowRawAgentReasoning: true
      } as Partial<CompiledContextDiagnostics> as CompiledContextDiagnostics)
    ).toEqual({
      headline: 'Run gpt-5.5 with review gpt-5',
      detail:
        'service tier priority | verbosity high | reasoning summary detailed | raw reasoning visible when emitted'
    })
  })
})
