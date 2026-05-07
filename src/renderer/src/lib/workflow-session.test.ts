import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runCurrentWorkflow } from './workflow-session';
import { useExecutionStore } from '../stores/execution.store';
import { useWorkflowStore } from '../stores/workflow.store';

describe('runCurrentWorkflow approval guardrail', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      api: {
        fetchProviderCapabilities: vi.fn(),
        getProviderCapabilities: vi.fn(),
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
});
