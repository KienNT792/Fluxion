import React from 'react'
import { Activity, Database, Layers3, Play, ShieldAlert } from 'lucide-react'
import { StatusChip, StatusChipTone } from '@renderer/components/ui/StatusChip'
import { CodexConfigLayerValue } from '@shared'
import { useExecutionStore } from '@renderer/stores/execution.store'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { getCodexCapabilities } from '@renderer/lib/provider-capabilities'
import { buildAttemptLineageSummary } from '@renderer/features/runtime/lib/attempt-lineage'
import { buildWorkflowMcpDependencySummary } from '../lib/workflow-mcp-dependencies'

const EMPTY_PROVIDER_STATE: Record<string, unknown> = {}

function Section({
  icon,
  title,
  children
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="px-5 py-6" style={{ borderBottom: '1px solid var(--color-hairline)' }}>
      <div className="mb-4 flex items-center gap-2">
        <span className="shrink-0" style={{ color: 'var(--color-muted)' }}>
          {icon}
        </span>
        <span className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
        {label}
      </span>
      <span
        className="max-w-[60%] truncate text-[11px]"
        style={{ color: 'var(--color-body)', fontFamily: 'var(--font-mono)' }}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}

function MultiLineValue({
  label,
  values
}: {
  label: string
  values: string[]
}): React.JSX.Element | null {
  if (values.length === 0) {
    return null
  }

  return (
    <div className="py-1.5">
      <div className="mb-1 text-[11px]" style={{ color: 'var(--color-muted)' }}>
        {label}
      </div>
      <div className="grid gap-1">
        {values.map((value) => (
          <div
            key={value}
            className="text-[11px] leading-5"
            style={{ color: 'var(--color-body)', fontFamily: 'var(--font-mono)' }}
          >
            {value}
          </div>
        ))}
      </div>
    </div>
  )
}

function describeCompactPriority(priority: 'none' | 'low' | 'medium' | 'high' | undefined): string {
  switch (priority) {
    case 'high':
      return 'high'
    case 'medium':
      return 'medium'
    case 'low':
      return 'low'
    default:
      return 'none'
  }
}

function KeyBadge({ label }: { label: string }): React.JSX.Element {
  return (
    <span
      className="inline-flex rounded-md px-2 py-0.5 text-[10px]"
      style={{
        background: 'var(--color-canvas-soft)',
        border: '1px solid var(--color-hairline)',
        color: 'var(--color-ink)',
        fontFamily: 'var(--font-mono)'
      }}
    >
      {label}
    </span>
  )
}

function PolicyBadge({
  label,
  tone,
  value,
  title
}: {
  label: string
  tone: StatusChipTone
  value: string
  title?: string
}): React.JSX.Element {
  return (
    <div
      className="rounded-md px-3 py-2"
      style={{
        border: '1px solid var(--color-hairline)',
        background: 'var(--color-surface-card)'
      }}
      title={title}
    >
      <div className="mb-2 text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted)' }}>
        {label}
      </div>
      <StatusChip tone={tone} label={value} />
    </div>
  )
}

export const FlowContextInspector: React.FC = () => {
  const [compactionStatus, setCompactionStatus] = React.useState<string | null>(null)
  const workspacePath = useWorkflowStore((state) => state.workspacePath)
  const workflowId = useWorkflowStore((state) => state.workflowId)
  const contextStatus = useWorkflowStore((state) => state.contextStatus)
  const nodes = useWorkflowStore((state) => state.nodes)
  const edges = useWorkflowStore((state) => state.edges)
  const workflowStatus = useExecutionStore((state) => state.workflowStatus)
  const activeRunId = useExecutionStore((state) => state.activeRunId)
  const nodeStatuses = useExecutionStore((state) => state.nodeStatuses)
  const nodeAttemptCounts = useExecutionStore((state) => state.nodeAttemptCounts)
  const pendingReviewByNodeId = useExecutionStore((state) => state.pendingReviewByNodeId)
  const compiledContexts = useExecutionStore((state) => state.compiledContexts)
  const compiledContextDiagnostics = useExecutionStore((state) => state.compiledContextDiagnostics)
  const runtimeLogs = useExecutionStore((state) => state.runtimeLogs)
  const flowContextProviderState = useWorkflowStore((state) => {
    const summary = state.contextSummary as
      | {
          contextOnboarding?: {
            providerState?: Record<string, unknown>
          }
        }
      | null
      | undefined

    return summary?.contextOnboarding?.providerState ?? EMPTY_PROVIDER_STATE
  })
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities)
  const setContextState = useWorkflowStore((state) => state.setContextState)

  const activeNodeCount = Object.values(nodeStatuses).filter((status) => status !== 'idle').length
  const providerStateKeys = Object.keys(flowContextProviderState)
  const latestLogNodeIds = Object.keys(runtimeLogs).slice(0, 5)
  const latestDiagnostics = Object.entries(compiledContextDiagnostics).filter(([, value]) => Boolean(value))
  const activeDiagnostic =
    latestDiagnostics.length > 0 ? latestDiagnostics[latestDiagnostics.length - 1][1] : undefined
  const activeDiagnosticNodeId =
    latestDiagnostics.length > 0 ? latestDiagnostics[latestDiagnostics.length - 1][0] : undefined
  const activeCompiledContext =
    activeDiagnosticNodeId ? compiledContexts[activeDiagnosticNodeId] : undefined
  const longTermSummaryLines = activeCompiledContext
    ?.split('\n')
    .filter((line) => line.startsWith('--- Summary from Run '))
    .map((line) => line.replace(/^--- /, '').replace(/ ---$/, ''))
  const latestAutoCompactionLog = activeDiagnosticNodeId
    ? [...(runtimeLogs[activeDiagnosticNodeId] ?? [])]
        .reverse()
        .find((entry) => entry.rawType === 'context-compaction')
    : undefined
  const latestAutoCompactionFailure = activeDiagnosticNodeId
    ? [...(runtimeLogs[activeDiagnosticNodeId] ?? [])]
        .reverse()
        .find((entry) => entry.rawType === 'context-compaction-failed')
    : undefined
  const codexCapabilities = getCodexCapabilities(providerCapabilities)
  const resolvedConfig = codexCapabilities?.resolvedConfig
  const workflowMcpDependencies = React.useMemo(
    () => buildWorkflowMcpDependencySummary(nodes, providerCapabilities),
    [nodes, providerCapabilities]
  )
  const attemptedNodeIds = Object.entries(nodeAttemptCounts)
    .filter(([, attempts]) => (attempts ?? 1) > 1)
    .map(([nodeId]) => nodeId)
  const attemptDetails = attemptedNodeIds.map((nodeId) => {
    const summary = buildAttemptLineageSummary(nodeAttemptCounts[nodeId])
    return `${nodeId}: ${summary.detail}`
  })
  const staleCarryoverWarnings = [
    ...(activeDiagnostic?.warnings ?? []),
    ...attemptDetails
  ]
  const policyWarnings = [
    ...(resolvedConfig?.warnings ?? []),
    ...(resolvedConfig?.mcpServers
      ?.filter((server) => server.enabled && server.readiness !== 'ready')
      .map((server) => `${server.id}: ${server.reason ?? `state=${server.readiness}`}`) ?? [])
  ]
  const ignoredProjectOverrideCount =
    resolvedConfig
      ? (Object.values(resolvedConfig.layers) as Array<CodexConfigLayerValue<unknown>[] | undefined>)
          .flatMap((entries) => entries ?? [])
          .filter((entry) => entry.source === 'ignored-project').length
      : 0
  const trustTone: StatusChipTone =
    resolvedConfig?.trustLevel === 'trusted'
      ? 'success'
      : resolvedConfig?.trustLevel === 'untrusted'
        ? 'warning'
        : 'idle'
  const sandboxTone: StatusChipTone =
    resolvedConfig?.sandboxMode === 'danger-full-access'
      ? 'error'
      : resolvedConfig?.sandboxMode === 'read-only'
        ? 'warning'
        : 'success'
  const approvalValue =
    resolvedConfig
      ? typeof resolvedConfig.approvalPolicy === 'string'
        ? resolvedConfig.approvalPolicy
        : 'granular'
      : 'unknown'
  const approvalTone: StatusChipTone =
    approvalValue === 'never' ? 'success' : approvalValue === 'unknown' ? 'idle' : 'warning'
  const enabledMcpCount = resolvedConfig?.mcpServers?.filter((server) => server.enabled).length ?? 0
  const totalMcpCount = resolvedConfig?.mcpServers?.length ?? 0
  const nonReadyMcpCount =
    resolvedConfig?.mcpServers?.filter((server) => server.enabled && server.readiness !== 'ready')
      .length ?? 0
  const mcpTone: StatusChipTone =
    totalMcpCount === 0
      ? 'idle'
      : nonReadyMcpCount > 0
        ? 'warning'
        : 'success'
  const overrideTone: StatusChipTone =
    ignoredProjectOverrideCount > 0 ? 'warning' : 'success'
  const dangerousCombinationWarning =
    resolvedConfig?.trustLevel === 'trusted' &&
    resolvedConfig?.sandboxMode === 'danger-full-access' &&
    approvalValue !== 'never'
      ? 'Trusted workspace is using danger-full-access with interactive approvals. Recheck whether this workflow still needs that posture.'
      : resolvedConfig?.sandboxMode === 'danger-full-access'
        ? 'Danger-full-access should stay limited to narrow, trusted debug or migration flows.'
        : null

  const handleCompactCurrentContext = async (): Promise<void> => {
    if (!workspacePath || !workflowId || !activeRunId || !activeDiagnostic?.compactSuggested) {
      return
    }

    const sourceNodeIds =
      activeDiagnostic.previousNodeIds?.length
        ? activeDiagnostic.previousNodeIds
        : activeDiagnostic.staleAttemptNodeIds?.length
          ? activeDiagnostic.staleAttemptNodeIds
          : []

    if (sourceNodeIds.length === 0) {
      setCompactionStatus('No upstream node outputs are available to summarize yet.')
      return
    }

    try {
      const result = await window.api.compactWorkflowMemory({
        workspacePath,
        workflowId,
        runId: activeRunId,
        sourceNodeIds,
        diagnostics: {
          estimatedTotalTokens: activeDiagnostic.estimatedTotalTokens,
          pressure: activeDiagnostic.pressure,
          compactPriority: activeDiagnostic.compactPriority,
          compactReason: activeDiagnostic.compactReason,
          memoryEligibilityReason: activeDiagnostic.memoryEligibilityReason,
          compactCandidateSourceIds: activeDiagnostic.compactCandidateSourceIds,
          previousNodeIds: activeDiagnostic.previousNodeIds,
          staleAttemptNodeIds: activeDiagnostic.staleAttemptNodeIds,
          includesExternalContext: activeDiagnostic.includesExternalContext,
          memoriesDisableOnExternalContext: activeDiagnostic.memoriesDisableOnExternalContext
        }
      })
      const refreshedContext = await window.api.getContext(workspacePath)
      setContextState(refreshedContext?.contextStatus ?? 'missing', refreshedContext ?? null)
      setCompactionStatus(
        `Long-term summary created for ${result.sourceNodeIds.join(', ')}.`
      )
    } catch (error) {
      setCompactionStatus(
        error instanceof Error ? error.message : 'Failed to create long-term summary.'
      )
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <Section icon={<Activity size={13} />} title="Runtime">
        <Row label="Workflow" value={workflowStatus} />
        <Row label="Run ID" value={activeRunId ?? 'none'} />
        <Row label="Selected nodes" value={`${activeNodeCount}`} />
        <Row label="Workspace" value={workspacePath ?? 'none'} />
      </Section>

      <Section icon={<Database size={13} />} title="Flow Context">
        <Row label="Status" value={contextStatus} />
        <Row label="Workflow ID" value={workflowId} />
        <Row label="Nodes" value={`${nodes.length}`} />
        <Row label="Edges" value={`${edges.length}`} />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {providerStateKeys.length > 0 ? (
            providerStateKeys.map((key) => <KeyBadge key={key} label={key} />)
          ) : (
            <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
              No provider state recorded yet.
            </span>
          )}
        </div>
      </Section>

      <Section icon={<Layers3 size={13} />} title="Node Context">
        <Row label="Compiled contexts" value={`${Object.keys(compiledContexts).length}`} />
        <Row label="Pending reviews" value={`${Object.keys(pendingReviewByNodeId).length}`} />
        <Row label="Tracked log streams" value={`${latestLogNodeIds.length}`} />
        <Row
          label="Estimated tokens"
          value={activeDiagnostic ? `${activeDiagnostic.estimatedTotalTokens}` : 'n/a'}
        />
        <Row
          label="Context hash"
          value={activeDiagnostic?.contextHash?.slice(0, 12) ?? 'n/a'}
        />
        <Row
          label="Context pressure"
          value={activeDiagnostic?.pressure ?? 'unknown'}
        />
        <Row
          label="Context window"
          value={
            activeDiagnostic?.modelContextWindow
              ? `${activeDiagnostic.modelContextWindow}`
              : resolvedConfig?.modelContextWindow
                ? `${resolvedConfig.modelContextWindow}`
                : 'n/a'
          }
        />
        <Row
          label="Auto-compact"
          value={
            activeDiagnostic?.autoCompactTokenLimit
              ? `${activeDiagnostic.autoCompactTokenLimit}`
              : resolvedConfig?.modelAutoCompactTokenLimit
                ? `${resolvedConfig.modelAutoCompactTokenLimit}`
                : 'n/a'
          }
        />
        <Row
          label="Memory eligible"
          value={
            typeof activeDiagnostic?.memoryGenerationEligible === 'boolean'
              ? activeDiagnostic.memoryGenerationEligible
                ? 'yes'
                : 'no'
              : 'unknown'
          }
        />
        <Row
          label="Compact priority"
          value={describeCompactPriority(activeDiagnostic?.compactPriority)}
        />
        <Row
          label="Compact suggested"
          value={
            typeof activeDiagnostic?.compactSuggested === 'boolean'
              ? activeDiagnostic.compactSuggested
                ? 'yes'
                : 'no'
              : 'unknown'
          }
        />
        <Row
          label="External context"
          value={
            typeof activeDiagnostic?.includesExternalContext === 'boolean'
              ? activeDiagnostic.includesExternalContext
                ? 'present'
                : 'not detected'
              : 'unknown'
          }
        />
        <Row
          label="Active nodes"
          value={
            Object.entries(nodeStatuses)
              .filter(([, status]) => status !== 'idle')
              .map(([id, status]) => `${id}:${status}`)
              .join(', ') || 'none'
          }
        />
        {activeDiagnostic && activeDiagnostic.breakdown.length > 0 && (
          <div className="mt-3 grid gap-1.5">
            {activeDiagnostic.breakdown.map((item) => (
              <Row
                key={item.id}
                label={item.label}
                value={`${item.estimatedTokens} tok / ${item.bytes} B`}
              />
            ))}
          </div>
        )}
        <MultiLineValue
          label="Previous nodes"
          values={activeDiagnostic?.previousNodeIds ?? []}
        />
        <MultiLineValue
          label="Stale retry sources"
          values={activeDiagnostic?.staleAttemptNodeIds ?? []}
        />
        <MultiLineValue
          label="Compact candidates"
          values={activeDiagnostic?.compactCandidateSourceIds ?? []}
        />
        <MultiLineValue
          label="Long-term summaries"
          values={longTermSummaryLines ?? []}
        />
        {latestAutoCompactionLog ? (
          <div
            className="rounded-md px-3 py-2 text-[11px] leading-5"
            style={{
              color: 'var(--color-body)',
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            Auto compaction:
            <div className="mt-1 font-mono">{latestAutoCompactionLog.content.trim()}</div>
          </div>
        ) : null}
        {!latestAutoCompactionLog && latestAutoCompactionFailure ? (
          <div
            className="rounded-md px-3 py-2 text-[11px] leading-5"
            style={{
              color: 'var(--color-semantic-error)',
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            Auto compaction:
            <div className="mt-1 font-mono">{latestAutoCompactionFailure.content.trim()}</div>
          </div>
        ) : null}
        {activeDiagnostic?.memoryEligibilityReason ? (
          <div className="py-1.5 text-[11px] leading-5" style={{ color: 'var(--color-body)' }}>
            {activeDiagnostic.memoryEligibilityReason}
          </div>
        ) : null}
        {activeDiagnostic?.compactReason ? (
          <div className="py-1.5 text-[11px] leading-5" style={{ color: 'var(--color-body)' }}>
            {activeDiagnostic.compactReason}
          </div>
        ) : null}
        {activeDiagnostic?.compactSuggested ? (
          <div
            className="rounded-md px-3 py-2 text-[11px] leading-5"
            style={{
              color: 'var(--color-body)',
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            Suggested next step:{' '}
            {activeDiagnostic.compactCandidateSourceIds?.length
              ? `compact or summarize ${activeDiagnostic.compactCandidateSourceIds.join(', ')} into long-term memory before reruns that reuse this context.`
              : 'reduce rerun context or review upstream evidence before continuing.'}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => void handleCompactCurrentContext()}
                className="rounded-md px-3 py-1.5 text-[11px] font-semibold"
                style={{
                  border: '1px solid var(--color-hairline)',
                  background: 'var(--color-canvas)',
                  color: 'var(--color-ink)'
                }}
              >
                Create long-term summary
              </button>
            </div>
            {compactionStatus ? (
              <div className="mt-2 text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
                {compactionStatus}
              </div>
            ) : null}
          </div>
        ) : null}
        {staleCarryoverWarnings.length > 0 && (
          <div className="mt-3 grid gap-1.5">
            {staleCarryoverWarnings.map((warning) => (
              <div key={warning} className="text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
                {warning}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={<ShieldAlert size={13} />} title="Workflow Policy">
        <div className="grid gap-2 sm:grid-cols-2">
          <PolicyBadge
            label="Trust"
            tone={trustTone}
            value={resolvedConfig?.trustLevel ?? 'unknown'}
            title="Project-scoped Codex config only applies when the workspace is trusted."
          />
          <PolicyBadge
            label="Sandbox"
            tone={sandboxTone}
            value={resolvedConfig?.sandboxMode ?? 'unknown'}
            title="Full-access sandbox should stay limited to trusted workspaces."
          />
          <PolicyBadge
            label="Approval"
            tone={approvalTone}
            value={approvalValue}
            title="Interactive approval policies remain constrained by Fluxion approval-hosting support."
          />
          <PolicyBadge
            label="MCP"
            tone={mcpTone}
            value={
              totalMcpCount > 0
                ? `${enabledMcpCount}/${totalMcpCount} enabled${nonReadyMcpCount > 0 ? `, ${nonReadyMcpCount} not ready` : ''}`
                : 'none'
            }
            title="MCP readiness combines config checks with lightweight reachability probes."
          />
          <PolicyBadge
            label="Project overrides"
            tone={overrideTone}
            value={ignoredProjectOverrideCount > 0 ? `${ignoredProjectOverrideCount} ignored` : 'effective'}
            title="Project-local keys may be ignored when the workspace is untrusted or when Codex forbids overriding them at project scope."
          />
          <PolicyBadge
            label="Memory policy"
            tone={
              resolvedConfig?.memoriesDisableOnExternalContext ? 'warning' : 'idle'
            }
            value={
              typeof resolvedConfig?.memoriesDisableOnExternalContext === 'boolean'
                ? resolvedConfig.memoriesDisableOnExternalContext
                  ? 'external context excluded'
                  : 'external context allowed'
                : 'default'
            }
          />
        </div>

        <Row label="Trust" value={resolvedConfig?.trustLevel ?? 'unknown'} />
        <Row label="Sandbox" value={resolvedConfig?.sandboxMode ?? 'unknown'} />
        <Row
          label="Approval"
          value={
            resolvedConfig
              ? typeof resolvedConfig.approvalPolicy === 'string'
                ? resolvedConfig.approvalPolicy
                : 'granular'
              : 'unknown'
          }
        />
        <Row label="Reviewer" value={resolvedConfig?.approvalsReviewer ?? 'default'} />
        <Row
          label="Network"
          value={
            typeof resolvedConfig?.networkAccess === 'boolean'
              ? resolvedConfig.networkAccess
                ? 'enabled'
                : 'disabled'
              : 'unknown'
          }
        />
        <Row
          label="MCP"
          value={
            resolvedConfig?.mcpServers
              ? `${resolvedConfig.mcpServers.filter((server) => server.enabled).length}/${resolvedConfig.mcpServers.length} enabled`
              : 'none'
          }
        />
        <Row
          label="Workflow MCP deps"
          value={
            workflowMcpDependencies.entries.length > 0
              ? `${workflowMcpDependencies.counts.ready} ready, ${workflowMcpDependencies.counts.warning} warning, ${workflowMcpDependencies.counts.blocked} blocked`
              : 'none'
          }
        />
        <Row label="Review model" value={resolvedConfig?.reviewModel ?? resolvedConfig?.model ?? 'n/a'} />
        <Row label="Service tier" value={resolvedConfig?.serviceTier ?? 'default'} />
        <Row
          label="Node review model"
          value={activeDiagnostic?.effectiveReviewModel ?? 'run model'}
        />
        <Row
          label="Node service tier"
          value={activeDiagnostic?.effectiveServiceTier ?? 'default'}
        />
        <Row
          label="Compaction prompt"
          value={resolvedConfig?.compactPrompt ? 'custom' : 'default'}
        />
        <Row
          label="Memory on external"
          value={
            typeof resolvedConfig?.memoriesDisableOnExternalContext === 'boolean'
              ? resolvedConfig.memoriesDisableOnExternalContext
                ? 'disabled'
                : 'allowed'
              : 'default'
          }
        />
        <Row label="Verbosity" value={resolvedConfig?.modelVerbosity ?? 'default'} />
        <Row
          label="Node verbosity"
          value={activeDiagnostic?.effectiveModelVerbosity ?? 'default'}
        />
        <Row
          label="Reasoning summary"
          value={resolvedConfig?.modelReasoningSummary ?? 'default'}
        />
        <Row
          label="Node reasoning summary"
          value={activeDiagnostic?.effectiveModelReasoningSummary ?? 'default'}
        />
        <Row
          label="Node hide reasoning"
          value={
            typeof activeDiagnostic?.effectiveHideAgentReasoning === 'boolean'
              ? activeDiagnostic.effectiveHideAgentReasoning
                ? 'true'
                : 'false'
              : 'default'
          }
        />
        <Row
          label="Node raw reasoning"
          value={
            typeof activeDiagnostic?.effectiveShowRawAgentReasoning === 'boolean'
              ? activeDiagnostic.effectiveShowRawAgentReasoning
                ? 'true'
                : 'false'
              : 'default'
          }
        />
        {policyWarnings.length > 0 && (
          <div className="mt-3 grid gap-1.5">
            {policyWarnings.map((warning) => (
              <div key={warning} className="text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
                {warning}
              </div>
            ))}
          </div>
        )}
        {workflowMcpDependencies.entries.length > 0 && (
          <div
            className="mt-3 rounded-md px-3 py-2 text-[11px] leading-5"
            style={{
              color: 'var(--color-body)',
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            <div
              className="mb-2 text-[10px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--color-muted)' }}
            >
              Workflow-level MCP dependencies
            </div>
            <div className="grid gap-1.5">
              {workflowMcpDependencies.entries.map((entry) => (
                <div key={entry.serverId}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}>
                    {entry.serverId}
                  </span>{' '}
                  <span style={{ color: 'var(--color-muted)' }}>
                    [{entry.state}] nodes={entry.nodeIds.join(', ')}
                  </span>
                  <div style={{ color: 'var(--color-muted)' }}>{entry.summary}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {dangerousCombinationWarning ? (
          <div
            className="mt-3 rounded-md px-3 py-2 text-[11px] leading-5"
            style={{
              color: 'var(--color-body)',
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            {dangerousCombinationWarning}
          </div>
        ) : null}
      </Section>

      <Section icon={<ShieldAlert size={13} />} title="Notes">
        <p className="text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
          Use this panel to inspect flow-context continuity, provider-state keys, and runtime
          lifecycle signals while the workflow is running or after a recovery.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Play size={12} style={{ color: 'var(--color-timeline-grep)' }} />
          <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
            State is read-only and sourced from the live stores.
          </span>
        </div>
      </Section>
    </div>
  )
}
