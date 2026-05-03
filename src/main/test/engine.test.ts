import { IpcChannels, Workflow } from '@shared'
import { workflowEngine } from '../services/workflow-engine'

export async function runEngineTest(): Promise<void> {
  console.log('\n=============================================')
  console.log('RUNNING WORKFLOW ENGINE MVP TEST')
  console.log('=============================================\n')

  const testWorkspace = process.cwd()

  const workflow: Workflow = {
    id: 'test-wf-1',
    name: 'Test Workflow',
    nodes: [
      {
        id: 'node-A',
        type: 'agentNode',
        label: 'Node A',
        position: { x: 0, y: 0 },
        data: {
          prompt: 'Generate some test log for Node A',
          systemInstruction: '',
          maxTokens: 100,
          provider: 'mock',
          model: 'mock-agent'
        }
      },
      {
        id: 'node-B',
        type: 'agentNode',
        label: 'Node B',
        position: { x: 200, y: 0 },
        data: {
          prompt: 'Generate some test log for Node B based on Node A',
          systemInstruction: '',
          maxTokens: 100,
          provider: 'mock',
          model: 'mock-agent'
        }
      }
    ],
    edges: [
      {
        id: 'edge-A-B',
        source: 'node-A',
        target: 'node-B'
      }
    ]
  }

  const mockSender = {
    send: (channel: string, payload: Record<string, unknown>) => {
      if (channel === IpcChannels.TERMINAL_DATA_BATCH) {
        console.log(`[IPC: STREAM] Node: ${payload.nodeId} | Got ${(payload.batch as unknown[]).length} chunks`)
      } else if (channel === IpcChannels.TERMINAL_ERROR) {
        console.log(`[IPC: ERROR] Node: ${payload.nodeId} -> ${payload.error}`)
      } else if (channel === IpcChannels.TERMINAL_EXIT) {
        console.log(`[IPC: EXIT] Node: ${payload.nodeId} -> ${payload.code}`)
      } else if (channel === IpcChannels.WORKFLOW_NODE_STATUS) {
        console.log(`[IPC: STATUS] Node: ${payload.nodeId} -> ${payload.status}`)
      } else if (channel === IpcChannels.MEMORY_CONTEXT_READY) {
        console.log(`[IPC: MEMORY] Context compiled for Node: ${payload.nodeId}`)
      } else if (channel === IpcChannels.WORKFLOW_NODE_OUTPUT) {
        console.log(`[IPC: OUTPUT_SAVED] Node: ${payload.nodeId} -> ${payload.outputFilePath}`)
      } else if (channel === IpcChannels.WORKFLOW_COMPLETED) {
        console.log(
          `\n[IPC: WORKFLOW_COMPLETED] Success: ${payload.success} | Time: ${payload.totalTimeMs}ms | Aborted: ${payload.aborted ?? false}\n`
        )

        if (payload.success) {
          console.log('DAG execution test completed successfully.')
          process.exit(0)
        }

        console.error(`DAG execution test failed: ${payload.error ?? 'Unknown error'}`)
        process.exit(1)
      }
    }
  } as unknown as Electron.WebContents

  console.log('Starting Engine with mock DAG: Node A -> Node B\n')
  await workflowEngine.start(workflow, testWorkspace, mockSender)
}
