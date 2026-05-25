import React from 'react'
import { Activity, Database, Layers3, Play, ShieldAlert } from 'lucide-react'
import { useExecutionStore } from '@renderer/stores/execution.store'
import { useWorkflowStore } from '@renderer/stores/workflow.store'

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

export const FlowContextInspector: React.FC = () => {
  const workspacePath = useWorkflowStore((state) => state.workspacePath)
  const workflowId = useWorkflowStore((state) => state.workflowId)
  const contextStatus = useWorkflowStore((state) => state.contextStatus)
  const nodes = useWorkflowStore((state) => state.nodes)
  const edges = useWorkflowStore((state) => state.edges)
  const workflowStatus = useExecutionStore((state) => state.workflowStatus)
  const activeRunId = useExecutionStore((state) => state.activeRunId)
  const nodeStatuses = useExecutionStore((state) => state.nodeStatuses)
  const pendingReviewByNodeId = useExecutionStore((state) => state.pendingReviewByNodeId)
  const compiledContexts = useExecutionStore((state) => state.compiledContexts)
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

  const activeNodeCount = Object.values(nodeStatuses).filter((status) => status !== 'idle').length
  const providerStateKeys = Object.keys(flowContextProviderState)
  const latestLogNodeIds = Object.keys(runtimeLogs).slice(0, 5)

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
          label="Active nodes"
          value={
            Object.entries(nodeStatuses)
              .filter(([, status]) => status !== 'idle')
              .map(([id, status]) => `${id}:${status}`)
              .join(', ') || 'none'
          }
        />
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
