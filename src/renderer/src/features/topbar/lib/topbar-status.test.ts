import { describe, expect, it } from 'vitest'
import { getAggregateReadinessState, type AggregateReadinessOptions } from './topbar-status'

const baseOptions: AggregateReadinessOptions = {
  activityHasAttention: false,
  activitySummaryLabel: 'No recent file changes',
  approvalGuardrail: {
    severity: 'ok',
    summary: 'Codex permissions are runnable.',
    message: 'Codex permissions are runnable.'
  },
  codexReadiness: {
    blocking: false,
    detail: 'Codex is ready.',
    label: 'Ready',
    summary: 'Codex is ready.'
  },
  contextChipState: {
    label: 'Context Ready',
    tone: 'success',
    detail: 'Project context is ready.'
  },
  hasExternalWorkflowChange: false,
  readinessTone: 'success',
  saveChipState: {
    label: 'Saved',
    tone: 'success'
  },
  saveStateLabel: 'Saved recently',
  workflowChipLabel: 'Ready',
  workflowChipState: {
    label: 'Ready',
    tone: 'idle'
  },
  workflowStatus: 'idle'
}

describe('getAggregateReadinessState', () => {
  it('prioritizes active workflow states', () => {
    const state = getAggregateReadinessState({
      ...baseOptions,
      contextChipState: {
        label: 'Context Missing',
        tone: 'error',
        detail: 'Context missing.'
      },
      workflowChipLabel: 'Executing 4s',
      workflowChipState: {
        label: 'Executing',
        tone: 'running',
        animate: true
      },
      workflowStatus: 'running'
    })

    expect(state.label).toBe('Workflow running')
    expect(state.animate).toBe(true)
  })

  it('surfaces permission blockers before readiness warnings', () => {
    const state = getAggregateReadinessState({
      ...baseOptions,
      approvalGuardrail: {
        severity: 'blocked',
        summary: 'Approval policy blocks this workflow.',
        message: 'Approval policy blocks this workflow.'
      },
      codexReadiness: {
        blocking: true,
        detail: 'Codex missing.',
        label: 'Missing',
        summary: 'Codex missing.'
      },
      readinessTone: 'error'
    })

    expect(state.label).toBe('Permission blocked')
    expect(state.tone).toBe('error')
  })

  it('returns ready when all rows are healthy', () => {
    const state = getAggregateReadinessState(baseOptions)

    expect(state.label).toBe('Ready')
    expect(state.rows.map((row) => row.id)).toEqual([
      'workflow',
      'save',
      'context',
      'codex',
      'activity',
      'permissions'
    ])
  })
})
