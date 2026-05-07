import React, { useCallback, useRef, useState } from 'react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

export function useWorkspaceTrustPrompt(): {
  requestWorkspaceTrust: (workspacePath: string) => Promise<boolean>;
  trustDialog: React.ReactNode;
} {
  const [pendingWorkspacePath, setPendingWorkspacePath] = useState<string | null>(null);
  const resolverRef = useRef<((isTrusted: boolean) => void) | null>(null);

  const resolvePendingTrust = useCallback((isTrusted: boolean): void => {
    resolverRef.current?.(isTrusted);
    resolverRef.current = null;
    setPendingWorkspacePath(null);
  }, []);

  const requestWorkspaceTrust = useCallback((workspacePath: string): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setPendingWorkspacePath(workspacePath);
    });
  }, []);

  return {
    requestWorkspaceTrust,
    trustDialog: (
      <ConfirmDialog
        isOpen={Boolean(pendingWorkspacePath)}
        title="Trust this workspace?"
        description={
          pendingWorkspacePath
            ? `Fluxion will create and update .fluxion/ in this folder to store workflows, context, memory, and runs. Workspace: ${pendingWorkspacePath}`
            : ''
        }
        confirmLabel="Trust and Open"
        cancelLabel="Cancel"
        confirmVariant="primary"
        onConfirm={() => resolvePendingTrust(true)}
        onCancel={() => resolvePendingTrust(false)}
      />
    ),
  };
}
