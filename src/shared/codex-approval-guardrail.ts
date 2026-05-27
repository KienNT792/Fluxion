import {
  AgentNodeData,
  CodexApprovalProtocolStatus,
  CodexApprovalPolicy,
  CodexApprovalPolicyMode,
  CodexApprovalReviewer,
  CodexSandboxMode,
  CodexWindowsSandbox,
  NodeId,
  ProviderCapabilitiesMap
} from './workflow.types'

export type CodexApprovalGuardrailSeverity = 'ok' | 'warning' | 'blocked'

export interface CodexApprovalGuardrailNode {
  id: NodeId
  label?: string
  data?: Partial<AgentNodeData>
}

export interface CodexApprovalGuardrailResult {
  severity: CodexApprovalGuardrailSeverity
  summary: string
  message: string
  nodeId?: NodeId
  nodeLabel?: string
  approvalPolicy: CodexApprovalPolicy
  approvalPolicyMode: CodexApprovalPolicyMode | 'granular'
  approvalsReviewer?: CodexApprovalReviewer
  sandboxMode: CodexSandboxMode
  windowsSandbox?: CodexWindowsSandbox
}

export interface CodexApprovalGuardrailOptions {
  approvalProtocolStatus?: CodexApprovalProtocolStatus
}

const DEFAULT_APPROVAL_POLICY: CodexApprovalPolicy = 'never'
const DEFAULT_SANDBOX_MODE: CodexSandboxMode = 'workspace-write'
const DEFAULT_APPROVAL_PROTOCOL_STATUS: CodexApprovalProtocolStatus = 'unknown'

function getApprovalPolicyMode(policy: CodexApprovalPolicy): CodexApprovalPolicyMode | 'granular' {
  return typeof policy === 'string' ? policy : 'granular'
}

function formatApprovalPolicy(policy: CodexApprovalPolicy): string {
  if (typeof policy === 'string') {
    return policy
  }

  const enabledCategories = [
    policy.sandboxApproval ? 'sandbox_approval' : null,
    policy.rules ? 'rules' : null,
    policy.mcpElicitations ? 'mcp_elicitations' : null,
    policy.requestPermissions ? 'request_permissions' : null,
    policy.skillApproval ? 'skill_approval' : null
  ].filter(Boolean)

  return enabledCategories.length > 0
    ? `granular(${enabledCategories.join(', ')})`
    : 'granular(no interactive categories)'
}

function getDisplayName(node: CodexApprovalGuardrailNode): string {
  const dataLabel = typeof node.data?.label === 'string' ? node.data.label.trim() : ''
  const nodeLabel = typeof node.label === 'string' ? node.label.trim() : ''

  return dataLabel || nodeLabel || node.id
}

function createResult(
  node: CodexApprovalGuardrailNode,
  severity: CodexApprovalGuardrailSeverity,
  summary: string,
  message: string,
  approvalPolicy: CodexApprovalPolicy,
  approvalsReviewer: CodexApprovalReviewer | undefined,
  sandboxMode: CodexSandboxMode,
  windowsSandbox?: CodexWindowsSandbox
): CodexApprovalGuardrailResult {
  return {
    severity,
    summary,
    message,
    nodeId: node.id,
    nodeLabel: getDisplayName(node),
    approvalPolicy,
    approvalPolicyMode: getApprovalPolicyMode(approvalPolicy),
    approvalsReviewer,
    sandboxMode,
    windowsSandbox
  }
}

export function getNodeCodexApprovalGuardrail(
  node: CodexApprovalGuardrailNode,
  options: CodexApprovalGuardrailOptions = {}
): CodexApprovalGuardrailResult {
  const approvalPolicy = node.data?.codex?.approvalPolicy ?? DEFAULT_APPROVAL_POLICY
  const approvalsReviewer = node.data?.codex?.approvalsReviewer
  const sandboxMode = node.data?.codex?.sandboxMode ?? DEFAULT_SANDBOX_MODE
  const windowsSandbox = node.data?.codex?.windowsSandbox
  const nodeLabel = getDisplayName(node)
  const approvalProtocolStatus = options.approvalProtocolStatus ?? DEFAULT_APPROVAL_PROTOCOL_STATUS
  const approvalPolicyMode = getApprovalPolicyMode(approvalPolicy)
  const approvalPolicyLabel = formatApprovalPolicy(approvalPolicy)

  if (approvalPolicyMode === 'on-request' && approvalProtocolStatus !== 'supported') {
    return createResult(
      node,
      'blocked',
      `${nodeLabel}: approval_policy=on-request requires interactive approval support.`,
      `Node "${nodeLabel}" uses approval_policy=on-request. Codex works inside the sandbox by default and can ask when it needs to go beyond that boundary. Fluxion Phase 2A only allows interactive policies after a supported Codex approval protocol probe, but the current protocol status is ${approvalProtocolStatus}. Set approval policy to never before running this workflow.`,
      approvalPolicy,
      approvalsReviewer,
      sandboxMode,
      windowsSandbox
    )
  }

  if (approvalPolicyMode === 'untrusted' && approvalProtocolStatus !== 'supported') {
    return createResult(
      node,
      'blocked',
      `${nodeLabel}: approval_policy=untrusted requires interactive approval support.`,
      `Node "${nodeLabel}" uses approval_policy=untrusted. Codex can ask before commands outside its trusted set. Fluxion Phase 2A only allows interactive policies after a supported Codex approval protocol probe, but the current protocol status is ${approvalProtocolStatus}. Set approval policy to never before running this workflow.`,
      approvalPolicy,
      approvalsReviewer,
      sandboxMode,
      windowsSandbox
    )
  }

  if (approvalPolicyMode === 'granular' && approvalProtocolStatus !== 'supported') {
    return createResult(
      node,
      'blocked',
      `${nodeLabel}: approval_policy=${approvalPolicyLabel} requires interactive approval support.`,
      `Node "${nodeLabel}" uses approval_policy=${approvalPolicyLabel}. Codex can surface approvals only for the enabled categories in this granular policy, but Fluxion cannot host those interactive prompts until approval protocol support is verified. The current protocol status is ${approvalProtocolStatus}. Switch this node to approval_policy=never for non-interactive runs, or complete the approval-hosting work first.`,
      approvalPolicy,
      approvalsReviewer,
      sandboxMode,
      windowsSandbox
    )
  }

  if (sandboxMode === 'danger-full-access') {
    return createResult(
      node,
      'warning',
      `${nodeLabel}: sandbox_mode=danger-full-access is high risk.`,
      `Node "${nodeLabel}" uses sandbox_mode=danger-full-access with approval_policy=${approvalPolicyLabel}. Codex runs without sandbox restrictions, so keep this limited to trusted workspaces.`,
      approvalPolicy,
      approvalsReviewer,
      sandboxMode,
      windowsSandbox
    )
  }

  if (sandboxMode === 'read-only') {
    return createResult(
      node,
      'warning',
      `${nodeLabel}: sandbox_mode=read-only may prevent writes.`,
      `Node "${nodeLabel}" uses sandbox_mode=read-only with approval_policy=${approvalPolicyLabel}. This is allowed, but edits and write commands may fail.`,
      approvalPolicy,
      approvalsReviewer,
      sandboxMode,
      windowsSandbox
    )
  }

  if (approvalPolicyMode === 'granular') {
    return createResult(
      node,
      'warning',
      `${nodeLabel}: approval_policy=${approvalPolicyLabel} is only partially surfaced in Fluxion.`,
      `Node "${nodeLabel}" uses approval_policy=${approvalPolicyLabel}${
        approvalsReviewer ? ` with approvals_reviewer=${approvalsReviewer}` : ''
      }. The runtime policy is valid, but Fluxion does not yet expose every approval category separately in the workflow UX.`,
      approvalPolicy,
      approvalsReviewer,
      sandboxMode,
      windowsSandbox
    )
  }

  return createResult(
    node,
    'ok',
    `${nodeLabel}: Codex permissions are runnable.`,
    approvalPolicyMode === 'never'
      ? `Node "${nodeLabel}" uses approval_policy=never. Codex does not stop for approval prompts, which matches Fluxion's non-interactive runner.`
      : `Node "${nodeLabel}" uses approval_policy=${approvalPolicyLabel}${
          approvalsReviewer ? ` with approvals_reviewer=${approvalsReviewer}` : ''
        }, and Fluxion has a supported Codex approval protocol status for interactive policies.`,
    approvalPolicy,
    approvalsReviewer,
    sandboxMode,
    windowsSandbox
  )
}

export function getWorkflowCodexApprovalGuardrail(
  nodes: readonly CodexApprovalGuardrailNode[],
  options: CodexApprovalGuardrailOptions = {}
): CodexApprovalGuardrailResult {
  const nodeResults = nodes.map((node) => getNodeCodexApprovalGuardrail(node, options))
  const blocked = nodeResults.find((result) => result.severity === 'blocked')
  if (blocked) {
    return blocked
  }

  const warning = nodeResults.find((result) => result.severity === 'warning')
  if (warning) {
    return warning
  }

  return {
    severity: 'ok',
    summary: 'Codex permissions are runnable.',
    message:
      'All nodes use approval_policy=never or an interactive policy with supported approval protocol status. Codex does not stop for approval prompts when approval_policy=never.',
    approvalPolicy: DEFAULT_APPROVAL_POLICY,
    approvalPolicyMode: 'never',
    sandboxMode: DEFAULT_SANDBOX_MODE
  }
}

export function getProviderCodexApprovalProtocolStatus(
  capabilities?: ProviderCapabilitiesMap | null
): CodexApprovalProtocolStatus {
  return capabilities?.codex?.approvalProtocol?.status ?? DEFAULT_APPROVAL_PROTOCOL_STATUS
}
