import React from 'react'
import {
  getCodexReadiness,
  getCodexReadinessBadgeState,
  getProviderReadinessSummary
} from '@renderer/lib/provider-capabilities'
import { useWorkspaceTrustPrompt } from '@renderer/hooks/useWorkspaceTrustPrompt'
import { useWorkflowStore } from '@renderer/stores/workflow.store'
import { StatusChipTone } from '@renderer/components/ui/StatusChip'
import { GlobalSettingsDialog } from '@renderer/features/settings/GlobalSettingsDialog'
import { FirstStepsBand } from './components/FirstStepsBand'
import { FluxionPreviewPanel } from './components/FluxionPreviewPanel'
import { ReadinessSummaryPanel } from './components/ReadinessSummaryPanel'
import { RecentWorkspacesPanel } from './components/RecentWorkspacesPanel'
import { WelcomeFooter } from './components/WelcomeFooter'
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
  const codexRawReadiness = getCodexReadiness(providerCapabilities)
  const providerReadiness = getProviderReadinessSummary(providerCapabilities)

  const prerequisiteCode =
    !isProviderCapabilitiesLoading && hasFetchedProviderCapabilities
      ? codexRawReadiness?.code === 'cli_missing' || codexRawReadiness?.code === 'auth_missing'
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

  return (
    <div
      className="flex h-screen w-full flex-1 select-none flex-col overflow-auto"
      style={{ background: 'var(--color-canvas)' }}
      {...dropHandlers}
    >
      <WelcomeNav onOpenSettings={() => setIsSettingsOpen(true)} />

      <main
        className="mx-auto flex w-full max-w-[1440px] flex-1 px-8 py-12"
        style={{ gap: '48px' }}
      >
        <div className="flex flex-col gap-8" style={{ flex: '0 0 40%', maxWidth: '40%' }}>
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

        <FluxionPreviewPanel />
      </main>

      <FirstStepsBand />

      <ReadinessSummaryPanel
        authLabel={
          codexRawReadiness?.code === 'auth_missing' ? 'Not authenticated' : 'Authenticated'
        }
        cliLabel={codexRawReadiness?.code === 'cli_missing' ? 'Not found' : '1.0.7'}
        codexDetail={codexReadiness.detail}
        isProviderCapabilitiesLoading={isProviderCapabilitiesLoading}
        readinessChipTone={readinessChipTone}
        readinessStatusLabel={readinessStatusLabel}
      />

      <WelcomeFooter />

      <GlobalSettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      {trustDialog}
      <WorkspaceOpeningOverlay />
    </div>
  )
}
