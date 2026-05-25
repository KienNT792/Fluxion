export const IpcChannels = {
  // Workspace
  WORKSPACE_OPEN_DIALOG: 'workspace:open-dialog',
  WORKSPACE_LOAD: 'workspace:load',
  WORKSPACE_VALIDATE_DIRECTORY: 'workspace:validate-directory',
  WORKSPACE_LOADING: 'workspace:loading',
  WORKSPACE_SAVE: 'workspace:save',
  WORKSPACE_OPENED: 'workspace:opened',
  WORKSPACE_INIT: 'workspace:init',
  WORKSPACE_FILE_CHANGED: 'workspace:file-changed',
  WORKSPACE_READ_TEXT_FILE: 'workspace:read-text-file',
  WORKSPACE_SAVE_CONTEXT: 'workspace:save-context',
  WORKSPACE_SCAN_CONTEXT: 'workspace:scan-context',
  WORKSPACE_ENRICH_CONTEXT: 'workspace:enrich-context',
  WORKSPACE_GENERATE_ONBOARDING_PACKET: 'workspace:generate-onboarding-packet',
  WORKSPACE_SAVE_ONBOARDING_PACKET: 'workspace:save-onboarding-packet',
  WORKSPACE_CREATE_ONBOARDING_WORKFLOW: 'workspace:create-onboarding-workflow',
  WORKSPACE_CREATE_REPO_ONBOARDING_SKILL_PREVIEW: 'workspace:create-repo-onboarding-skill-preview',
  WORKSPACE_APPLY_REPO_ONBOARDING_SKILL_PREVIEW: 'workspace:apply-repo-onboarding-skill-preview',
  WORKSPACE_GET_CONTEXT: 'workspace:get-context',
  WORKSPACE_SAVE_PROJECT_CONTEXT: 'workspace:save-project-context',
  WORKSPACE_SAVE_PROJECT_CONTEXT_LEGACY: 'workspace:save-context-v2',
  WORKSPACE_READ_MEMORY_FILES: 'workspace:read-memory-files',
  WORKSPACE_SAVE_MEMORY_FILES: 'workspace:save-memory-files',
  WORKSPACE_UPDATE_CONTEXT_ONBOARDING: 'workspace:update-context-onboarding',
  WORKSPACE_MIGRATE_LEGACY_WORKFLOW: 'workspace:migrate-legacy-workflow',
  WORKSPACE_TRUST_IS_TRUSTED: 'workspace-trust:is-trusted',
  WORKSPACE_TRUST_MARK_TRUSTED: 'workspace-trust:mark-trusted',
  WORKSPACE_TRUST_MIGRATE_RENDERER_CACHE: 'workspace-trust:migrate-renderer-cache',
  WORKSPACE_RECENT_LIST: 'workspace-recent:list',
  WORKSPACE_RECENT_REMOVE: 'workspace-recent:remove',

  // Agent Config Export
  AGENT_CONFIG_LIST_EXPORTERS: 'agent-config:list-exporters',
  AGENT_CONFIG_CREATE_PREVIEW: 'agent-config:create-preview',
  AGENT_CONFIG_APPLY_PREVIEW: 'agent-config:apply-preview',

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
  WORKFLOW_EXPLAIN_FAILURE: 'workflow:explain-failure',
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
  SHELL_REVEAL_PATH: 'shell:reveal-path'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]

export type IpcChannelKey = keyof typeof IpcChannels
