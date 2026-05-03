import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react';
import { useExecutionStore } from '../../stores/execution.store';

export const AnimatedEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  source
}: EdgeProps): React.JSX.Element => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Get status of the source node to determine edge appearance
  const sourceNodeStatus = useExecutionStore(state => state.nodeStatuses[source] ?? 'idle');
  
  const isRunning   = sourceNodeStatus === 'running';
  const isCompleted = sourceNodeStatus === 'completed';
  const isError     = sourceNodeStatus === 'error';

  // Base style based on DESIGN.md
  let strokeColor = 'var(--color-hairline-strong)';
  let strokeWidth = 1.5;
  let animationClass = '';

  if (isRunning) {
    strokeColor = 'var(--color-primary)';
    strokeWidth = 2;
    animationClass = 'animate-edge-running';
  } else if (isCompleted) {
    strokeColor = 'var(--color-semantic-success)';
    strokeWidth = 1.5;
  } else if (isError) {
    strokeColor = 'var(--color-semantic-error)';
    strokeWidth = 2;
    animationClass = 'animate-edge-error';
  }

  return (
    <>
      {/* Interaction layer: thicker invisible path for easier hover/click */}
      <BaseEdge 
        id={`${id}-interaction`} 
        path={edgePath} 
        style={{ ...style, strokeWidth: 15, stroke: 'transparent' }} 
      />
      
      {/* Visual edge */}
      <BaseEdge 
        id={id} 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          transition: 'stroke 0.3s ease, stroke-width 0.3s ease',
        }} 
        className={animationClass}
      />
    </>
  );
};
