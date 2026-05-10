import React from 'react'
import { AlertTriangle } from 'lucide-react'
import type { CodexApprovalPolicy, CodexSandboxMode } from '@shared'
import { Select } from '@renderer/components/ui/Select'
import { InspectorSection as Section } from './InspectorSection'
import { LABEL_STYLE } from '../lib/inspector-styles'

interface NodeApprovalGuardrailView {
  message: string
  severity: 'ok' | 'warning' | 'blocked'
}

interface CodexPermissionsSectionProps {
  approvalPolicy: CodexApprovalPolicy
  nodeApprovalGuardrail: NodeApprovalGuardrailView
  onApprovalPolicyChange: (value: CodexApprovalPolicy) => void
  onSandboxModeChange: (value: CodexSandboxMode) => void
  onWindowsSandboxChange: (value: string) => void
  sandboxMode: CodexSandboxMode
  windowsSandbox: string
}

export const CodexPermissionsSection: React.FC<CodexPermissionsSectionProps> = ({
  approvalPolicy,
  nodeApprovalGuardrail,
  onApprovalPolicyChange,
  onSandboxModeChange,
  onWindowsSandboxChange,
  sandboxMode,
  windowsSandbox
}) => (
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
        value={approvalPolicy}
        onChange={(event) => onApprovalPolicyChange(event.target.value as CodexApprovalPolicy)}
        invalid={nodeApprovalGuardrail.severity === 'blocked'}
      >
        <option value="never">never</option>
        <option value="on-request">on-request</option>
        <option value="untrusted">untrusted</option>
      </Select>
    </div>

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
                Interactive Codex approval requires a supported Phase 2A protocol probe. Set
                approval policy to never to run this workflow.
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
