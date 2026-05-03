import React, { useRef, useCallback, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  BackgroundVariant,
  useReactFlow,
  Panel
} from '@xyflow/react';
import { useWorkflowStore } from '../../stores/workflow.store';
import { useThemeStore } from '../../stores/theme.store';
import { Workflow } from 'lucide-react';

import { AgentNode } from './AgentNode';
import { AnimatedEdge } from './AnimatedEdge';
import { AgentPalette } from './AgentPalette';

const nodeTypes = { agentNode: AgentNode };
const edgeTypes = { animatedEdge: AnimatedEdge };

const CanvasEmptyState: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10">
    <div className="flex flex-col items-center gap-5" style={{ opacity: 0.35 }}>
      <div
        className="w-20 h-20 flex items-center justify-center rounded-2xl"
        style={{
          border: '1.5px dashed var(--color-hairline-strong)',
          background: 'var(--color-surface-card)',
        }}
      >
        <Workflow size={34} style={{ color: 'var(--color-muted-soft)' }} />
      </div>
      <div className="text-center">
        <p
          className="font-semibold text-sm"
          style={{ color: 'var(--color-body-strong)', letterSpacing: '-0.1px' }}
        >
          Start Building Your Workflow
        </p>
        <p
          className="text-xs mt-1"
          style={{ color: 'var(--color-muted)' }}
        >
          Click the <strong style={{color: 'var(--color-ink)'}}>+</strong> icon on the top-left to add an Agent
        </p>
      </div>
    </div>
  </div>
);

export const FlowCanvas: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  
  const nodes = useWorkflowStore(state => state.nodes);
  const edges = useWorkflowStore(state => state.edges);
  const onNodesChange = useWorkflowStore(state => state.onNodesChange);
  const onEdgesChange = useWorkflowStore(state => state.onEdgesChange);
  const onConnect = useWorkflowStore(state => state.onConnect);
  const addNode = useWorkflowStore(state => state.addNode);
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

  const theme = useThemeStore(state => state.theme);
  const colorMode = theme === 'dark' ? 'dark' : 'light';
  const dotColor = theme === 'dark' ? '#2a2925' : '#d0cfc8';

  return (
    <div className="flex-1 h-full w-full relative" ref={reactFlowWrapper}>
      {nodes.length === 0 && <CanvasEmptyState />}
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
