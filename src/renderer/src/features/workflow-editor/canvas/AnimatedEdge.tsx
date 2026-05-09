import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react'
import { useExecutionStore } from '@renderer/stores/execution.store'

/**
 * Orchestration edge — recessive by default, status-aware.
 *
 * Design goals (Phase 5):
 * - Default edges are thin and muted — nodes are the visual focus
 * - Running edges get subtle dash animation + primary color
 * - Completed edges shift to a quiet success tone
 * - Error edges use semantic error but don't dominate
 * - Paused (review) edges get the timeline-edit accent
 * - Interaction hit area preserved at 12px for usability
 */
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
    targetPosition
  })

  const sourceNodeStatus = useExecutionStore((state) => state.nodeStatuses[source] ?? 'idle')

  // Edge appearance hierarchy: recessive default, status-aware accents
  let strokeColor = 'var(--color-hairline)'
  let strokeWidth = 1
  let strokeOpacity = 0.7
  let animationClass = ''

  switch (sourceNodeStatus) {
    case 'running':
    case 'stopping':
      strokeColor = 'var(--color-timeline-thinking)'
      strokeWidth = 1.5
      strokeOpacity = 0.85
      animationClass = 'animate-edge-running'
      break
    case 'completed':
      strokeColor = 'var(--color-timeline-grep)'
      strokeWidth = 1
      strokeOpacity = 0.6
      break
    case 'error':
      strokeColor = 'var(--color-semantic-error)'
      strokeWidth = 1.5
      strokeOpacity = 0.7
      animationClass = 'animate-edge-error'
      break
    case 'paused':
      strokeColor = 'var(--color-timeline-edit)'
      strokeWidth = 1.5
      strokeOpacity = 0.8
      break
    default:
      break
  }

  return (
    <>
      {/* Interaction layer — invisible thick path for hover/click */}
      <BaseEdge
        id={`${id}-interaction`}
        path={edgePath}
        style={{ ...style, strokeWidth: 12, stroke: 'transparent' }}
      />

      {/* Visual edge — thin, recessive, status-colored */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          opacity: strokeOpacity,
          transition: 'stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease'
        }}
        className={animationClass}
      />
    </>
  )
}
