import React from 'react'
import { AlertTriangle } from 'lucide-react'
import type {
  CodexApprovalPolicy,
  CodexApprovalReviewer,
  CodexGranularApprovalPolicy,
  CodexSandboxMode
} from '@shared'
import { Select } from '@renderer/components/ui/Select'
import { InspectorSection as Section } from './InspectorSection'
import { LABEL_STYLE } from '../lib/inspector-styles'

interface NodeApprovalGuardrailView {
  message: string
  severity: 'ok' | 'warning' | 'blocked'
}

interface CodexPermissionsSectionProps {
  approvalPolicy: CodexApprovalPolicy
  approvalsReviewer?: CodexApprovalReviewer
  nodeApprovalGuardrail: NodeApprovalGuardrailView
  onApprovalPolicyChange: (value: CodexApprovalPolicy) => void
  onApprovalsReviewerChange: (value?: CodexApprovalReviewer) => void
  onSandboxModeChange: (value: CodexSandboxMode) => void
  onWindowsSandboxChange: (value: string) => void
  sandboxMode: CodexSandboxMode
  windowsSandbox: string
}

function getApprovalPolicyMode(value: CodexApprovalPolicy): 'never' | 'on-request' | 'untrusted' | 'granular' {
  return typeof value === 'string' ? value : 'granular'
}

function getGranularApprovalPolicy(value: CodexApprovalPolicy): CodexGranularApprovalPolicy {
  return typeof value === 'string' ? { kind: 'granular' } : value
}

export const CodexPermissionsSection: React.FC<CodexPermissionsSectionProps> = ({
  approvalPolicy,
  approvalsReviewer,
  nodeApprovalGuardrail,
  onApprovalPolicyChange,
  onApprovalsReviewerChange,
  onSandboxModeChange,
  onWindowsSandboxChange,
  sandboxMode,
  windowsSandbox
}) => {
  const approvalPolicyMode = getApprovalPolicyMode(approvalPolicy)
  const granularPolicy = getGranularApprovalPolicy(approvalPolicy)

  const updateGranularPolicy = (key: keyof Omit<CodexGranularApprovalPolicy, 'kind'>, checked: boolean) => {
    onApprovalPolicyChange({
      ...granularPolicy,
      kind: 'granular',
      [key]: checked
    })
  }

  return (
    <Section title="Permissions">
      <div>
        <label style={LABEL_STYLE}>Sandbox Mode</label>
        <Select
          value={sandboxMode}
          onChange={(event) => onSandboxModeChange(event.target.value as CodexSandboxMode)}
        >
          <option value="read-only">read-only</option>
          <option value="workspace-write">workspace-write</option>
          <option value="danger-full-access">danger-full-access</option>
        </Select>
      </div>

      <div>
        <label style={LABEL_STYLE}>Approval Policy</label>
        <Select
          value={approvalPolicyMode}
          onChange={(event) => {
            const nextMode = event.target.value as 'never' | 'on-request' | 'untrusted' | 'granular'
            onApprovalPolicyChange(nextMode === 'granular' ? { kind: 'granular' } : nextMode)
          }}
          invalid={nodeApprovalGuardrail.severity === 'blocked'}
        >
          <option value="never">never</option>
          <option value="on-request">on-request</option>
          <option value="untrusted">untrusted</option>
          <option value="granular">granular</option>
        </Select>
      </div>

      {approvalPolicyMode !== 'never' && (
        <div>
          <label style={LABEL_STYLE}>Approvals Reviewer</label>
          <Select
            value={approvalsReviewer ?? ''}
            onChange={(event) =>
              onApprovalsReviewerChange(
                event.target.value ? (event.target.value as CodexApprovalReviewer) : undefined
              )
            }
          >
            <option value="">Default</option>
            <option value="user">user</option>
            <option value="auto_review">auto_review</option>
          </Select>
        </div>
      )}

      {approvalPolicyMode === 'granular' && (
        <div
          className="grid gap-2 rounded-md px-3 py-3"
          style={{
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-canvas)'
          }}
        >
          {[
            ['sandboxApproval', 'sandbox_approval'],
            ['rules', 'rules'],
            ['mcpElicitations', 'mcp_elicitations'],
            ['requestPermissions', 'request_permissions'],
            ['skillApproval', 'skill_approval']
          ].map(([key, label]) => (
            <label
              key={key}
              className="flex items-center justify-between gap-3 text-xs"
              style={{ color: 'var(--color-body)' }}
            >
              <span style={{ fontFamily: 'var(--font-mono)' }}>{label}</span>
              <input
                type="checkbox"
                checked={Boolean(granularPolicy[key as keyof Omit<CodexGranularApprovalPolicy, 'kind'>])}
                onChange={(event) =>
                  updateGranularPolicy(
                    key as keyof Omit<CodexGranularApprovalPolicy, 'kind'>,
                    event.target.checked
                  )
                }
              />
            </label>
          ))}
        </div>
      )}

      <div>
        <label style={LABEL_STYLE}>Windows Sandbox</label>
        <Select
          value={windowsSandbox}
          onChange={(event) => onWindowsSandboxChange(event.target.value)}
        >
          <option value="">Default</option>
          <option value="unelevated">unelevated</option>
          <option value="elevated">elevated</option>
        </Select>
      </div>

      {nodeApprovalGuardrail.severity !== 'ok' && (
        <div
          className="rounded-md px-3 py-2"
          style={{
            background: 'var(--color-surface-card)',
            border:
              nodeApprovalGuardrail.severity === 'blocked'
                ? '1px solid var(--color-semantic-error)'
                : '1px solid var(--color-timeline-done)'
          }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={15}
              className="mt-0.5 shrink-0"
              style={{
                color:
                  nodeApprovalGuardrail.severity === 'blocked'
                    ? 'var(--color-semantic-error)'
                    : 'var(--color-timeline-done)'
              }}
            />
            <div className="min-w-0">
              {nodeApprovalGuardrail.severity === 'blocked' && (
                <p className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
                  Interactive Codex approval requires a supported Fluxion approval-host path.
                </p>
              )}
              <p
                className={`${nodeApprovalGuardrail.severity === 'blocked' ? 'mt-2' : ''} text-xs leading-5`}
                style={{ color: 'var(--color-body)' }}
              >
                {nodeApprovalGuardrail.message}
              </p>
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}
