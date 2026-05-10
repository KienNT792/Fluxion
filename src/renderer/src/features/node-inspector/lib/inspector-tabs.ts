import type { NodeStatus } from '@shared'

export type NodeInspectorTab = 'prompt' | 'run' | 'permissions' | 'output' | 'advanced'

export function getDefaultNodeInspectorTab(
  nodeStatus: NodeStatus,
  guardrailSeverity: 'ok' | 'warning' | 'blocked'
): NodeInspectorTab {
  if (nodeStatus === 'paused' || nodeStatus === 'error') {
    return 'output'
  }

  if (guardrailSeverity === 'warning' || guardrailSeverity === 'blocked') {
    return 'permissions'
  }

  return 'prompt'
}
