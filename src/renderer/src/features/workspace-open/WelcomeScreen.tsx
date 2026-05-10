import React from 'react'
import {
  getCodexCapabilities,
  getCodexReadiness,
  getCodexReadinessBadgeState,
  getProviderReadinessSummary
} from '@renderer/lib/provider-capabilities'
import { useWorkspaceTrustPrompt } from '@renderer/hooks/useWorkspaceTrustPrompt'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { StatusChipTone } from '@renderer/components/ui/StatusChip'
import { GlobalSettingsDialog } from '@renderer/features/settings/GlobalSettingsDialog'
import { RecentWorkspacesPanel } from './components/RecentWorkspacesPanel'
import { WelcomeNav } from './components/WelcomeNav'
import { WorkspaceOpenActions } from './components/WorkspaceOpenActions'
import { useRecentWorkspaces } from './hooks/useRecentWorkspaces'
import { useWorkspaceOpenActions } from './hooks/useWorkspaceOpenActions'
import { WorkspaceOpeningOverlay } from './WorkspaceOpeningOverlay'

export const WelcomeScreen: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)
  const [workspaceActionError, setWorkspaceActionError] = React.useState<string | null>(null)
  const { handleRemoveRecentWorkspace, handleRevealRecentWorkspace, recentWorkspaces } =
    useRecentWorkspaces(setWorkspaceActionError)
  const providerCapabilities = useWorkflowStore((state) => state.providerCapabilities)
  const workspaceOpenState = useWorkflowStore((state) => state.workspaceOpenState)
  const isProviderCapabilitiesLoading = useWorkflowStore(
    (state) => state.isProviderCapabilitiesLoading
  )
  const hasFetchedProviderCapabilities = useWorkflowStore(
    (state) => state.hasFetchedProviderCapabilities
  )
  const fetchProviderCapabilities = useWorkflowStore((state) => state.fetchProviderCapabilities)
  const { requestWorkspaceTrust, trustDialog } = useWorkspaceTrustPrompt()
  const codexReadiness = getCodexReadinessBadgeState(providerCapabilities, [])
  const codexCapabilities = getCodexCapabilities(providerCapabilities)
  const codexRawReadiness = getCodexReadiness(providerCapabilities)
  const providerReadiness = getProviderReadinessSummary(providerCapabilities)

  const prerequisiteCode =
    !isProviderCapabilitiesLoading && hasFetchedProviderCapabilities
      ? codexRawReadiness?.code === 'cli_missing' ||
        codexRawReadiness?.code === 'windowsapps_alias_blocked' ||
        codexRawReadiness?.code === 'auth_missing'
        ? codexRawReadiness.code
        : null
      : null

  React.useEffect(() => {
    if (!hasFetchedProviderCapabilities) {
      void fetchProviderCapabilities()
    }
  }, [fetchProviderCapabilities, hasFetchedProviderCapabilities])

  const isWorkspaceOpening =
    workspaceOpenState.phase === 'selecting' ||
    workspaceOpenState.phase === 'awaitingTrust' ||
    workspaceOpenState.phase === 'opening'
  const { dropHandlers, handleOpenRecentWorkspace, handleOpenWorkspace, isDragActive } =
    useWorkspaceOpenActions({
      isWorkspaceOpening,
      requestWorkspaceTrust,
      setWorkspaceActionError
    })

  const readinessChipTone: StatusChipTone = isProviderCapabilitiesLoading
    ? 'running'
    : providerReadiness.blockingCount > 0 || codexReadiness.tone === 'blocked'
      ? 'error'
      : providerReadiness.warningCount > 0 || codexReadiness.tone !== 'ready'
        ? 'warning'
        : 'success'
  const readinessStatusLabel = isProviderCapabilitiesLoading
    ? 'Checking runtime...'
    : codexReadiness.tone === 'ready'
      ? 'Codex is ready'
      : codexReadiness.summary
  const codexCliLabel = isProviderCapabilitiesLoading
    ? 'Checking...'
    : codexRawReadiness?.code === 'cli_missing'
      ? 'Not found'
      : codexRawReadiness?.code === 'windowsapps_alias_blocked'
        ? 'Alias blocked'
        : codexCapabilities?.version
          ? `v${codexCapabilities.version}`
          : 'Version unknown'
  const authLabel =
    codexRawReadiness?.code === 'auth_missing' ? 'Not authenticated' : 'Authenticated'

  return (
    <div
      className="flex min-h-screen w-full flex-1 select-none flex-col overflow-auto"
      style={{ background: 'var(--color-canvas)' }}
      {...dropHandlers}
    >
      <WelcomeNav
        authLabel={authLabel}
        cliLabel={codexCliLabel}
        codexDetail={codexReadiness.detail}
        isProviderCapabilitiesLoading={isProviderCapabilitiesLoading}
        onOpenSettings={() => setIsSettingsOpen(true)}
        readinessChipTone={readinessChipTone}
        readinessStatusLabel={readinessStatusLabel}
      />

      <main
        className="mx-auto grid w-full flex-1 gap-8 px-8 py-10 lg:grid-cols-[minmax(0,1fr)_340px]"
        style={{ maxWidth: '1180px' }}
      >
        <div className="flex min-w-0 flex-col gap-6">
          <WorkspaceOpenActions
            actionCommand={codexRawReadiness?.actionCommand}
            isDragActive={isDragActive}
            isWorkspaceOpening={isWorkspaceOpening}
            onOpenWorkspace={() => {
              void handleOpenWorkspace()
            }}
            prerequisiteCode={prerequisiteCode}
            workspaceActionError={workspaceActionError}
          />

          <RecentWorkspacesPanel
            disabled={isWorkspaceOpening}
            entries={recentWorkspaces}
            onOpen={(workspacePath) => {
              void handleOpenRecentWorkspace(workspacePath)
            }}
            onReveal={(workspacePath) => {
              void handleRevealRecentWorkspace(workspacePath)
            }}
            onRemove={(workspacePath) => {
              void handleRemoveRecentWorkspace(workspacePath)
            }}
          />
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <section
            className="rounded-lg px-5 py-5"
            style={{
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)'
            }}
          >
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              What Fluxion prepares
            </h2>
            <div className="mt-4 grid gap-3">
              {[
                ['Detect repository', 'Read stack, commands, paths, and existing instructions.'],
                ['Build context', 'Create a durable project brief and agent boundaries.'],
                ['Run workflows', 'Start Codex DAGs with local logs and reviewable artifacts.']
              ].map(([title, body], index) => (
                <div key={title} className="flex gap-3">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                    style={{
                      background:
                        index === 0 ? 'var(--color-primary)' : 'var(--color-surface-strong)',
                      color: index === 0 ? 'var(--color-on-primary)' : 'var(--color-ink)'
                    }}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span
                      className="block text-xs font-semibold"
                      style={{ color: 'var(--color-ink)' }}
                    >
                      {title}
                    </span>
                    <span
                      className="mt-1 block text-xs leading-5"
                      style={{ color: 'var(--color-muted)' }}
                    >
                      {body}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section
            className="rounded-lg px-5 py-4 text-xs leading-5"
            style={{
              background: 'var(--color-canvas-soft)',
              border: '1px solid var(--color-hairline)',
              color: 'var(--color-muted)'
            }}
          >
            Everything stays local. Fluxion writes workspace metadata only after you approve trust
            and actions.
          </section>
        </aside>
      </main>

      <GlobalSettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      {trustDialog}
      <WorkspaceOpeningOverlay />
    </div>
  )
}
