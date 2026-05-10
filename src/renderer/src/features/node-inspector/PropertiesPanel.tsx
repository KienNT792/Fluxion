import React, { useMemo, useRef, useState } from 'react'
import type { CodexExecutionOptions, CodexWindowsSandbox, WorkflowNode } from '@shared'
import { getCodexModelById, modelSupportsReasoning } from '@renderer/lib/provider-capabilities'
import { useExecutionStore } from '@renderer/stores/execution.store'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { AdvancedSection } from './components/AdvancedSection'
import { CodexPermissionsSection } from './components/CodexPermissionsSection'
import { InspectorDivider } from './components/InspectorDivider'
import { InspectorHeader } from './components/InspectorHeader'
import { InstructionsSection } from './components/InstructionsSection'
import { NodeTextEditors } from './components/NodeTextEditors'
import { OverviewSection } from './components/OverviewSection'
import { ParametersSection } from './components/ParametersSection'
import { ReviewSection } from './components/ReviewSection'
import { RuntimeSection } from './components/RuntimeSection'
import { useEditableNodeData } from './hooks/useEditableNodeData'
import { useNodeInspectorEffects } from './hooks/useNodeInspectorEffects'
import { useNodeInspectorDerivedState } from './hooks/useNodeInspectorDerivedState'
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
        <div className="h-0.5 w-full flex-shrink-0" style={{ background: '#412991' }} />
        <InspectorHeader
          title={localData.label || currentModelDisplayName}
          onDelete={() => deleteNode(selectedNodeId)}
          onClose={() => setSelectedNode(null)}
        />

        <div
          className="flex-1 overflow-y-auto"
          style={{ borderTop: '1px solid var(--color-hairline-soft)' }}
        >
          <OverviewSection
            currentModelDisplayName={currentModelDisplayName}
            label={localData.label || ''}
            onLabelChange={(label) => setLocalData((prev) => ({ ...prev, label }))}
            providerNote={providerNote}
          />
          <InspectorDivider />
          <InstructionsSection
            promptSummary={promptSummary}
            onEditPrompt={() => setActiveTextEditor('prompt')}
          />
          <InspectorDivider />
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
            reasoningLevel={localData.reasoningLevel}
            reasoningOptions={reasoningOptions}
            reviewModeNote={reviewModeNote}
          />
          <InspectorDivider />
          <CodexPermissionsSection
            approvalPolicy={currentApprovalPolicy}
            nodeApprovalGuardrail={nodeApprovalGuardrail}
            onApprovalPolicyChange={(approvalPolicy) => updateCodexOptions({ approvalPolicy })}
            onSandboxModeChange={(sandboxMode) => updateCodexOptions({ sandboxMode })}
            onWindowsSandboxChange={updateWindowsSandbox}
            sandboxMode={currentSandboxMode}
            windowsSandbox={currentWindowsSandbox}
          />
          <InspectorDivider />
          {nodeStatus === 'paused' && (
            <>
              <ReviewSection
                nodeAttemptCount={nodeAttemptCount}
                nodeOutputPath={nodeOutputPath}
                onError={setWorkflowError}
                reviewActionInFlight={reviewActionInFlight}
                reviewSectionRef={reviewSectionRef}
                selectedNodeId={selectedNodeId}
                workspacePath={workspacePath}
              />
              <InspectorDivider />
            </>
          )}
          <RuntimeSection
            nodeAttemptCount={nodeAttemptCount}
            nodeError={nodeError}
            nodeExitCode={nodeExitCode}
            nodeOutputPath={nodeOutputPath}
            nodeStatus={nodeStatus}
            onError={setWorkflowError}
            selectedNodeId={selectedNodeId}
            workflowStatus={workflowStatus}
            workspacePath={workspacePath}
          />
          <InspectorDivider />
          <AdvancedSection
            systemInstructionSummary={systemInstructionSummary}
            onEditSystemInstruction={() => setActiveTextEditor('systemInstruction')}
          />
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
