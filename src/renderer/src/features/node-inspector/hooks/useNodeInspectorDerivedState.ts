import type {
  AgentNodeData,
  CodexApprovalPolicy,
  CodexExecutionOptions,
  CodexSandboxMode,
  ModelId,
  ProviderCapabilitiesMap,
  ReasoningLevel,
  WorkflowNode
} from '@shared'
import { getNodeCodexApprovalGuardrail, getProviderCodexApprovalProtocolStatus } from '@shared'
import {
  getCodexCapabilities,
  getCodexModelById,
  getCodexModelDisplayName,
  getCodexReadinessBadgeState,
  getDefaultCodexModel,
  modelSupportsReasoning
} from '@renderer/lib/provider-capabilities'
import { buildModelOptions, ModelOption, summarizeLongText, TextSummary } from '../lib/node-display'

interface UseNodeInspectorDerivedStateOptions {
  executionMode: 'auto' | 'manual'
  localData: Partial<AgentNodeData>
  providerCapabilities: ProviderCapabilitiesMap
  selectedNode: {
    id: string
    data: WorkflowNode['data']
  }
  selectedNodeId: string
}

interface NodeApprovalGuardrailView {
  message: string
  severity: 'ok' | 'warning' | 'blocked'
}

export interface NodeInspectorDerivedState {
  currentApprovalPolicy: CodexApprovalPolicy
  currentCodexOptions: CodexExecutionOptions
  currentDefaultReasoningLevel?: ReasoningLevel
  currentModel: ModelId
  currentModelCapabilities: ReturnType<typeof getCodexModelById>
  currentModelDisplayName: string
  currentSandboxMode: CodexSandboxMode
  currentWindowsSandbox: string
  isReasoningModel: boolean
  modelOptions: ModelOption[]
  nodeApprovalGuardrail: NodeApprovalGuardrailView
  promptSummary: TextSummary
  providerNote: string
  reasoningOptions: ReasoningLevel[]
  reviewModeNote: string
  systemInstructionSummary: TextSummary
}

export function useNodeInspectorDerivedState({
  executionMode,
  localData,
  providerCapabilities,
  selectedNode,
  selectedNodeId
}: UseNodeInspectorDerivedStateOptions): NodeInspectorDerivedState {
  const codexCapabilities = getCodexCapabilities(providerCapabilities)
  const currentModel = String(
    localData.model ?? selectedNode.data.model ?? getDefaultCodexModel(providerCapabilities)
  ) as ModelId
  const visibleModels = (codexCapabilities?.models ?? [])
    .filter((model) => model.visibility !== 'hide')
    .map((model) => ({
      id: model.id,
      label: model.displayName,
      description: model.description
    }))
  const modelOptions = buildModelOptions(currentModel, visibleModels)
  const currentModelCapabilities = getCodexModelById(providerCapabilities, currentModel)
  const currentModelDisplayName = getCodexModelDisplayName(providerCapabilities, currentModel)
  const currentCodexOptions: CodexExecutionOptions = {
    ...(selectedNode.data.codex ?? {}),
    ...(localData.codex ?? {})
  }
  const currentSandboxMode: CodexSandboxMode = currentCodexOptions.sandboxMode ?? 'workspace-write'
  const currentApprovalPolicy: CodexApprovalPolicy = currentCodexOptions.approvalPolicy ?? 'never'
  const currentWindowsSandbox = currentCodexOptions.windowsSandbox ?? ''
  const nodeApprovalGuardrail = getNodeCodexApprovalGuardrail(
    {
      id: selectedNodeId,
      label: String(localData.label ?? selectedNode.data.label ?? currentModelDisplayName),
      data: {
        label: typeof localData.label === 'string' ? localData.label : selectedNode.data.label,
        codex: currentCodexOptions
      }
    },
    {
      approvalProtocolStatus: getProviderCodexApprovalProtocolStatus(providerCapabilities)
    }
  )
  const reasoningOptions = (currentModelCapabilities?.supportedReasoningLevels ?? []).filter(
    (level): level is ReasoningLevel =>
      level === 'low' || level === 'medium' || level === 'high' || level === 'xhigh'
  )
  const isReasoningModel = modelSupportsReasoning(currentModelCapabilities)
  const authState = codexCapabilities?.auth
  const readiness = getCodexReadinessBadgeState(providerCapabilities, [currentModel])
  const modelDescription =
    currentModelCapabilities?.description ??
    modelOptions.find((option) => option.id === currentModel)?.description
  const providerNote = [
    readiness.summary,
    modelDescription,
    authState
      ? `Auth: ${authState.status}${authState.envVar ? ` via ${authState.envVar}` : ''}.`
      : undefined,
    readiness.detail,
    codexCapabilities?.error ?? authState?.message
  ]
    .filter(Boolean)
    .join(' ')
  const reviewModeNote =
    executionMode === 'manual'
      ? 'Manual mode pauses every completed node. This checkbox only matters when the workflow returns to Auto.'
      : 'Auto mode continues immediately unless this node explicitly requires review.'

  return {
    currentApprovalPolicy,
    currentCodexOptions,
    currentDefaultReasoningLevel: currentModelCapabilities?.defaultReasoningLevel as
      | ReasoningLevel
      | undefined,
    currentModel,
    currentModelCapabilities,
    currentModelDisplayName,
    currentSandboxMode,
    currentWindowsSandbox,
    isReasoningModel,
    modelOptions,
    nodeApprovalGuardrail,
    promptSummary: summarizeLongText(
      localData.prompt,
      'No prompt configured. Add instructions before running this node.'
    ),
    providerNote,
    reasoningOptions,
    reviewModeNote,
    systemInstructionSummary: summarizeLongText(
      localData.systemInstruction,
      'No node-level override. Workspace/global rules will apply.'
    )
  }
}
