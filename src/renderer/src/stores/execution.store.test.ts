import { beforeEach, describe, expect, it } from 'vitest'
import { useExecutionStore } from './execution.store'

describe('execution store terminal logs', () => {
  beforeEach(() => {
    useExecutionStore.getState().resetExecution(['node-a'])
  })

  it('keeps appending with a monotonic cursor after logs are capped', () => {
    const initialBatch = Array.from({ length: 1005 }, (_, index) => `line-${index}`)

    useExecutionStore.getState().appendLogs('node-a', initialBatch)

    expect(useExecutionStore.getState().terminalLogs['node-a']).toHaveLength(1000)
    expect(useExecutionStore.getState().terminalLogs['node-a']?.[0]).toBe('line-5')
    expect(useExecutionStore.getState().terminalLogCursors['node-a']).toBe(1005)

    useExecutionStore.getState().appendLogs('node-a', ['line-new'])

    const state = useExecutionStore.getState()
    expect(state.terminalLogs['node-a']).toHaveLength(1000)
    expect(state.terminalLogs['node-a']?.at(-1)).toBe('line-new')
    expect(state.terminalLogCursors['node-a']).toBe(1006)
  })

  it('clears retained logs and resets the cursor', () => {
    useExecutionStore.getState().appendLogs('node-a', ['one', 'two'])

    useExecutionStore.getState().clearLogs('node-a')

    expect(useExecutionStore.getState().terminalLogs['node-a']).toEqual([])
    expect(useExecutionStore.getState().terminalLogCursors['node-a']).toBe(0)
  })

  it('adds attempt separators without clearing prior logs', () => {
    useExecutionStore.getState().appendLogs('node-a', ['previous output'])

    const attempt = useExecutionStore
      .getState()
      .appendAttemptSeparator('node-a', 'Review rerun started.')

    const state = useExecutionStore.getState()
    expect(attempt).toBe(2)
    expect(state.nodeAttemptCounts['node-a']).toBe(2)
    expect(state.terminalLogs['node-a']).toHaveLength(2)
    expect(state.terminalLogs['node-a']?.[0]).toBe('previous output')
    expect(state.terminalLogs['node-a']?.[1]).toContain('[attempt 2] Review rerun started.')
  })

  it('preserves terminal history when resetting a node for retry', () => {
    useExecutionStore.getState().appendLogs('node-a', ['old output'])
    useExecutionStore.getState().setNodeStatus('node-a', 'error')
    useExecutionStore.getState().setNodeError('node-a', 'boom')
    useExecutionStore.getState().setNodeOutputPath('node-a', 'C:\\temp\\node-a.md')

    useExecutionStore.getState().resetNodeExecution(['node-a'])

    const state = useExecutionStore.getState()
    expect(state.nodeStatuses['node-a']).toBe('idle')
    expect(state.nodeErrors['node-a']).toBeUndefined()
    expect(state.nodeOutputPaths['node-a']).toBeUndefined()
    expect(state.terminalLogs['node-a']).toEqual(['old output'])
  })
})
