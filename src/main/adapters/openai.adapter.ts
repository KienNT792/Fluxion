import {
  AbortReason,
  AgentChunk,
  AgentNodeData,
  AgentResult,
  NodeId,
  OPENAI_DEFAULT_MODEL,
  OPENAI_DEFAULT_REASONING_LEVEL,
  isOpenAIReasoningModel
} from '@shared'
import { BaseAdapter, ExecutionPrompt } from './base.adapter'
import { settingsService } from '../services/settings.service'

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const OPENAI_REQUEST_TIMEOUT_MS = 120_000

interface OpenAIErrorPayload {
  error?: {
    message?: string
    code?: string
    type?: string
  }
}

interface OpenAIResponseBody {
  status?: string
  output?: Array<{
    type?: string
    content?: Array<{
      type?: string
      text?: string
    }>
  }>
  error?: {
    message?: string
    code?: string
    type?: string
  } | null
  incomplete_details?: {
    reason?: string
  } | null
}

function buildAbortMessage(reason: AbortReason): string {
  switch (reason) {
    case AbortReason.ENGINE_HALTED:
      return 'OpenAI request was cancelled because the workflow was halted.'
    case AbortReason.USER_REQUESTED:
      return 'OpenAI request was cancelled by the user.'
    default:
      return 'OpenAI request was cancelled.'
  }
}

function extractApiErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined
  }

  const { error } = payload as OpenAIErrorPayload
  if (!error || typeof error.message !== 'string') {
    return undefined
  }

  return error.message.trim() || undefined
}

function extractOutputText(payload: OpenAIResponseBody): string {
  const chunks: string[] = []

  for (const item of payload.output ?? []) {
    if (item.type !== 'message' || !Array.isArray(item.content)) {
      continue
    }

    for (const contentItem of item.content) {
      if (contentItem.type === 'output_text' && typeof contentItem.text === 'string') {
        chunks.push(contentItem.text)
      }
    }
  }

  return chunks.join('\n').trim()
}

function mapHttpError(status: number, apiMessage?: string): string {
  const suffix = apiMessage ? ` ${apiMessage}` : ''

  switch (status) {
    case 400:
      return `OpenAI rejected the request. Check the model or parameters.${suffix}`.trim()
    case 401:
      return `OpenAI authentication failed. Check OPENAI_API_KEY.${suffix}`.trim()
    case 403:
      return `OpenAI access was denied. Check project permissions or model access.${suffix}`.trim()
    case 404:
      return `OpenAI model or endpoint was not found.${suffix}`.trim()
    case 429:
      return `OpenAI rate limit or quota was exceeded. Retry later or check billing.${suffix}`.trim()
    default:
      if (status >= 500) {
        return `OpenAI returned a server error (${status}). Retry shortly.${suffix}`.trim()
      }

      return `OpenAI request failed with status ${status}.${suffix}`.trim()
  }
}

function mapNetworkError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'OpenAI request failed due to an unknown network error.'
  }

  if (error.name === 'AbortError') {
    return 'OpenAI request was aborted.'
  }

  return `OpenAI network request failed: ${error.message}`
}

export class OpenAIAdapter extends BaseAdapter {
  private controllers: Map<NodeId, AbortController> = new Map()
  private abortReasons: Map<NodeId, AbortReason> = new Map()
  private timedOutNodes: Set<NodeId> = new Set()

  public async *execute(
    nodeId: NodeId,
    nodeData: AgentNodeData,
    prompt: ExecutionPrompt,
    _workspacePath: string
  ): AsyncGenerator<AgentChunk, AgentResult, void> {
    void _workspacePath
    this.activeExecutions.add(nodeId)
    this.abortReasons.delete(nodeId)
    this.timedOutNodes.delete(nodeId)

    const apiKey = await settingsService.resolveOpenAIApiKey()
    if (!apiKey) {
      const error = 'OpenAI API key is missing. Set it in Global Settings or via OPENAI_API_KEY.'
      yield this.createChunk('stderr', `${error}\n`)
      this.activeExecutions.delete(nodeId)
      return {
        success: false,
        error,
        exitCode: 78
      }
    }

    const controller = new AbortController()
    this.controllers.set(nodeId, controller)

    const timeoutHandle = setTimeout(() => {
      this.timedOutNodes.add(nodeId)
      controller.abort()
    }, OPENAI_REQUEST_TIMEOUT_MS)

    const model =
      typeof nodeData.model === 'string' && nodeData.model.trim().length > 0
        ? nodeData.model.trim()
        : OPENAI_DEFAULT_MODEL
    const isReasoningModel = isOpenAIReasoningModel(model)
    const maxTokens =
      typeof nodeData.maxTokens === 'number' &&
      Number.isFinite(nodeData.maxTokens) &&
      nodeData.maxTokens > 0
        ? Math.floor(nodeData.maxTokens)
        : undefined
    const temperature =
      !isReasoningModel &&
      typeof nodeData.temperature === 'number' &&
      Number.isFinite(nodeData.temperature)
        ? nodeData.temperature
        : undefined
    const reasoningEffort = isReasoningModel
      ? (nodeData.reasoningLevel ?? OPENAI_DEFAULT_REASONING_LEVEL)
      : undefined

    const requestBody: Record<string, unknown> = {
      model,
      input: prompt.input,
      store: false,
      text: {
        format: {
          type: 'text'
        }
      }
    }

    if (prompt.instructions) {
      requestBody.instructions = prompt.instructions
    }

    if (typeof maxTokens === 'number') {
      requestBody.max_output_tokens = maxTokens
    }

    if (typeof temperature === 'number') {
      requestBody.temperature = temperature
    }

    if (reasoningEffort) {
      requestBody.reasoning = {
        effort: reasoningEffort
      }
    }

    yield this.createChunk('status', `Calling OpenAI Responses API with model ${model}.`)

    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })

      const rawBody = await response.text()
      let parsedBody: OpenAIResponseBody | OpenAIErrorPayload = {}

      if (rawBody.trim().length > 0) {
        try {
          parsedBody = JSON.parse(rawBody) as OpenAIResponseBody | OpenAIErrorPayload
        } catch {
          parsedBody = {}
        }
      }

      if (!response.ok) {
        const error = mapHttpError(response.status, extractApiErrorMessage(parsedBody))
        yield this.createChunk('stderr', `${error}\n`)
        return {
          success: false,
          error,
          exitCode: response.status
        }
      }

      const payload = parsedBody as OpenAIResponseBody
      if (payload.status === 'failed') {
        const error = payload.error?.message?.trim() || 'OpenAI response failed.'
        yield this.createChunk('stderr', `${error}\n`)
        return {
          success: false,
          error,
          exitCode: 1
        }
      }

      if (payload.status === 'incomplete') {
        const reason = payload.incomplete_details?.reason?.trim() || 'unknown'
        const error = `OpenAI response ended incomplete (${reason}).`
        yield this.createChunk('stderr', `${error}\n`)
        return {
          success: false,
          error,
          exitCode: 1
        }
      }

      const outputText = extractOutputText(payload)
      if (!outputText) {
        const error = 'OpenAI response completed without any text output.'
        yield this.createChunk('stderr', `${error}\n`)
        return {
          success: false,
          error,
          exitCode: 1
        }
      }

      yield this.createChunk('stdout', outputText.endsWith('\n') ? outputText : `${outputText}\n`)

      return {
        success: true,
        exitCode: 0
      }
    } catch (error) {
      const abortReason = this.abortReasons.get(nodeId)
      if (abortReason) {
        return {
          success: false,
          error: buildAbortMessage(abortReason),
          abortReason
        }
      }

      if (this.timedOutNodes.has(nodeId)) {
        const timeoutError = `OpenAI request timed out after ${OPENAI_REQUEST_TIMEOUT_MS / 1000}s.`
        yield this.createChunk('stderr', `${timeoutError}\n`)
        return {
          success: false,
          error: timeoutError,
          exitCode: 124
        }
      }

      const networkError = mapNetworkError(error)
      yield this.createChunk('stderr', `${networkError}\n`)
      return {
        success: false,
        error: networkError,
        exitCode: 1
      }
    } finally {
      clearTimeout(timeoutHandle)
      this.controllers.delete(nodeId)
      this.timedOutNodes.delete(nodeId)
      this.activeExecutions.delete(nodeId)
    }
  }

  protected async onAbort(nodeId: NodeId, reason: AbortReason): Promise<void> {
    this.abortReasons.set(nodeId, reason)
    this.controllers.get(nodeId)?.abort()
  }
}
