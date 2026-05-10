import React, { useMemo, useRef, useState } from 'react'
import type { CodexExecutionOptions, CodexWindowsSandbox, WorkflowNode } from '@shared'
import { getCodexModelById, modelSupportsReasoning } from '@renderer/lib/provider-capabilities'
import { useExecutionStore } from '@renderer/stores/execution.store'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { AdvancedSection } from './components/AdvancedSection'
import { CodexPermissionsSection } from './components/CodexPermissionsSection'
import { InspectorHeader } from './components/InspectorHeader'
import { InstructionsSection } from './components/InstructionsSection'
import { NodeInspectorTabs } from './components/NodeInspectorTabs'
import { NodeTextEditors } from './components/NodeTextEditors'
import { OverviewSection } from './components/OverviewSection'
import { ParametersSection } from './components/ParametersSection'
import { ReviewBanner } from './components/ReviewBanner'
import { RuntimeErrorBanner } from './components/RuntimeErrorBanner'
import { RuntimeSection } from './components/RuntimeSection'
import { useEditableNodeData } from './hooks/useEditableNodeData'
import { useNodeInspectorEffects } from './hooks/useNodeInspectorEffects'
import { useNodeInspectorDerivedState } from './hooks/useNodeInspectorDerivedState'
import { getDefaultNodeInspectorTab, type NodeInspectorTab } from './lib/inspector-tabs'
import { getNextReasoningLevelForModel } from './lib/model-selection'

interface PropertiesPanelContentProps {
  selectedNode: {
    id: string
    data: WorkflowNode['data']
  }
  selectedNodeId: string
}

export const PropertiesPanel: React.FC = () => {
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId)
  const nodes = useWorkflowStore((state) => state.nodes)
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId),
    [nodes, selectedNodeId]
  )

  if (!selectedNodeId || !selectedNode) {
    return null
  }

  return (
    <PropertiesPanelContent
      key={selectedNodeId}
      selectedNode={selectedNode}
      selectedNodeId={selectedNodeId}
    />
  )
}

const PropertiesPanelContent: React.FC<PropertiesPanelContentProps> = ({
  selectedNode,
  selectedNodeId
}) => {
  const setSelectedNode = useWorkflowStore((state) => state.setSelectedNode)
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData)
  const deleteNode = useWorkflowStore((state) => state.deleteNode)
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities)
  const executionMode = useWorkflowStore((state) => state.executionMode)
  const workspacePath = useWorkflowStore((state) => state.workspacePath)
  const hasFetchedProviderCapabilities = useWorkflowStore(
    (state) => state.hasFetchedProviderCapabilities
  )
  const fetchProviderCapabilities = useWorkflowStore((state) => state.fetchProviderCapabilities)
  const reviewFocusRequest = useWorkflowStore((state) => state.reviewFocusRequest)
  const nodeStatus = useExecutionStore(
    (state) => (selectedNodeId ? state.nodeStatuses[selectedNodeId] : undefined) ?? 'idle'
  )
  const nodeError = useExecutionStore((state) =>
    selectedNodeId ? state.nodeErrors[selectedNodeId] : undefined
  )
  const nodeExitCode = useExecutionStore((state) =>
    selectedNodeId ? state.nodeExitCodes[selectedNodeId] : undefined
  )
  const nodeOutputPath = useExecutionStore((state) =>
    selectedNodeId ? state.nodeOutputPaths[selectedNodeId] : undefined
  )
  const nodeAttemptCount = useExecutionStore((state) =>
    selectedNodeId ? state.nodeAttemptCounts[selectedNodeId] : undefined
  )
  const reviewActionInFlight = useExecutionStore((state) =>
    selectedNodeId ? state.reviewActionInFlightByNodeId[selectedNodeId] : undefined
  )
  const setWorkflowError = useExecutionStore((state) => state.setWorkflowError)
  const workflowStatus = useExecutionStore((state) => state.workflowStatus)
  const { localData, setLocalData } = useEditableNodeData({
    providerCapabilities,
    selectedNode,
    selectedNodeId,
    updateNodeData
  })
  const [activeTextEditor, setActiveTextEditor] = useState<'prompt' | 'systemInstruction' | null>(
    null
  )
  const reviewSectionRef = useRef<HTMLDivElement | null>(null)

  useNodeInspectorEffects({
    fetchProviderCapabilities,
    hasFetchedProviderCapabilities,
    reviewFocusRequest,
    reviewSectionRef,
    selectedNodeId
  })

  const {
    currentApprovalPolicy,
    currentDefaultReasoningLevel,
    currentModel,
    currentModelDisplayName,
    currentSandboxMode,
    currentWindowsSandbox,
    isReasoningModel,
    modelOptions,
    nodeApprovalGuardrail,
    promptSummary,
    providerNote,
    reasoningOptions,
    reviewModeNote,
    systemInstructionSummary
  } = useNodeInspectorDerivedState({
    executionMode,
    localData,
    providerCapabilities,
    selectedNode,
    selectedNodeId
  })
  const defaultInspectorTab = getDefaultNodeInspectorTab(
    nodeStatus,
    nodeApprovalGuardrail.severity
  )
  const [activeTab, setActiveTab] = useState<NodeInspectorTab>(defaultInspectorTab)
  const visibleActiveTab =
    nodeStatus === 'paused' || nodeStatus === 'error' ? 'output' : activeTab

  const updateCodexOptions = (nextOptions: Partial<CodexExecutionOptions>): void => {
    setLocalData((prev) => ({
      ...prev,
      codex: {
        ...(selectedNode.data.codex ?? {}),
        ...(prev.codex ?? {}),
        ...nextOptions
      }
    }))
  }
  const updateWindowsSandbox = (value: string): void => {
    setLocalData((prev) => {
      const nextCodex: CodexExecutionOptions = {
        ...(selectedNode.data.codex ?? {}),
        ...(prev.codex ?? {})
      }

      if (value) {
        nextCodex.windowsSandbox = value as CodexWindowsSandbox
      } else {
        delete nextCodex.windowsSandbox
      }

      return {
        ...prev,
        codex: nextCodex
      }
    })
  }

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden">
        <InspectorHeader
          label={localData.label || ''}
          modelDisplayName={currentModelDisplayName}
          modelId={currentModel}
          nodeStatus={nodeStatus}
          onLabelChange={(label) => setLocalData((prev) => ({ ...prev, label }))}
          onDelete={() => deleteNode(selectedNodeId)}
          onClose={() => setSelectedNode(null)}
          title={localData.label || currentModelDisplayName}
        />

        {nodeStatus === 'paused' && (
          <ReviewBanner
            nodeAttemptCount={nodeAttemptCount}
            reviewActionInFlight={reviewActionInFlight}
            reviewSectionRef={reviewSectionRef}
            selectedNodeId={selectedNodeId}
          />
        )}

        {nodeStatus === 'error' && (
          <RuntimeErrorBanner
            nodeError={nodeError}
            selectedNodeId={selectedNodeId}
            workflowStatus={workflowStatus}
          />
        )}

        <NodeInspectorTabs activeTab={visibleActiveTab} onChange={setActiveTab} />

        <div
          className="flex-1 overflow-y-auto"
          style={{ borderTop: '1px solid var(--color-hairline-soft)' }}
        >
          {visibleActiveTab === 'prompt' && (
            <>
              <OverviewSection
                currentModelDisplayName={currentModelDisplayName}
                label={localData.label || ''}
                onLabelChange={(label) => setLocalData((prev) => ({ ...prev, label }))}
              />
              <InstructionsSection
                promptSummary={promptSummary}
                onEditPrompt={() => setActiveTextEditor('prompt')}
              />
            </>
          )}

          {visibleActiveTab === 'run' && (
            <ParametersSection
              currentDefaultReasoningLevel={currentDefaultReasoningLevel}
              currentModel={currentModel}
              humanReview={Boolean(localData.humanReview)}
              isReasoningModel={isReasoningModel}
              modelOptions={modelOptions}
              onHumanReviewChange={(humanReview) =>
                setLocalData((prev) => ({ ...prev, humanReview }))
              }
              onModelChange={(nextModel) => {
                const nextModelCapabilities = getCodexModelById(providerCapabilities, nextModel)
                const nextReasoningLevel = getNextReasoningLevelForModel(
                  localData.reasoningLevel,
                  nextModelCapabilities,
                  modelSupportsReasoning(nextModelCapabilities)
                )

                setLocalData((prev) => ({
                  ...prev,
                  model: nextModel,
                  reasoningLevel: nextReasoningLevel
                }))
              }}
              onReasoningLevelChange={(reasoningLevel) =>
                setLocalData((prev) => ({ ...prev, reasoningLevel }))
              }
              providerNote={providerNote}
              reasoningLevel={localData.reasoningLevel}
              reasoningOptions={reasoningOptions}
              reviewModeNote={reviewModeNote}
            />
          )}

          {visibleActiveTab === 'permissions' && (
            <CodexPermissionsSection
              approvalPolicy={currentApprovalPolicy}
              nodeApprovalGuardrail={nodeApprovalGuardrail}
              onApprovalPolicyChange={(approvalPolicy) => updateCodexOptions({ approvalPolicy })}
              onSandboxModeChange={(sandboxMode) => updateCodexOptions({ sandboxMode })}
              onWindowsSandboxChange={updateWindowsSandbox}
              sandboxMode={currentSandboxMode}
              windowsSandbox={currentWindowsSandbox}
            />
          )}

          {visibleActiveTab === 'output' && (
            <RuntimeSection
              nodeAttemptCount={nodeAttemptCount}
              nodeError={nodeError}
              nodeExitCode={nodeExitCode}
              nodeOutputPath={nodeOutputPath}
              nodeStatus={nodeStatus}
              onError={setWorkflowError}
              selectedNodeId={selectedNodeId}
              showOutputPreviewForPaused
              workflowStatus={workflowStatus}
              workspacePath={workspacePath}
            />
          )}

          {visibleActiveTab === 'advanced' && (
            <AdvancedSection
              systemInstructionSummary={systemInstructionSummary}
              onEditSystemInstruction={() => setActiveTextEditor('systemInstruction')}
            />
          )}
        </div>
      </div>

      <NodeTextEditors
        activeTextEditor={activeTextEditor}
        promptValue={String(localData.prompt ?? '')}
        setActiveTextEditor={setActiveTextEditor}
        setLocalData={setLocalData}
        systemInstructionValue={String(localData.systemInstruction ?? '')}
      />
    </>
  )
}
