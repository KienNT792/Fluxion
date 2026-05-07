import React, { useCallback, useEffect } from 'react';
import { WorkspaceContextSavedPayload } from '@shared';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { FlowCanvas } from '../canvas/FlowCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { TerminalViewer } from '../terminal/TerminalViewer';
import { WelcomeScreen } from './WelcomeScreen';
import { ContextInitModal } from './ContextInitModal';
import { useThemeStore, applyTheme } from '../../stores/theme.store';
import { useWorkflowStore } from '../../stores/workflow.store';
import { TooltipProvider } from '../ui/Tooltip';
import { ErrorBoundary } from '../ui/ErrorBoundary';

export const AppShell: React.FC = () => {
  const theme = useThemeStore((state) => state.theme);
  const workspacePath = useWorkflowStore((state) => state.workspacePath);
  const contextStatus = useWorkflowStore((state) => state.contextStatus);
  const contextSummary = useWorkflowStore((state) => state.contextSummary);
  const isContextSetupOpen = useWorkflowStore((state) => state.isContextSetupOpen);
  const setContextSetupOpen = useWorkflowStore((state) => state.setContextSetupOpen);
  const setContextState = useWorkflowStore((state) => state.setContextState);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!workspacePath) {
      setContextSetupOpen(false);
      return;
    }

    if (contextStatus === 'missing' || contextStatus === 'legacy') {
      setContextSetupOpen(true);
    }
  }, [contextStatus, setContextSetupOpen, workspacePath]);

  const handleContextSaved = useCallback(
    (payload: WorkspaceContextSavedPayload) => {
      setContextState(payload.contextStatus, payload.context);
      setContextSetupOpen(false);
    },
    [setContextSetupOpen, setContextState]
  );

  const handleContextClose = useCallback(() => {
    setContextSetupOpen(false);
  }, [setContextSetupOpen]);

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
        <div className="flex flex-1 min-w-0 h-full flex-col relative">
          <Topbar />
          <main className="relative flex flex-1 overflow-hidden">
            <FlowCanvas />
            <ErrorBoundary fallbackTitle="Config panel crashed">
              <PropertiesPanel />
            </ErrorBoundary>
            <TerminalViewer />
          </main>
        </div>
      </div>

      {isContextSetupOpen && (
        <ContextInitModal
          workspacePath={workspacePath}
          initialContext={contextSummary}
          initialStatus={contextStatus}
          onSaved={handleContextSaved}
          onClose={handleContextClose}
        />
      )}
    </TooltipProvider>
  );
};
