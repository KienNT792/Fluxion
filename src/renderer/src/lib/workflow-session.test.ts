import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceOpenedPayload } from '@shared'
import {
  approveReviewNode,
  getContextEntryBehavior,
  hydrateWorkspaceState,
  markWorkspaceAsTrusted,
  openWorkspaceFromDialog,
  runCurrentWorkflow,
  shouldPromptWorkspaceTrust
} from './workflow-session'
import { useExecutionStore } from '../stores/execution.store'
import { useWorkflowStore } from '../stores/workflow.store'

describe('runCurrentWorkflow approval guardrail', () => {
  beforeEach(() => {
    const localStorageStore = new Map<string, string>()
    const trustedWorkspaces = new Set<string>()
    const normalizePath = (value: string): string => value.replace(/\\/g, '/').toLowerCase()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn((key: string) => localStorageStore.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageStore.set(key, value)
        }),
        removeItem: vi.fn((key: string) => {
          localStorageStore.delete(key)
        })
      },
      api: {
        openWorkspaceDialog: vi.fn(),
        loadWorkspace: vi.fn(),
        isWorkspaceTrusted: vi.fn(async (workspacePath: string) =>
          trustedWorkspaces.has(normalizePath(workspacePath))
        ),
        trustWorkspace: vi.fn(async (workspacePath: string) => {
          trustedWorkspaces.add(normalizePath(workspacePath))
        }),
        migrateRendererTrustedWorkspaceCache: vi.fn(async (workspacePaths: string[]) => {
          workspacePaths.forEach((workspacePath) => {
            trustedWorkspaces.add(normalizePath(workspacePath))
          })
        }),
        fetchProviderCapabilities: vi.fn(),
        getProviderCapabilities: vi.fn().mockResolvedValue({}),
        runWorkflow: vi.fn(),
        readWorkspaceTextFile: vi.fn(),
        approveWorkflowNode: vi.fn(),
        rejectWorkflowNode: vi.fn(),
        rerunWorkflowNode: vi.fn()
      }
    })

    useWorkflowStore.setState({
      workflowId: 'workflow-a',
      workflowName: 'Guardrail Test',
      workflowRevision: 0,
      lastSavedRevision: 0,
      executionMode: 'auto',
      workspacePath: 'C:\\workspace',
      terminalNodeId: null,
      terminalFollowMode: 'auto',
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
              approvalPolicy: 'on-request'
            }
          }
        }
      ],
      edges: [],
      providerCapabilities: {},
      hasFetchedProviderCapabilities: true
    })

    useExecutionStore.getState().resetExecution(['node-a'])
    useExecutionStore.getState().appendLogs('node-a', ['existing log'])
  })

  it('blocks before reset or run IPC when an interactive approval policy is selected', async () => {
    await runCurrentWorkflow()

    expect(window.api.runWorkflow).not.toHaveBeenCalled()
    expect(useExecutionStore.getState().workflowStatus).toBe('error')
    expect(useExecutionStore.getState().workflowError).toContain('approval_policy=on-request')
    expect(useExecutionStore.getState().terminalLogs['node-a']).toEqual(['existing log'])
  })

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
            loginCommand: 'codex login'
          },
          readiness: {
            code: 'ready',
            blocking: false,
            title: 'Codex CLI ready.',
            message: 'Ready.',
            catalogSource: 'live'
          },
          models: [
            {
              id: 'gpt-5.5',
              displayName: 'GPT-5.5',
              visibility: 'list',
              supportedReasoningLevels: []
            }
          ],
          parameters: [],
          approvalProtocol: {
            status: 'supported',
            message: 'Probe supported.'
          }
        }
      }
    })

    await runCurrentWorkflow()

    expect(window.api.runWorkflow).toHaveBeenCalledTimes(1)
    expect(useExecutionStore.getState().workflowStatus).toBe('running')
  })

  it('resets terminal follow mode and active terminal node for a brand-new workflow run', async () => {
    useWorkflowStore.setState({
      terminalNodeId: 'node-a',
      terminalFollowMode: 'manual',
      providerCapabilities: {
        codex: {
          provider: 'codex',
          displayName: 'Codex',
          available: true,
          auth: {
            type: 'cli-login',
            status: 'authenticated',
            loginCommand: 'codex login'
          },
          readiness: {
            code: 'ready',
            blocking: false,
            title: 'Codex CLI ready.',
            message: 'Ready.',
            catalogSource: 'live'
          },
          models: [
            {
              id: 'gpt-5.5',
              displayName: 'GPT-5.5',
              visibility: 'list',
              supportedReasoningLevels: []
            }
          ],
          parameters: [],
          approvalProtocol: {
            status: 'supported',
            message: 'Probe supported.'
          }
        }
      }
    })

    await runCurrentWorkflow()

    expect(window.api.runWorkflow).toHaveBeenCalledTimes(1)
    expect(useWorkflowStore.getState().terminalFollowMode).toBe('auto')
    expect(useWorkflowStore.getState().terminalNodeId).toBeNull()
  })

  it('prompts for trust before opening an untrusted workspace', async () => {
    const requestWorkspaceTrust = vi.fn(async () => true)
    window.api.openWorkspaceDialog = vi.fn().mockResolvedValue('C:\\Workspace')
    window.api.loadWorkspace = vi.fn().mockResolvedValue({
      workspacePath: 'C:\\Workspace',
      workflow: { id: 'w1', name: 'Workflow', executionMode: 'auto', nodes: [], edges: [] },
      activeWorkflowFilePath: 'C:\\Workspace\\.fluxion\\workflows\\workflow.fluxion.json',
      activeWorkflowId: 'w1',
      workflows: [],
      isNewWorkspace: true,
      contextStatus: 'missing',
      contextSummary: null,
      legacyWorkflowDetected: false
    })

    await openWorkspaceFromDialog(requestWorkspaceTrust)

    expect(requestWorkspaceTrust).toHaveBeenCalledWith('C:\\Workspace')
    expect(window.api.loadWorkspace).toHaveBeenCalledWith('C:\\Workspace')
    await expect(shouldPromptWorkspaceTrust('C:\\Workspace')).resolves.toBe(false)
  })

  it('skips trust prompt for a trusted workspace path', async () => {
    await markWorkspaceAsTrusted('C:\\Trusted')
    const requestWorkspaceTrust = vi.fn(async () => true)
    window.api.openWorkspaceDialog = vi.fn().mockResolvedValue('C:\\Trusted')
    window.api.loadWorkspace = vi.fn().mockResolvedValue({
      workspacePath: 'C:\\Trusted',
      workflow: { id: 'w2', name: 'Workflow', executionMode: 'auto', nodes: [], edges: [] },
      activeWorkflowFilePath: 'C:\\Trusted\\.fluxion\\workflows\\workflow.fluxion.json',
      activeWorkflowId: 'w2',
      workflows: [],
      isNewWorkspace: false,
      contextStatus: 'missing',
      contextSummary: null,
      legacyWorkflowDetected: false
    })

    await openWorkspaceFromDialog(requestWorkspaceTrust)

    expect(requestWorkspaceTrust).not.toHaveBeenCalled()
    expect(window.api.loadWorkspace).toHaveBeenCalledWith('C:\\Trusted')
  })

  it('does not open the workspace when trust is declined', async () => {
    const requestWorkspaceTrust = vi.fn(async () => false)
    window.api.openWorkspaceDialog = vi.fn().mockResolvedValue('C:\\Declined')
    window.api.loadWorkspace = vi.fn()

    await openWorkspaceFromDialog(requestWorkspaceTrust)

    expect(requestWorkspaceTrust).toHaveBeenCalledWith('C:\\Declined')
    expect(window.api.loadWorkspace).not.toHaveBeenCalled()
    await expect(shouldPromptWorkspaceTrust('C:\\Declined')).resolves.toBe(true)
  })

  it('maps context entry behavior without auto-opening incomplete or legacy context', () => {
    const basePayload: Omit<WorkspaceOpenedPayload, 'contextStatus'> = {
      workspacePath: 'C:\\Workspace',
      workflow: { id: 'w1', name: 'Workflow', executionMode: 'auto', nodes: [], edges: [] },
      activeWorkflowFilePath: 'C:\\Workspace\\.fluxion\\workflows\\workflow.fluxion.json',
      activeWorkflowId: 'w1',
      workflows: [],
      isNewWorkspace: false,
      contextSummary: null,
      legacyWorkflowDetected: false
    }

    expect(getContextEntryBehavior({ ...basePayload, contextStatus: 'missing' })).toMatchObject({
      autoOpenModal: true,
      showIncompleteBanner: false,
      showLegacyBanner: false
    })
    expect(getContextEntryBehavior({ ...basePayload, contextStatus: 'incomplete' })).toMatchObject({
      autoOpenModal: false,
      showIncompleteBanner: true,
      showLegacyBanner: false
    })
    expect(
      getContextEntryBehavior({
        ...basePayload,
        contextStatus: 'legacy',
        legacyWorkflowDetected: true
      })
    ).toMatchObject({
      autoOpenModal: false,
      showIncompleteBanner: false,
      showLegacyBanner: true
    })
    expect(getContextEntryBehavior({ ...basePayload, contextStatus: 'ready' })).toMatchObject({
      autoOpenModal: false,
      showIncompleteBanner: false,
      showLegacyBanner: false
    })
  })

  it('hydrates paused review state from recovered workspace payload', () => {
    const payload: WorkspaceOpenedPayload = {
      workspacePath: 'C:\\Workspace',
      workflow: {
        id: 'workflow-recovered',
        name: 'Recovered Workflow',
        executionMode: 'auto',
        nodes: [
          {
            id: 'node-a',
            type: 'agentNode',
            label: 'Node A',
            position: { x: 0, y: 0 },
            data: {
              provider: 'codex',
              model: 'gpt-5.5',
              prompt: 'Review output'
            }
          }
        ],
        edges: []
      },
      activeWorkflowFilePath: 'C:\\Workspace\\.fluxion\\workflows\\recovered.fluxion.json',
      activeWorkflowId: 'workflow-recovered',
      workflows: [],
      isNewWorkspace: false,
      contextStatus: 'ready',
      contextSummary: null,
      legacyWorkflowDetected: false,
      recoveredReview: {
        workflowId: 'workflow-recovered',
        runId: 'run-1',
        nodeIds: ['node-a'],
        nodeOutputPaths: {
          'node-a': 'C:\\Workspace\\.fluxion\\memory\\short-term\\workflow-recovered\\node-a.md'
        },
        nodeAttemptCounts: {
          'node-a': 3
        },
        executionMode: 'auto',
        updatedAt: '2026-05-15T02:01:00.000Z'
      }
    }

    hydrateWorkspaceState(payload)

    const executionState = useExecutionStore.getState()
    const workflowState = useWorkflowStore.getState()
    expect(executionState.workflowStatus).toBe('paused')
    expect(executionState.activeRunId).toBe('run-1')
    expect(executionState.reviewNodeIds).toEqual(['node-a'])
    expect(executionState.nodeStatuses['node-a']).toBe('paused')
    expect(executionState.nodeOutputPaths['node-a']).toContain('node-a.md')
    expect(executionState.nodeAttemptCounts['node-a']).toBe(3)
    expect(workflowState.terminalNodeId).toBe('node-a')
    expect(workflowState.selectedNodeId).toBe('node-a')
    expect(workflowState.reviewFocusRequest).toMatchObject({
      nodeId: 'node-a'
    })
  })

  it('blocks approve for a recovered review when the output file cannot be read', async () => {
    useExecutionStore.getState().setActiveRunId('run-1')
    useExecutionStore.getState().addReviewNode('node-a')
    useExecutionStore.getState().setNodeStatus('node-a', 'paused')
    useExecutionStore
      .getState()
      .setNodeOutputPath(
        'node-a',
        'C:\\Workspace\\.fluxion\\memory\\short-term\\workflow-a\\node-a.md'
      )
    window.api.readWorkspaceTextFile = vi.fn().mockRejectedValue(new Error('missing'))

    await approveReviewNode('node-a')

    expect(window.api.approveWorkflowNode).not.toHaveBeenCalled()
    expect(useExecutionStore.getState().workflowError).toContain('output file is missing')
  })
})
