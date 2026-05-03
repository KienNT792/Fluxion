import React, { useEffect, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { FlowCanvas } from '../canvas/FlowCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { TerminalViewer } from '../terminal/TerminalViewer';
import { WelcomeScreen } from './WelcomeScreen';
import { ContextInitModal, ProjectContext } from './ContextInitModal';
import { useThemeStore, applyTheme } from '../../stores/theme.store';
import { useWorkflowStore } from '../../stores/workflow.store';
import { TooltipProvider } from '../ui/Tooltip';

export const AppShell: React.FC = () => {
  const theme = useThemeStore(state => state.theme);
  const workspacePath = useWorkflowStore(state => state.workspacePath);
  const hasContext = useWorkflowStore(state => state.hasContext);

  // Apply persisted theme on first mount, then sync on every change
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleContextComplete = useCallback(
    async (context: ProjectContext) => {
      if (!workspacePath) return;
      try {
        await window.api.saveContext(workspacePath, context as unknown as Record<string, string>);
        useWorkflowStore.getState().setHasContext(true);
      } catch (error) {
        console.error('Failed to save context:', error);
      }
    },
    [workspacePath]
  );

  // ── Zero State: No workspace opened yet ──
  if (!workspacePath) {
    return (
      <TooltipProvider>
        <WelcomeScreen />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div
        className="flex h-screen w-screen overflow-hidden font-sans"
        style={{ background: 'var(--color-canvas)', color: 'var(--color-ink)' }}
      >
        <Sidebar />
        <div className="flex flex-col flex-1 relative h-full min-w-0">
          <Topbar />
          <main className="flex-1 relative flex overflow-hidden">
            <FlowCanvas />
            <PropertiesPanel />
            <TerminalViewer />
          </main>
        </div>
      </div>

      {/* ── Context Init Modal: shown when workspace has no context.json ── */}
      {!hasContext && (
        <ContextInitModal
          workspacePath={workspacePath}
          onComplete={handleContextComplete}
        />
      )}
    </TooltipProvider>
  );
};
