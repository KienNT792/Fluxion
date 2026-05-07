import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  markWorkspaceAsTrusted,
  openWorkspaceFromDialog,
  runCurrentWorkflow,
  shouldPromptWorkspaceTrust,
} from './workflow-session';
import { useExecutionStore } from '../stores/execution.store';
import { useWorkflowStore } from '../stores/workflow.store';

describe('runCurrentWorkflow approval guardrail', () => {
  beforeEach(() => {
    const localStorageStore = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn((key: string) => localStorageStore.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageStore.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
          localStorageStore.delete(key);
        }),
      },
      api: {
        openWorkspaceDialog: vi.fn(),
        loadWorkspace: vi.fn(),
        fetchProviderCapabilities: vi.fn(),
        getProviderCapabilities: vi.fn().mockResolvedValue({}),
        runWorkflow: vi.fn(),
      },
    });

    useWorkflowStore.setState({
      workflowId: 'workflow-a',
      workflowName: 'Guardrail Test',
      workflowRevision: 0,
      lastSavedRevision: 0,
      executionMode: 'auto',
      workspacePath: 'C:\\workspace',
      nodes: [
        {
          id: 'node-a',
          type: 'agentNode',
          position: { x: 0, y: 0 },
          data: {
            provider: 'codex',
            model: 'gpt-5.5',
            prompt: 'Run tests',
            codex: {
              approvalPolicy: 'on-request',
            },
          },
        },
      ],
      edges: [],
      providerCapabilities: {},
      hasFetchedProviderCapabilities: true,
    });

    useExecutionStore.getState().resetExecution(['node-a']);
    useExecutionStore.getState().appendLogs('node-a', ['existing log']);
  });

  it('blocks before reset or run IPC when an interactive approval policy is selected', async () => {
    await runCurrentWorkflow();

    expect(window.api.runWorkflow).not.toHaveBeenCalled();
    expect(useExecutionStore.getState().workflowStatus).toBe('error');
    expect(useExecutionStore.getState().workflowError).toContain(
      'approval_policy=on-request'
    );
    expect(useExecutionStore.getState().terminalLogs['node-a']).toEqual(['existing log']);
  });

  it('allows interactive approval policy when protocol status is supported', async () => {
    useWorkflowStore.setState({
      providerCapabilities: {
        codex: {
          provider: 'codex',
          displayName: 'Codex',
          available: true,
          auth: {
            type: 'cli-login',
            status: 'authenticated',
            loginCommand: 'codex login',
          },
          readiness: {
            code: 'ready',
            blocking: false,
            title: 'Codex CLI ready.',
            message: 'Ready.',
            catalogSource: 'live',
          },
          models: [
            {
              id: 'gpt-5.5',
              displayName: 'GPT-5.5',
              visibility: 'list',
              supportedReasoningLevels: [],
            },
          ],
          parameters: [],
          approvalProtocol: {
            status: 'supported',
            message: 'Probe supported.',
          },
        },
      },
    });

    await runCurrentWorkflow();

    expect(window.api.runWorkflow).toHaveBeenCalledTimes(1);
    expect(useExecutionStore.getState().workflowStatus).toBe('running');
  });

  it('prompts for trust before opening an untrusted workspace', async () => {
    const requestWorkspaceTrust = vi.fn(async () => true);
    window.api.openWorkspaceDialog = vi.fn().mockResolvedValue('C:\\Workspace');
    window.api.loadWorkspace = vi.fn().mockResolvedValue({
      workspacePath: 'C:\\Workspace',
      workflow: { id: 'w1', name: 'Workflow', executionMode: 'auto', nodes: [], edges: [] },
      activeWorkflowFilePath: 'C:\\Workspace\\.fluxion\\workflows\\workflow.fluxion.json',
      activeWorkflowId: 'w1',
      workflows: [],
      isNewWorkspace: true,
      contextStatus: 'missing',
      contextSummary: null,
      legacyWorkflowDetected: false,
    });

    await openWorkspaceFromDialog(requestWorkspaceTrust);

    expect(requestWorkspaceTrust).toHaveBeenCalledWith('C:\\Workspace');
    expect(window.api.loadWorkspace).toHaveBeenCalledWith('C:\\Workspace');
    expect(shouldPromptWorkspaceTrust('C:\\Workspace')).toBe(false);
  });

  it('skips trust prompt for a trusted workspace path', async () => {
    markWorkspaceAsTrusted('C:\\Trusted');
    const requestWorkspaceTrust = vi.fn(async () => true);
    window.api.openWorkspaceDialog = vi.fn().mockResolvedValue('C:\\Trusted');
    window.api.loadWorkspace = vi.fn().mockResolvedValue({
      workspacePath: 'C:\\Trusted',
      workflow: { id: 'w2', name: 'Workflow', executionMode: 'auto', nodes: [], edges: [] },
      activeWorkflowFilePath: 'C:\\Trusted\\.fluxion\\workflows\\workflow.fluxion.json',
      activeWorkflowId: 'w2',
      workflows: [],
      isNewWorkspace: false,
      contextStatus: 'missing',
      contextSummary: null,
      legacyWorkflowDetected: false,
    });

    await openWorkspaceFromDialog(requestWorkspaceTrust);

    expect(requestWorkspaceTrust).not.toHaveBeenCalled();
    expect(window.api.loadWorkspace).toHaveBeenCalledWith('C:\\Trusted');
  });

  it('does not open the workspace when trust is declined', async () => {
    const requestWorkspaceTrust = vi.fn(async () => false);
    window.api.openWorkspaceDialog = vi.fn().mockResolvedValue('C:\\Declined');
    window.api.loadWorkspace = vi.fn();

    await openWorkspaceFromDialog(requestWorkspaceTrust);

    expect(requestWorkspaceTrust).toHaveBeenCalledWith('C:\\Declined');
    expect(window.api.loadWorkspace).not.toHaveBeenCalled();
    expect(shouldPromptWorkspaceTrust('C:\\Declined')).toBe(true);
  });
});
