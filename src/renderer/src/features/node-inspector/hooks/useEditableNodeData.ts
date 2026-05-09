import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'
import { AgentNodeData, ProviderCapabilitiesMap, WorkflowNode } from '@shared'
import { buildEditableNodeData, nodeDataSchema } from '../lib/node-data'

interface UseEditableNodeDataOptions {
  providerCapabilities: ProviderCapabilitiesMap
  selectedNode: {
    id: string
    data: WorkflowNode['data']
  }
  selectedNodeId: string
  updateNodeData: (nodeId: string, data: AgentNodeData) => void
}

export function useEditableNodeData({
  providerCapabilities,
  selectedNode,
  selectedNodeId,
  updateNodeData
}: UseEditableNodeDataOptions): {
  localData: Partial<AgentNodeData>
  setLocalData: Dispatch<SetStateAction<Partial<AgentNodeData>>>
} {
  const [localData, setLocalData] = useState<Partial<AgentNodeData>>(() =>
    buildEditableNodeData(selectedNode, providerCapabilities)
  )
  const skipNextSyncRef = useRef(true)

  useEffect(() => {
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false
      return
    }

    const handler = setTimeout(() => {
      try {
        const validated = nodeDataSchema.parse({
          ...selectedNode.data,
          ...localData,
          provider: 'codex'
        }) as AgentNodeData

        const isChanged = Object.keys(validated).some(
          (key) =>
            (validated as Record<string, unknown>)[key] !==
            (selectedNode.data as Record<string, unknown>)[key]
        )

        if (isChanged) {
          updateNodeData(selectedNodeId, validated)
        }
      } catch {
        // Ignore transient invalid form states while the user is typing.
      }
    }, 300)

    return () => clearTimeout(handler)
  }, [localData, selectedNode, selectedNodeId, updateNodeData])

  return { localData, setLocalData }
}
