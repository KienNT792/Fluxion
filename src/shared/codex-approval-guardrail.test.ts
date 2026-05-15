import { describe, expect, it } from 'vitest'
import {
  getNodeCodexApprovalGuardrail,
  getWorkflowCodexApprovalGuardrail
} from './codex-approval-guardrail'
import { WorkflowNode } from './workflow.types'

function createNode(
  data: WorkflowNode['data'] = { provider: 'codex', model: 'gpt-5.5', prompt: '' }
): WorkflowNode {
  return {
    id: 'node-a',
    type: 'agentNode',
    label: 'Analyze',
    data,
    position: { x: 0, y: 0 }
  }
}

describe('Codex approval guardrail', () => {
  it('allows missing Codex config by defaulting to workspace-write and never', () => {
    const result = getNodeCodexApprovalGuardrail(createNode())

    expect(result).toMatchObject({
      severity: 'ok',
      approvalPolicy: 'never',
      sandboxMode: 'workspace-write'
    })
  })

  it('blocks on-request approval policy', () => {
    const result = getNodeCodexApprovalGuardrail(
      createNode({
        provider: 'codex',
        model: 'gpt-5.5',
        prompt: '',
        codex: { approvalPolicy: 'on-request' }
      })
    )

    expect(result.severity).toBe('blocked')
    expect(result.message).toContain('approval_policy=on-request')
    expect(result.message).toContain('go beyond that boundary')
  })

  it('blocks on-request approval policy when protocol status is unsupported', () => {
    const result = getNodeCodexApprovalGuardrail(
      createNode({
        provider: 'codex',
        model: 'gpt-5.5',
        prompt: '',
        codex: { approvalPolicy: 'on-request' }
      }),
      { approvalProtocolStatus: 'unsupported' }
    )

    expect(result.severity).toBe('blocked')
    expect(result.message).toContain('current protocol status is unsupported')
  })

  it('allows on-request approval policy when protocol status is supported', () => {
    const result = getNodeCodexApprovalGuardrail(
      createNode({
        provider: 'codex',
        model: 'gpt-5.5',
        prompt: '',
        codex: { approvalPolicy: 'on-request' }
      }),
      { approvalProtocolStatus: 'supported' }
    )

    expect(result).toMatchObject({
      severity: 'ok',
      approvalPolicy: 'on-request',
      sandboxMode: 'workspace-write'
    })
  })

  it('blocks untrusted approval policy', () => {
    const result = getNodeCodexApprovalGuardrail(
      createNode({
        provider: 'codex',
        model: 'gpt-5.5',
        prompt: '',
        codex: { approvalPolicy: 'untrusted' }
      })
    )

    expect(result.severity).toBe('blocked')
    expect(result.message).toContain('approval_policy=untrusted')
    expect(result.message).toContain('outside its trusted set')
  })

  it('allows untrusted approval policy when protocol status is supported', () => {
    const result = getNodeCodexApprovalGuardrail(
      createNode({
        provider: 'codex',
        model: 'gpt-5.5',
        prompt: '',
        codex: { approvalPolicy: 'untrusted' }
      }),
      { approvalProtocolStatus: 'supported' }
    )

    expect(result).toMatchObject({
      severity: 'ok',
      approvalPolicy: 'untrusted',
      sandboxMode: 'workspace-write'
    })
  })

  it('warns but allows danger-full-access when approval policy is never', () => {
    const result = getNodeCodexApprovalGuardrail(
      createNode({
        provider: 'codex',
        model: 'gpt-5.5',
        prompt: '',
        codex: {
          approvalPolicy: 'never',
          sandboxMode: 'danger-full-access'
        }
      })
    )

    expect(result).toMatchObject({
      severity: 'warning',
      approvalPolicy: 'never',
      sandboxMode: 'danger-full-access'
    })
    expect(result.message).toContain('without sandbox restrictions')
  })

  it('warns but allows read-only when approval policy is never', () => {
    const result = getNodeCodexApprovalGuardrail(
      createNode({
        provider: 'codex',
        model: 'gpt-5.5',
        prompt: '',
        codex: {
          approvalPolicy: 'never',
          sandboxMode: 'read-only'
        }
      })
    )

    expect(result).toMatchObject({
      severity: 'warning',
      approvalPolicy: 'never',
      sandboxMode: 'read-only'
    })
    expect(result.message).toContain('write commands may fail')
  })

  it('returns the first blocked workflow node before warnings', () => {
    const result = getWorkflowCodexApprovalGuardrail(
      [
        createNode({
          provider: 'codex',
          model: 'gpt-5.5',
          prompt: '',
          codex: {
            approvalPolicy: 'never',
            sandboxMode: 'danger-full-access'
          }
        }),
        {
          ...createNode({
            provider: 'codex',
            model: 'gpt-5.5',
            prompt: '',
            codex: { approvalPolicy: 'on-request' }
          }),
          id: 'node-b',
          label: 'Build'
        }
      ],
      { approvalProtocolStatus: 'unknown' }
    )

    expect(result).toMatchObject({
      severity: 'blocked',
      nodeId: 'node-b',
      nodeLabel: 'Build'
    })
  })

  it('allows workflow interactive policies when protocol status is supported', () => {
    const result = getWorkflowCodexApprovalGuardrail(
      [
        createNode({
          provider: 'codex',
          model: 'gpt-5.5',
          prompt: '',
          codex: { approvalPolicy: 'on-request' }
        })
      ],
      { approvalProtocolStatus: 'supported' }
    )

    expect(result.severity).toBe('ok')
  })
})
