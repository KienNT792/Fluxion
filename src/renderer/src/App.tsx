import React from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useIpcListeners } from './hooks/useIpcListeners';
import { useWorkflowPersistence } from './hooks/useWorkflowPersistence';
import { AppShell } from './components/layout/AppShell';

// Import React Flow styles
import '@xyflow/react/dist/style.css';

function App(): React.JSX.Element {
  // Activate IPC Listeners globally
  useIpcListeners();
  useWorkflowPersistence();

  return (
    <ReactFlowProvider>
      <AppShell />
    </ReactFlowProvider>
  );
}

export default App;
