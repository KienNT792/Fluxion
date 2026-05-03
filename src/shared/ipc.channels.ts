
export const IpcChannels = {
  // Workspace
  WORKSPACE_OPEN_DIALOG: 'workspace:open-dialog',
  WORKSPACE_LOAD: 'workspace:load',
  WORKSPACE_SAVE: 'workspace:save',
  WORKSPACE_OPENED: 'workspace:opened',
  WORKSPACE_INIT: 'workspace:init',
  WORKSPACE_FILE_CHANGED: 'workspace:file-changed',
  WORKSPACE_SAVE_CONTEXT: 'workspace:save-context',

  // ─── Multi-Workflow ────────────────────────────────────────────────────────
  WORKSPACE_WORKFLOW_CREATE: 'workspace:workflow-create',
  WORKSPACE_WORKFLOW_LOAD: 'workspace:workflow-load',
  WORKSPACE_WORKFLOW_DELETE: 'workspace:workflow-delete',

  // Workflow
  WORKFLOW_RUN: 'workflow:run',
  WORKFLOW_ABORT: 'workflow:abort',
  WORKFLOW_NODE_STATUS: 'workflow:node-status',
  WORKFLOW_NODE_OUTPUT: 'workflow:node-output',
  WORKFLOW_COMPLETED: 'workflow:completed',

  // Terminal
  TERMINAL_DATA_BATCH: 'terminal:data-batch',
  TERMINAL_ERROR: 'terminal:error',
  TERMINAL_EXIT: 'terminal:exit',

  // Memory
  MEMORY_CONTEXT_READY: 'memory:context-ready',

  // Providers
  PROVIDERS_GET_CAPABILITIES: 'providers:get-capabilities',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

export type IpcChannelKey = keyof typeof IpcChannels;
