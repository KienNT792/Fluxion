import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'
import type { WorkflowRuntimeStatus } from '@renderer/stores/execution.store'
import { DockTab, pickAutoFollowNodeId } from '../lib/runtime-status'

interface UseRuntimeDockStateOptions {
  followTerminalNode: (nodeId: string) => void
  nodeStatuses: Record<string, string>
  setTerminalFollowMode: (mode: 'auto' | 'manual') => void
  terminalFollowMode: 'auto' | 'manual'
  terminalNodeId: string | null
  terminalViewRequestId: number
  workflowStatus: WorkflowRuntimeStatus
}

export function useRuntimeDockState({
  followTerminalNode,
  nodeStatuses,
  setTerminalFollowMode,
  terminalFollowMode,
  terminalNodeId,
  terminalViewRequestId,
  workflowStatus
}: UseRuntimeDockStateOptions): {
  activeTab: DockTab
  handleFollowRunning: () => void
  handleTabChange: (tab: DockTab) => void
  isExpanded: boolean
  setIsExpanded: Dispatch<SetStateAction<boolean>>
} {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<DockTab>('timeline')
  const [allowAutoLogTabActivation, setAllowAutoLogTabActivation] = useState(true)
  const prevTerminalViewRequestIdRef = useRef(terminalViewRequestId)
  const prevWorkflowStatusRef = useRef(workflowStatus)

  useEffect(() => {
    let frameId: number | null = null

    if (terminalNodeId && terminalViewRequestId !== prevTerminalViewRequestIdRef.current) {
      frameId = window.requestAnimationFrame(() => {
        setIsExpanded(true)
        if (terminalFollowMode === 'manual' || allowAutoLogTabActivation) {
          setActiveTab('logs')
        }
      })
    }

    prevTerminalViewRequestIdRef.current = terminalViewRequestId

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [allowAutoLogTabActivation, terminalFollowMode, terminalNodeId, terminalViewRequestId])

  useEffect(() => {
    let frameId: number | null = null

    if (workflowStatus === 'running' && prevWorkflowStatusRef.current !== 'running') {
      frameId = window.requestAnimationFrame(() => {
        setIsExpanded(true)
        setAllowAutoLogTabActivation(true)
      })
    }

    prevWorkflowStatusRef.current = workflowStatus

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [workflowStatus])

  const handleTabChange = (tab: DockTab): void => {
    setActiveTab(tab)
    setAllowAutoLogTabActivation(tab === 'logs')
  }

  const handleFollowRunning = (): void => {
    const nextNodeId = pickAutoFollowNodeId(terminalNodeId, nodeStatuses)
    setTerminalFollowMode('auto')
    if (nextNodeId) {
      followTerminalNode(nextNodeId)
    }
    setIsExpanded(true)
    setActiveTab('logs')
    setAllowAutoLogTabActivation(true)
  }

  return {
    activeTab,
    handleFollowRunning,
    handleTabChange,
    isExpanded,
    setIsExpanded
  }
}
