import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentChunk, AgentNodeData, AgentResult } from '@shared'
import { ExecutionPrompt } from '../adapters/base.adapter'
import { OpenAIAdapter } from '../adapters/openai.adapter'

vi.mock('electron', () => ({
  app: {
    getPath: () => 'C:\\FluxionTest'
  },
  safeStorage: {
    decryptString: () => '',
    encryptString: () => Buffer.from(''),
    isEncryptionAvailable: () => false
  }
}))

interface CapturedRequest {
  body?: string
}

async function runAdapter(
  adapter: OpenAIAdapter,
  prompt: ExecutionPrompt
): Promise<{ chunks: AgentChunk[]; result: AgentResult }> {
  const nodeData: AgentNodeData = {
    provider: 'openai',
    model: 'gpt-5.4-mini',
    prompt: 'Run node'
  }
  const iterator = adapter.execute('node-a', nodeData, prompt, 'D:\\workspace')
  const chunks: AgentChunk[] = []

  while (true) {
    const next = await iterator.next()
    if (next.done) {
      return { chunks, result: next.value }
    }

    chunks.push(next.value)
  }
}

describe('OpenAIAdapter', () => {
  let previousApiKey: string | undefined

  beforeEach(() => {
    previousApiKey = process.env.OPENAI_API_KEY
    process.env.OPENAI_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    if (previousApiKey === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY = previousApiKey
    }
    vi.unstubAllGlobals()
  })

  it('sends OpenAI Responses instructions separately from input', async () => {
    const captured: CapturedRequest = {}
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        captured.body = String(init.body)
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              status: 'completed',
              output: [
                {
                  type: 'message',
                  content: [{ type: 'output_text', text: 'Done' }]
                }
              ]
            })
        }
      })
    )

    const prompt: ExecutionPrompt = {
      layout: 'openai-responses-v1',
      text: '[SYSTEM INSTRUCTION]\nSystem rules\n\n[USER INSTRUCTION]\nRun node\n\n[GLOBAL CONTEXT]\nContext',
      input: '[USER INSTRUCTION]\nRun node\n\n[GLOBAL CONTEXT]\nContext',
      instructions: 'System rules'
    }

    const { result } = await runAdapter(new OpenAIAdapter(), prompt)

    expect(result.success).toBe(true)
    expect(JSON.parse(captured.body ?? '{}')).toMatchObject({
      model: 'gpt-5.4-mini',
      instructions: 'System rules',
      input: '[USER INSTRUCTION]\nRun node\n\n[GLOBAL CONTEXT]\nContext',
      store: false
    })
    expect(JSON.parse(captured.body ?? '{}').input).not.toBe(prompt.text)
  })
})
