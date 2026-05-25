import {
  AgentNodeData,
  NodeId,
  ProviderCapabilities,
  ProviderCapabilitiesMap,
  ProviderType
} from './workflow.types'

export interface ProviderRuntimePreflightNode {
  id: NodeId
  label?: string
  data?: Partial<AgentNodeData>
}

export interface ProviderRuntimePreflightResult {
  ok: boolean
  message: string
  nodeId?: NodeId
  nodeLabel?: string
  provider?: string
}

const SUPPORTED_PROVIDERS = new Set<ProviderType>(['codex', 'openai'])

function getNodeLabel(node: ProviderRuntimePreflightNode): string {
  const dataLabel = typeof node.data?.label === 'string' ? node.data.label.trim() : ''
  const nodeLabel = typeof node.label === 'string' ? node.label.trim() : ''
  return dataLabel || nodeLabel || node.id
}

function createBlockedResult(
  node: ProviderRuntimePreflightNode,
  provider: string | undefined,
  message: string
): ProviderRuntimePreflightResult {
  return {
    ok: false,
    message,
    nodeId: node.id,
    nodeLabel: getNodeLabel(node),
    provider
  }
}

function validateCodexRuntime(
  node: ProviderRuntimePreflightNode,
  codexCapabilities: ProviderCapabilities | undefined
): ProviderRuntimePreflightResult | null {
  const nodeLabel = getNodeLabel(node)

  if (!codexCapabilities) {
    return createBlockedResult(
      node,
      'codex',
      `Node "${nodeLabel}" needs Codex readiness, but provider capabilities have not been loaded. Refresh provider readiness before running this workflow.`
    )
  }

  if (!codexCapabilities.available) {
    return createBlockedResult(
      node,
      'codex',
      `Node "${nodeLabel}" cannot run because Codex is unavailable. ${codexCapabilities.readiness?.message ?? codexCapabilities.error ?? 'Refresh Codex readiness and fix the local CLI setup.'}`
    )
  }

  if (codexCapabilities.auth.status === 'missing') {
    return createBlockedResult(
      node,
      'codex',
      `Node "${nodeLabel}" cannot run because Codex authentication is missing. ${codexCapabilities.auth.message ?? 'Run codex login, then refresh Codex readiness.'}`
    )
  }

  if (codexCapabilities.readiness?.blocking) {
    return createBlockedResult(
      node,
      'codex',
      `Node "${nodeLabel}" cannot run because Codex readiness is blocked. ${codexCapabilities.readiness.message}`
    )
  }

  return null
}

export function getWorkflowProviderRuntimePreflight(
  nodes: readonly ProviderRuntimePreflightNode[],
  capabilities: ProviderCapabilitiesMap | null | undefined
): ProviderRuntimePreflightResult {
  for (const node of nodes) {
    const provider = node.data?.provider
    const nodeLabel = getNodeLabel(node)

    if (typeof provider !== 'string' || provider.trim().length === 0) {
      return createBlockedResult(
        node,
        provider,
        `Node "${nodeLabel}" is missing a provider. Choose Codex before running the workflow.`
      )
    }

    if (!SUPPORTED_PROVIDERS.has(provider as ProviderType)) {
      return createBlockedResult(
        node,
        provider,
        `Node "${nodeLabel}" uses unsupported provider "${provider}". Supported providers are codex and openai.`
      )
    }

    const runner = node.data?.runner ?? 'codex'
    if (runner !== 'codex') {
      return createBlockedResult(
        node,
        provider,
        `Node "${nodeLabel}" uses runner "${runner}", but only the Codex runner is implemented for workflow execution.`
      )
    }

    if (provider === 'openai') {
      const openaiCapabilities = capabilities?.openai
      if (!openaiCapabilities) {
        return createBlockedResult(
          node,
          provider,
          `Node "${nodeLabel}" uses the OpenAI API provider, but provider capabilities have not been loaded. Refresh provider readiness before running this workflow.`
        )
      }

      if (!openaiCapabilities.available) {
        return createBlockedResult(
          node,
          provider,
          `Node "${nodeLabel}" cannot run because OpenAI is unavailable. ${openaiCapabilities.readiness?.message ?? openaiCapabilities.error ?? 'Refresh OpenAI readiness and check the API key setup.'}`
        )
      }

      if (openaiCapabilities.auth.status === 'missing') {
        return createBlockedResult(
          node,
          provider,
          `Node "${nodeLabel}" cannot run because the OpenAI API key is missing. ${openaiCapabilities.auth.message ?? 'Set OPENAI_API_KEY or configure the key in Global Settings.'}`
        )
      }

      if (openaiCapabilities.readiness?.blocking) {
        return createBlockedResult(
          node,
          provider,
          `Node "${nodeLabel}" cannot run because OpenAI readiness is blocked. ${openaiCapabilities.readiness.message}`
        )
      }
    }

    const codexBlocker = validateCodexRuntime(node, capabilities?.codex)
    if (codexBlocker) {
      return codexBlocker
    }
  }

  return {
    ok: true,
    message: 'Workflow provider/runtime configuration is runnable.'
  }
}
