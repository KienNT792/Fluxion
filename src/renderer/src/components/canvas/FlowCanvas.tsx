import React, { useRef, useCallback, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  BackgroundVariant,
  useReactFlow,
  Panel
} from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import { CODEX_DEFAULT_MODEL, type WorkflowNode } from '@shared';
import { useWorkflowStore } from '../../stores/workflow.store';
import { useThemeStore } from '../../stores/theme.store';
import { Plus, Workflow } from 'lucide-react';
import { getDefaultCodexModel } from '../../lib/provider-capabilities';
import { Button } from '../ui/Button';

import { AgentNode } from './AgentNode';
import { AnimatedEdge } from './AnimatedEdge';
import { AgentPalette } from './AgentPalette';

const nodeTypes = { agentNode: AgentNode };
const edgeTypes = { animatedEdge: AnimatedEdge };

interface CanvasEmptyStateProps {
  onAddAgent: () => void;
  onTrySimpleChain: () => void;
}

const CanvasEmptyState: React.FC<CanvasEmptyStateProps> = ({
  onAddAgent,
  onTrySimpleChain,
}) => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10">
    <div
      className="pointer-events-auto flex w-[360px] max-w-[calc(100vw-48px)] flex-col items-center gap-4 rounded-lg px-5 py-5 text-center"
      style={{
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline)',
        boxShadow: '0 18px 40px rgba(38, 37, 30, 0.06)',
      }}
    >
      <div
        className="w-12 h-12 flex items-center justify-center rounded-lg"
        style={{
          border: '1px solid var(--color-hairline)',
          background: 'var(--color-canvas-soft)',
        }}
      >
        <Workflow size={24} style={{ color: 'var(--color-primary)' }} />
      </div>
      <div className="text-center">
        <p
          className="font-semibold text-sm"
          style={{ color: 'var(--color-body-strong)', letterSpacing: '-0.1px' }}
        >
          Start Building Your Workflow
        </p>
        <p
          className="text-xs mt-1 leading-5"
          style={{ color: 'var(--color-muted)' }}
        >
          Add a Codex agent, connect nodes into a DAG, then run through the local CLI.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="primary" size="sm" onClick={onAddAgent}>
          <Plus size={14} />
          Add Agent
        </Button>
        <Button variant="secondary" size="sm" onClick={onTrySimpleChain}>
          Try Simple Chain
        </Button>
      </div>
    </div>
  </div>
);

export const FlowCanvas: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  
  const nodes = useWorkflowStore(state => state.nodes);
  const edges = useWorkflowStore(state => state.edges);
  const providerCapabilities = useWorkflowStore(state => state.providerCapabilities);
  const onNodesChange = useWorkflowStore(state => state.onNodesChange);
  const onEdgesChange = useWorkflowStore(state => state.onEdgesChange);
  const onConnect = useWorkflowStore(state => state.onConnect);
  const addNode = useWorkflowStore(state => state.addNode);
  const setNodes = useWorkflowStore(state => state.setNodes);
  const setEdges = useWorkflowStore(state => state.setEdges);
  const deleteNode = useWorkflowStore(state => state.deleteNode);
  const setSelectedNode = useWorkflowStore(state => state.setSelectedNode);

  // ── Delete/Backspace key shortcut ──────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        !target ||
        target.closest('[data-form-control="true"]') ||
        target.isContentEditable ||
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      ) {
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && useWorkflowStore.getState().selectedNodeId) {
        e.preventDefault();
        const id = useWorkflowStore.getState().selectedNodeId!;
        deleteNode(id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteNode]);

  const onDragOver = useCallback((event: React.DragEvent): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent): void => {
      event.preventDefault();
      const jsonPayload = event.dataTransfer.getData('application/reactflow');
      if (!jsonPayload) return;
      try {
        const preset = JSON.parse(jsonPayload);
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        addNode(preset, position);
      } catch (err) {
        console.error('Failed to parse dragged node preset', err);
      }
    },
    [screenToFlowPosition, addNode],
  );

  const handleAddAgentFromEmptyState = useCallback((): void => {
    addNode({}, { x: -90, y: -45 });
  }, [addNode]);

  const handleTrySimpleChain = useCallback((): void => {
    const model = getDefaultCodexModel(providerCapabilities) || CODEX_DEFAULT_MODEL;
    const suffix = Date.now();
    const firstNodeId = `node-${suffix}-a`;
    const secondNodeId = `node-${suffix}-b`;
    const simpleChainNodes: Node<WorkflowNode['data']>[] = [
      {
        id: firstNodeId,
        type: 'agentNode',
        position: { x: -260, y: -60 },
        data: {
          provider: 'codex',
          model,
          label: 'A - Analyze',
          prompt: 'Inspect the workspace context and summarize the next implementation step.',
          systemInstruction: '',
        },
      },
      {
        id: secondNodeId,
        type: 'agentNode',
        position: { x: 80, y: -60 },
        data: {
          provider: 'codex',
          model,
          label: 'B - Report',
          prompt: 'Use the upstream output to write a concise execution report.',
          systemInstruction: '',
        },
      },
    ];
    const simpleChainEdges: Edge[] = [
      {
        id: `edge-${firstNodeId}-${secondNodeId}`,
        source: firstNodeId,
        target: secondNodeId,
        type: 'animatedEdge',
      },
    ];

    setNodes(simpleChainNodes);
    setEdges(simpleChainEdges);
    setSelectedNode(firstNodeId);
    window.requestAnimationFrame(() => fitView({ padding: 0.35, duration: 200 }));
  }, [fitView, providerCapabilities, setEdges, setNodes, setSelectedNode]);

  const theme = useThemeStore(state => state.theme);
  const colorMode = theme === 'dark' ? 'dark' : 'light';
  const dotColor = theme === 'dark' ? '#2a2925' : '#d0cfc8';

  return (
    <div className="flex-1 h-full w-full relative" ref={reactFlowWrapper}>
      {nodes.length === 0 && (
        <CanvasEmptyState
          onAddAgent={handleAddAgentFromEmptyState}
          onTrySimpleChain={handleTrySimpleChain}
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
          setSelectedNode(node.id);
        }}
        onPaneClick={() => {
          setSelectedNode(null);
        }}
        colorMode={colorMode}
        proOptions={{ hideAttribution: true }}
      >
        {/* Subtle warm dot grid */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color={dotColor}
        />
        <Controls position="bottom-right" />
        <Panel position="top-left" className="pointer-events-none">
          <AgentPalette />
        </Panel>
      </ReactFlow>
    </div>
  );
};
