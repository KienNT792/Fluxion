import { useEffect, useRef, useState } from 'react'
import type { WorkflowRuntimeStatus } from '@renderer/stores/execution.store'

export function useWorkflowElapsed(workflowStatus: WorkflowRuntimeStatus): number {
  const [elapsedMs, setElapsedMs] = useState(0)
  const runStartedAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (workflowStatus === 'running') {
      if (runStartedAtRef.current == null) {
        runStartedAtRef.current = Date.now()
        setElapsedMs(0)
      }

      const intervalId = window.setInterval(() => {
        if (runStartedAtRef.current != null) {
          setElapsedMs(Date.now() - runStartedAtRef.current)
        }
      }, 1000)

      return () => window.clearInterval(intervalId)
    }

    runStartedAtRef.current = null
    return undefined
  }, [workflowStatus])

  return elapsedMs
}
