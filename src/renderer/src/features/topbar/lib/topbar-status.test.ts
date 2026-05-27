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
      'policy',
      'mcp',
      'activity',
      'permissions'
    ])
  })

  it('summarizes config issues in the policy row', () => {
    const state = getAggregateReadinessState({
      ...baseOptions,
      codexReadiness: {
        ...baseOptions.codexReadiness,
        label: 'Config warning',
        actionItems: [
          {
            id: 'ignored-project-overrides',
            kind: 'config',
            severity: 'warning',
            title: 'Project config is not fully active',
            detail: 'Workspace trust is still gating project config.'
          }
        ]
      }
    })

    const policyRow = state.rows.find((row) => row.id === 'policy')
    expect(policyRow).toMatchObject({
      tone: 'warning',
      value: '1 config issue',
      detail: 'Project config is not fully active'
    })
    expect(state.label).toBe('Config warning')
  })

  it('elevates blocked MCP issues into the aggregate label and MCP row', () => {
    const state = getAggregateReadinessState({
      ...baseOptions,
      codexReadiness: {
        ...baseOptions.codexReadiness,
        label: 'MCP warning',
        summary: '1 required MCP server is not ready.',
        actionItems: [
          {
            id: 'mcp-blocked-repo',
            kind: 'mcp',
            severity: 'blocked',
            title: 'repo is blocking expected MCP capability',
            detail: 'Probe failed with exit code 1'
          }
        ]
      }
    })

    const mcpRow = state.rows.find((row) => row.id === 'mcp')
    expect(mcpRow).toMatchObject({
      tone: 'error',
      value: '1 MCP blocker',
      detail: 'repo is blocking expected MCP capability'
    })
    expect(state.label).toBe('MCP blocked')
    expect(state.tone).toBe('error')
    expect(state.detail).toBe('Probe failed with exit code 1')
  })
})
