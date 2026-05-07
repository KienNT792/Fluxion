import {
  AgentNodeData,
  CodexApprovalProtocolStatus,
  CodexApprovalPolicy,
  CodexSandboxMode,
  CodexWindowsSandbox,
  NodeId,
  ProviderCapabilitiesMap,
} from './workflow.types';

export type CodexApprovalGuardrailSeverity = 'ok' | 'warning' | 'blocked';

export interface CodexApprovalGuardrailNode {
  id: NodeId;
  label?: string;
  data?: Partial<AgentNodeData>;
}

export interface CodexApprovalGuardrailResult {
  severity: CodexApprovalGuardrailSeverity;
  summary: string;
  message: string;
  nodeId?: NodeId;
  nodeLabel?: string;
  approvalPolicy: CodexApprovalPolicy;
  sandboxMode: CodexSandboxMode;
  windowsSandbox?: CodexWindowsSandbox;
}

export interface CodexApprovalGuardrailOptions {
  approvalProtocolStatus?: CodexApprovalProtocolStatus;
}

const DEFAULT_APPROVAL_POLICY: CodexApprovalPolicy = 'never';
const DEFAULT_SANDBOX_MODE: CodexSandboxMode = 'workspace-write';
const DEFAULT_APPROVAL_PROTOCOL_STATUS: CodexApprovalProtocolStatus = 'unknown';

function getDisplayName(node: CodexApprovalGuardrailNode): string {
  const dataLabel = typeof node.data?.label === 'string' ? node.data.label.trim() : '';
  const nodeLabel = typeof node.label === 'string' ? node.label.trim() : '';

  return dataLabel || nodeLabel || node.id;
}

function createResult(
  node: CodexApprovalGuardrailNode,
  severity: CodexApprovalGuardrailSeverity,
  summary: string,
  message: string,
  approvalPolicy: CodexApprovalPolicy,
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
    sandboxMode,
    windowsSandbox,
  };
}

export function getNodeCodexApprovalGuardrail(
  node: CodexApprovalGuardrailNode,
  options: CodexApprovalGuardrailOptions = {}
): CodexApprovalGuardrailResult {
  const approvalPolicy = node.data?.codex?.approvalPolicy ?? DEFAULT_APPROVAL_POLICY;
  const sandboxMode = node.data?.codex?.sandboxMode ?? DEFAULT_SANDBOX_MODE;
  const windowsSandbox = node.data?.codex?.windowsSandbox;
  const nodeLabel = getDisplayName(node);
  const approvalProtocolStatus =
    options.approvalProtocolStatus ?? DEFAULT_APPROVAL_PROTOCOL_STATUS;

  if (approvalPolicy === 'on-request' && approvalProtocolStatus !== 'supported') {
    return createResult(
      node,
      'blocked',
      `${nodeLabel}: approval_policy=on-request requires interactive approval support.`,
      `Node "${nodeLabel}" uses approval_policy=on-request. Codex works inside the sandbox by default and can ask when it needs to go beyond that boundary. Fluxion Phase 2A only allows interactive policies after a supported Codex approval protocol probe, but the current protocol status is ${approvalProtocolStatus}. Set approval policy to never before running this workflow.`,
      approvalPolicy,
      sandboxMode,
      windowsSandbox
    );
  }

  if (approvalPolicy === 'untrusted' && approvalProtocolStatus !== 'supported') {
    return createResult(
      node,
      'blocked',
      `${nodeLabel}: approval_policy=untrusted requires interactive approval support.`,
      `Node "${nodeLabel}" uses approval_policy=untrusted. Codex can ask before commands outside its trusted set. Fluxion Phase 2A only allows interactive policies after a supported Codex approval protocol probe, but the current protocol status is ${approvalProtocolStatus}. Set approval policy to never before running this workflow.`,
      approvalPolicy,
      sandboxMode,
      windowsSandbox
    );
  }

  if (sandboxMode === 'danger-full-access') {
    return createResult(
      node,
      'warning',
      `${nodeLabel}: sandbox_mode=danger-full-access is high risk.`,
      `Node "${nodeLabel}" uses sandbox_mode=danger-full-access with approval_policy=${approvalPolicy}. Codex runs without sandbox restrictions, so keep this limited to trusted workspaces.`,
      approvalPolicy,
      sandboxMode,
      windowsSandbox
    );
  }

  if (sandboxMode === 'read-only') {
    return createResult(
      node,
      'warning',
      `${nodeLabel}: sandbox_mode=read-only may prevent writes.`,
      `Node "${nodeLabel}" uses sandbox_mode=read-only with approval_policy=${approvalPolicy}. This is allowed, but edits and write commands may fail.`,
      approvalPolicy,
      sandboxMode,
      windowsSandbox
    );
  }

  return createResult(
    node,
    'ok',
    `${nodeLabel}: Codex permissions are runnable.`,
    approvalPolicy === 'never'
      ? `Node "${nodeLabel}" uses approval_policy=never. Codex does not stop for approval prompts, which matches Fluxion's non-interactive runner.`
      : `Node "${nodeLabel}" uses approval_policy=${approvalPolicy}, and Fluxion has a supported Codex approval protocol status for interactive policies.`,
    approvalPolicy,
    sandboxMode,
    windowsSandbox
  );
}

export function getWorkflowCodexApprovalGuardrail(
  nodes: readonly CodexApprovalGuardrailNode[],
  options: CodexApprovalGuardrailOptions = {}
): CodexApprovalGuardrailResult {
  const nodeResults = nodes.map((node) => getNodeCodexApprovalGuardrail(node, options));
  const blocked = nodeResults.find((result) => result.severity === 'blocked');
  if (blocked) {
    return blocked;
  }

  const warning = nodeResults.find((result) => result.severity === 'warning');
  if (warning) {
    return warning;
  }

  return {
    severity: 'ok',
    summary: 'Codex permissions are runnable.',
    message:
      'All nodes use approval_policy=never or an interactive policy with supported approval protocol status. Codex does not stop for approval prompts when approval_policy=never.',
    approvalPolicy: DEFAULT_APPROVAL_POLICY,
    sandboxMode: DEFAULT_SANDBOX_MODE,
  };
}

export function getProviderCodexApprovalProtocolStatus(
  capabilities?: ProviderCapabilitiesMap | null
): CodexApprovalProtocolStatus {
  return capabilities?.codex?.approvalProtocol?.status ?? DEFAULT_APPROVAL_PROTOCOL_STATUS;
}
