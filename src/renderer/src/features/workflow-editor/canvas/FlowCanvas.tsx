import React, { useRef, useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  useReactFlow,
  Panel
} from '@xyflow/react'
import { CODEX_DEFAULT_MODEL } from '@shared'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { useThemeStore } from '@renderer/stores/theme.store'
import { GitBranch, Plus, Workflow } from 'lucide-react'
import { getDefaultCodexModel } from '@renderer/lib/provider-capabilities'
import { Button } from '@renderer/components/ui/Button'
import { switchWorkflow } from '@renderer/lib/workflow-session'

import { AgentNode } from './AgentNode'
import { AnimatedEdge } from './AnimatedEdge'
import { AgentPalette } from './AgentPalette'
import {
  buildWorkflowTemplate,
  WORKFLOW_TEMPLATES,
  WorkflowTemplateId
} from './lib/workflow-templates'

const nodeTypes = { agentNode: AgentNode }
const edgeTypes = { animatedEdge: AnimatedEdge }

interface CanvasEmptyStateProps {
  contextStatus: 'missing' | 'incomplete' | 'ready' | 'legacy'
  onAddAgent: () => void
  onCreateOnboardingWorkflow: () => void
  isCreatingOnboardingWorkflow: boolean
  onReviewContext: () => void
  onApplyTemplate: (templateId: WorkflowTemplateId) => void
}

const CanvasEmptyState: React.FC<CanvasEmptyStateProps> = ({
  contextStatus,
  onAddAgent,
  onCreateOnboardingWorkflow,
  isCreatingOnboardingWorkflow,
  onReviewContext,
  onApplyTemplate
}) => {
  const shouldReviewContext = contextStatus !== 'ready'

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10">
      <div
        className="pointer-events-auto flex w-[340px] max-w-[calc(100vw-48px)] flex-col items-center gap-3 rounded-lg px-5 py-5 text-center"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)'
        }}
      >
        <div
          className="w-10 h-10 flex items-center justify-center rounded-md"
          style={{
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-canvas-soft)'
          }}
        >
          <Workflow size={20} style={{ color: 'var(--color-muted)' }} />
        </div>
        <div className="text-center">
          <p
            className="font-semibold text-xs"
            style={{ color: 'var(--color-ink)', letterSpacing: '-0.1px' }}
          >
            {shouldReviewContext
              ? 'Review project context first'
              : 'Add your first orchestration step'}
          </p>
          <p className="text-[11px] mt-1 leading-5" style={{ color: 'var(--color-muted)' }}>
            {shouldReviewContext
              ? 'Context helps the agent understand your workspace.'
              : 'Drag a Codex agent from the palette, or use a template.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {shouldReviewContext ? (
            <Button variant="primary" size="lg" onClick={onReviewContext}>
              Review Onboarding
            </Button>
          ) : null}
          <Button
            variant={shouldReviewContext ? 'secondary' : 'primary'}
            size="lg"
            onClick={onAddAgent}
          >
            <Plus size={14} />
            Add Agent
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={onCreateOnboardingWorkflow}
            disabled={isCreatingOnboardingWorkflow}
          >
            {isCreatingOnboardingWorkflow ? 'Creating...' : 'Create onboarding workflow'}
          </Button>
        </div>
        <div className="grid w-full grid-cols-2 gap-1.5 pt-1">
          {WORKFLOW_TEMPLATES.map((template) => (
            <Button
              key={template.id}
              variant="ghost"
              size="sm"
              onClick={() => onApplyTemplate(template.id)}
            >
              <GitBranch size={13} />
              {template.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

export const FlowCanvas: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const [isCreatingOnboardingWorkflow, setIsCreatingOnboardingWorkflow] = useState(false)

  const nodes = useWorkflowStore((state) => state.nodes)
  const edges = useWorkflowStore((state) => state.edges)
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities)
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange)
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange)
  const onConnect = useWorkflowStore((state) => state.onConnect)
  const addNode = useWorkflowStore((state) => state.addNode)
  const setNodes = useWorkflowStore((state) => state.setNodes)
  const setEdges = useWorkflowStore((state) => state.setEdges)
  const deleteNode = useWorkflowStore((state) => state.deleteNode)
  const setSelectedNode = useWorkflowStore((state) => state.setSelectedNode)
  const contextStatus = useWorkflowStore((state) => state.contextStatus)
  const workspacePath = useWorkflowStore((state) => state.workspacePath)
  const setContextSetupOpen = useWorkflowStore((state) => state.setContextSetupOpen)

  // ── Delete/Backspace key shortcut ──────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (
        !target ||
        target.closest('[data-form-control="true"]') ||
        target.isContentEditable ||
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      ) {
        return
      }
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        useWorkflowStore.getState().selectedNodeId
      ) {
        e.preventDefault()
        const id = useWorkflowStore.getState().selectedNodeId!
        deleteNode(id)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteNode])

  const onDragOver = useCallback((event: React.DragEvent): void => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent): void => {
      event.preventDefault()
      const jsonPayload = event.dataTransfer.getData('application/reactflow')
      if (!jsonPayload) return
      try {
        const preset = JSON.parse(jsonPayload)
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
        addNode(preset, position)
      } catch (err) {
        console.error('Failed to parse dragged node preset', err)
      }
    },
    [screenToFlowPosition, addNode]
  )

  const handleAddAgentFromEmptyState = useCallback((): void => {
    addNode({}, { x: -90, y: -45 })
  }, [addNode])

  const handleApplyTemplate = useCallback(
    (templateId: WorkflowTemplateId): void => {
    const model = getDefaultCodexModel(providerCapabilities) || CODEX_DEFAULT_MODEL
      const template = buildWorkflowTemplate(templateId, model)

      setNodes(template.nodes)
      setEdges(template.edges)
      setSelectedNode(template.nodes[0]?.id ?? null)
      window.requestAnimationFrame(() => fitView({ padding: 0.35, duration: 200 }))
    },
    [fitView, providerCapabilities, setEdges, setNodes, setSelectedNode]
  )

  const handleCreateOnboardingWorkflow = useCallback(async (): Promise<void> => {
    if (!workspacePath || isCreatingOnboardingWorkflow) {
      return
    }

    setIsCreatingOnboardingWorkflow(true)
    try {
      const result = await window.api.createOnboardingWorkflow({ workspacePath })
      await switchWorkflow(result.workflow.id)
    } catch (error) {
      console.error('Failed to create onboarding workflow', error)
    } finally {
      setIsCreatingOnboardingWorkflow(false)
    }
  }, [isCreatingOnboardingWorkflow, workspacePath])

  const theme = useThemeStore((state) => state.theme)
  const colorMode = theme === 'dark' ? 'dark' : 'light'
  // Calm dot grid — barely visible, does not compete with nodes
  const dotColor = theme === 'dark' ? '#222220' : '#ddddd8'
  const dotSize = 0.8
  const dotGap = 24

  return (
    <div className="flex-1 h-full w-full relative" ref={reactFlowWrapper}>
      {nodes.length === 0 && (
        <CanvasEmptyState
          contextStatus={contextStatus}
          isCreatingOnboardingWorkflow={isCreatingOnboardingWorkflow}
          onAddAgent={handleAddAgentFromEmptyState}
          onCreateOnboardingWorkflow={() => void handleCreateOnboardingWorkflow()}
          onReviewContext={() => setContextSetupOpen(true, 'onboarding')}
          onApplyTemplate={handleApplyTemplate}
        />
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={(_event, node) => {
          setSelectedNode(node.id)
        }}
        onPaneClick={() => {
          setSelectedNode(null)
        }}
        fitView
        fitViewOptions={{ padding: 0.35, maxZoom: 1, minZoom: 0.2 }}
        colorMode={colorMode}
        proOptions={{ hideAttribution: true }}
      >
        {/* Calm dot grid — minimal, recessive */}
        <Background variant={BackgroundVariant.Dots} gap={dotGap} size={dotSize} color={dotColor} />
        <Controls position="bottom-right" showInteractive={false} />
        <Panel position="top-left" className="pointer-events-none">
          <AgentPalette />
        </Panel>
      </ReactFlow>
    </div>
  )
}
