
export const IpcChannels = {
  // Workspace
  WORKSPACE_OPEN_DIALOG: 'workspace:open-dialog',
  WORKSPACE_LOAD: 'workspace:load',
  WORKSPACE_SAVE: 'workspace:save',
  WORKSPACE_OPENED: 'workspace:opened',
  WORKSPACE_INIT: 'workspace:init',
  WORKSPACE_FILE_CHANGED: 'workspace:file-changed',
  WORKSPACE_READ_TEXT_FILE: 'workspace:read-text-file',
  WORKSPACE_SAVE_CONTEXT: 'workspace:save-context',
  WORKSPACE_SCAN_CONTEXT: 'workspace:scan-context',
  WORKSPACE_GET_CONTEXT: 'workspace:get-context',
  WORKSPACE_SAVE_CONTEXT_V2: 'workspace:save-context-v2',

  // ─── Multi-Workflow ────────────────────────────────────────────────────────
  WORKSPACE_WORKFLOW_CREATE: 'workspace:workflow-create',
  WORKSPACE_WORKFLOW_LOAD: 'workspace:workflow-load',
  WORKSPACE_WORKFLOW_DELETE: 'workspace:workflow-delete',

  // Workflow
  WORKFLOW_RUN: 'workflow:run',
  WORKFLOW_ABORT: 'workflow:abort',
  WORKFLOW_REVIEW_APPROVE: 'workflow:review-approve',
  WORKFLOW_REVIEW_REJECT: 'workflow:review-reject',
  WORKFLOW_REVIEW_RERUN: 'workflow:review-rerun',
  WORKFLOW_NODE_STATUS: 'workflow:node-status',
  WORKFLOW_NODE_OUTPUT: 'workflow:node-output',
  WORKFLOW_REVIEW_REQUIRED: 'workflow:review-required',
  WORKFLOW_COMPLETED: 'workflow:completed',

  // Terminal
  TERMINAL_DATA_BATCH: 'terminal:data-batch',
  TERMINAL_ERROR: 'terminal:error',
  TERMINAL_EXIT: 'terminal:exit',

  // Memory
  MEMORY_CONTEXT_READY: 'memory:context-ready',

  // Providers
  PROVIDERS_GET_CAPABILITIES: 'providers:get-capabilities',

  // Settings
  SETTINGS_GET_PROVIDER_SUMMARY: 'settings:get-provider-summary',
  SETTINGS_SET_OPENAI_API_KEY: 'settings:set-openai-api-key',

  // Shell
  SHELL_OPEN_PATH: 'shell:open-path',
  SHELL_REVEAL_PATH: 'shell:reveal-path',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

export type IpcChannelKey = keyof typeof IpcChannels;
