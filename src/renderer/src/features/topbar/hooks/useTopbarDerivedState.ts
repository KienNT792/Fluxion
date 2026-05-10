import React from 'react'
import type {
  AgentNodeData,
  CodexApprovalGuardrailResult,
  ProviderCapabilitiesMap,
  WorkspaceContextStatus
} from '@shared'
import { getProviderCodexApprovalProtocolStatus, getWorkflowCodexApprovalGuardrail } from '@shared'
import type { StatusChipTone } from '@renderer/components/ui/StatusChip'
import type { WorkflowRuntimeStatus } from '@renderer/stores/execution.store'
import { getCodexReadinessBadgeState } from '@renderer/lib/provider-capabilities'
import { useWorkflowElapsed } from './useWorkflowElapsed'
import {
  formatElapsed,
  formatSavedLabel,
  getContextChipState,
  getSaveChipState,
  getWorkflowChipState
} from '../lib/topbar-status'
import { buildActivityDetailItems, WorkspaceActivityChange } from '../lib/workspace-activity'

interface TopbarNode {
  data: Partial<AgentNodeData>
  id: string
}

interface UseTopbarDerivedStateOptions {
  contextStatus: WorkspaceContextStatus
  hasExternalWorkflowChange: boolean
  isDirty: boolean
  isSaving: boolean
  lastSavedAt: string | null
  nodes: TopbarNode[]
  providerCapabilities: ProviderCapabilitiesMap
  recentWorkspaceChanges: WorkspaceActivityChange[]
  reviewNodeIds: string[]
  saveError: string | null
  workflowError: string | null
  workflowName: string
  workflowStatus: WorkflowRuntimeStatus
  workspaceOpenPhase: string
  workspacePath: string | null
}

export function useTopbarDerivedState({
  contextStatus,
  hasExternalWorkflowChange,
  isDirty,
  isSaving,
  lastSavedAt,
  nodes,
  providerCapabilities,
  recentWorkspaceChanges,
  reviewNodeIds,
  saveError,
  workflowError,
  workflowName,
  workflowStatus,
  workspaceOpenPhase,
  workspacePath
}: UseTopbarDerivedStateOptions): {
  activityDetailItems: ReturnType<typeof buildActivityDetailItems>
  activityHasAttention: boolean
  activitySummaryLabel: string
  approvalGuardrail: CodexApprovalGuardrailResult
  canRun: boolean
  canSave: boolean
  codexReadiness: ReturnType<typeof getCodexReadinessBadgeState>
  contextChipState: ReturnType<typeof getContextChipState>
  displayWorkflowName: string
  isBusy: boolean
  isPaused: boolean
  isStopping: boolean
  isWorkspaceOpening: boolean
  readinessTone: StatusChipTone
  reviewButtonLabel: string
  reviewNodeLabel?: unknown
  runTooltip: string
  saveChipState: ReturnType<typeof getSaveChipState>
  saveStateLabel: string
  statusSubtext: string | null
  workflowChipLabel: string
  workflowChipState: ReturnType<typeof getWorkflowChipState>
  workspaceName: string
} {
  const elapsedMs = useWorkflowElapsed(workflowStatus)
  const isRunning = workflowStatus === 'running'
  const isStopping = workflowStatus === 'stopping'
  const isPaused = workflowStatus === 'paused'
  const isWorkspaceOpening =
    workspaceOpenPhase === 'selecting' ||
    workspaceOpenPhase === 'awaitingTrust' ||
    workspaceOpenPhase === 'opening'
  const isBusy = isRunning || isStopping || isPaused || isWorkspaceOpening
  const approvalGuardrail = React.useMemo(
    () =>
      getWorkflowCodexApprovalGuardrail(
        nodes.map((node) => ({
          id: node.id,
          label: node.data.label ?? node.data.model,
          data: node.data
        })),
        {
          approvalProtocolStatus: getProviderCodexApprovalProtocolStatus(providerCapabilities)
        }
      ),
    [nodes, providerCapabilities]
  )
  const codexReadiness = getCodexReadinessBadgeState(
    providerCapabilities,
    nodes.map((node) => String(node.data.model ?? ''))
  )
  const readinessTone: StatusChipTone =
    codexReadiness.tone === 'ready'
      ? 'success'
      : codexReadiness.tone === 'blocked'
        ? 'error'
        : 'warning'
  const canRun =
    Boolean(workspacePath) &&
    nodes.length > 0 &&
    !isBusy &&
    approvalGuardrail.severity !== 'blocked'
  const canSave = Boolean(workspacePath) && isDirty && !isSaving
  const workspaceName = workspacePath
    ? (() => {
        const parts = workspacePath.split(/[/\\]/).filter(Boolean)
        const basename = parts.pop() ?? 'Workspace'
        return basename === '.fluxion' ? (parts.pop() ?? 'Fluxion') : basename
      })()
    : 'Workspace'
  const displayWorkflowName = workflowName
    ? workflowName.replace(/^\.fluxion\s*—\s*/, '')
    : 'Untitled Workflow'
  const changeCount = recentWorkspaceChanges.length
  const activitySummaryLabel =
    changeCount > 0
      ? `${changeCount} file${changeCount === 1 ? '' : 's'} changed`
      : hasExternalWorkflowChange
        ? 'Workflow changed on disk'
        : 'No recent file changes'
  const runTooltip = !workspacePath
    ? 'Open a workspace first'
    : nodes.length === 0
      ? 'Add at least one node'
      : isStopping
        ? 'Wait for the workflow to finish stopping'
        : isPaused
          ? 'Resolve review checkpoint first'
          : approvalGuardrail.severity === 'blocked'
            ? approvalGuardrail.summary
            : codexReadiness.blocking
              ? codexReadiness.summary
              : 'Run workflow'
  const workflowChipState = getWorkflowChipState(workflowStatus)
  const workflowChipLabel =
    workflowStatus === 'running'
      ? `${workflowChipState.label} ${formatElapsed(elapsedMs)}`
      : workflowChipState.label
  const activityDetailItems = React.useMemo(
    () => buildActivityDetailItems(recentWorkspaceChanges),
    [recentWorkspaceChanges]
  )
  const reviewNodeLabel =
    reviewNodeIds.length === 1
      ? (nodes.find((node) => node.id === reviewNodeIds[0])?.data?.label ?? reviewNodeIds[0])
      : undefined

  return {
    activityDetailItems,
    activityHasAttention: changeCount > 0 || hasExternalWorkflowChange,
    activitySummaryLabel,
    approvalGuardrail,
    canRun,
    canSave,
    codexReadiness,
    contextChipState: getContextChipState(contextStatus),
    displayWorkflowName,
    isBusy,
    isPaused,
    isStopping,
    isWorkspaceOpening,
    readinessTone,
    reviewButtonLabel: reviewNodeLabel
      ? `Review: ${String(reviewNodeLabel).slice(0, 24)}${
          String(reviewNodeLabel).length > 24 ? '...' : ''
        }`
      : 'Review Required',
    reviewNodeLabel,
    runTooltip,
    saveChipState: getSaveChipState(isDirty, isSaving, saveError),
    saveStateLabel: saveError ?? formatSavedLabel(lastSavedAt),
    statusSubtext: workflowError ?? saveError,
    workflowChipLabel,
    workflowChipState,
    workspaceName
  }
}
