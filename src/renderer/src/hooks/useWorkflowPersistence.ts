import { useEffect } from 'react'
import { saveCurrentWorkflow } from '../lib/workflow-session'
import { useWorkflowStore } from '../stores/workflow.store'

const AUTOSAVE_DELAY_MS = 800

export function useWorkflowPersistence(): void {
  const workflowId = useWorkflowStore((state) => state.workflowId)
  const workflowName = useWorkflowStore((state) => state.workflowName)
  const nodes = useWorkflowStore((state) => state.nodes)
  const edges = useWorkflowStore((state) => state.edges)
  const workspacePath = useWorkflowStore((state) => state.workspacePath)
  const isDirty = useWorkflowStore((state) => state.isDirty)
  const isSaving = useWorkflowStore((state) => state.isSaving)

  useEffect(() => {
    if (!workspacePath || !isDirty || isSaving) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void saveCurrentWorkflow().catch(() => undefined)
    }, AUTOSAVE_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [workspacePath, workflowId, workflowName, nodes, edges, isDirty, isSaving])
}
