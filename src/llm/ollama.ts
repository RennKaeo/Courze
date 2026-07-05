import { LLMProvider, Message, ChatOptions, ChatResponse, ChatStreamChunk, ContentPart, ToolCall } from './provider.js'

function isTextContent(content: string | ContentPart[]): content is string {
  return typeof content === 'string'
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

interface OllamaMessage {
  role: string
  content: string
  images?: string[]
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> }
  }>
}

function toOllamaMessages(messages: Message[]): OllamaMessage[] {
  const result: OllamaMessage[] = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      const content = isTextContent(msg.content) ? msg.content : msg.content.filter(c => c.type === 'text').map(c => (c as { type: 'text'; text: string }).text).join('')
      result.push({ role: 'system', content })
      continue
    }

    if (msg.role === 'assistant') {
      const olMsg: OllamaMessage = {
        role: 'assistant',
        content: isTextContent(msg.content) ? msg.content : msg.content.filter(c => c.type === 'text').map(c => (c as { type: 'text'; text: string }).text).join(''),
      }
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        olMsg.tool_calls = msg.tool_calls.map(tc => ({
          function: {
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          },
        }))
      }
      result.push(olMsg)
      continue
    }

    if (msg.role === 'tool') {
      const content = isTextContent(msg.content) ? msg.content : JSON.stringify(msg.content)
      result.push({ role: 'tool', content })
      continue
    }

    if (msg.role === 'user') {
      if (isTextContent(msg.content)) {
        result.push({ role: 'user', content: msg.content })
      } else {
        let text = ''
        const images: string[] = []
        for (const part of msg.content) {
          if (part.type === 'text') {
            text += part.text
          } else {
            images.push(part.source.data)
          }
        }
        const olMsg: OllamaMessage = { role: 'user', content: text }
        if (images.length > 0) olMsg.images = images
        result.push(olMsg)
      }
      continue
    }
  }

  return result
}

export class OllamaProvider extends LLMProvider {
  private baseUrl: string
  private defaultModel: string

  constructor(config: { apiKey?: string; model?: string; baseUrl?: string }) {
    super('ollama', true)
    this.baseUrl = (config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '')
    this.defaultModel = config.model || 'llama3'
  }

  private async request(endpoint: string, body: unknown): Promise<Response> {
    return fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    try {
      const ollamaMessages = toOllamaMessages(messages)

      const tools = options?.tools?.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }))

      const response = await this.request('/api/chat', {
        model: options?.model || this.defaultModel,
        messages: ollamaMessages,
        stream: false,
        options: {
          num_predict: options?.maxTokens,
          temperature: options?.temperature,
        },
        tools: tools && tools.length > 0 ? tools : undefined,
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Ollama API error ${response.status}: ${errText}`)
      }

      const data = await response.json()
      return this.fromOllamaResponse(data)
    } catch (error: any) {
      return {
        content: `Ollama error: ${error.message || error}`,
        finishReason: 'error',
      }
    }
  }

  private fromOllamaResponse(data: any): ChatResponse {
    const message = data.message || {}
    let content = message.content || ''
    const tool_calls: ToolCall[] = []

    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        tool_calls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: JSON.stringify(tc.function.arguments),
          },
        })
      }
    }

    return {
      content,
      tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
      usage: data.prompt_eval_count
        ? {
            promptTokens: data.prompt_eval_count,
            completionTokens: data.eval_count || 0,
            totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
          }
        : undefined,
      finishReason: data.done ? 'stop' : 'error',
    }
  }

  async *chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<ChatStreamChunk> {
    try {
      const ollamaMessages = toOllamaMessages(messages)

      const tools = options?.tools?.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }))

      const response = await this.request('/api/chat', {
        model: options?.model || this.defaultModel,
        messages: ollamaMessages,
        stream: true,
        options: {
          num_predict: options?.maxTokens,
          temperature: options?.temperature,
        },
        tools: tools && tools.length > 0 ? tools : undefined,
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Ollama API error ${response.status}: ${errText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body stream')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let usageData: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const data = JSON.parse(line)
            const msg = data.message || {}

            if (msg.content) {
              yield { type: 'text', content: msg.content }
            }

            if (msg.tool_calls) {
              for (const tc of msg.tool_calls) {
                yield {
                  type: 'tool_call',
                  tool_call: {
                    id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    type: 'function',
                    function: {
                      name: tc.function.name,
                      arguments: JSON.stringify(tc.function.arguments),
                    },
                  },
                }
              }
            }

            if (data.done) {
              if (data.prompt_eval_count) {
                usageData = {
                  promptTokens: data.prompt_eval_count,
                  completionTokens: data.eval_count || 0,
                  totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
                }
              }
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }

      yield { type: 'done', usage: usageData }
    } catch (error: any) {
      yield { type: 'text', content: `Ollama error: ${error.message || error}` }
      yield { type: 'done' }
    }
  }

  async countTokens(messages: Message[]): Promise<number> {
    let total = 0
    for (const msg of messages) {
      if (isTextContent(msg.content)) {
        total += estimateTokens(msg.content)
      } else {
        for (const part of msg.content) {
          if (part.type === 'text') {
            total += estimateTokens(part.text)
          } else {
            total += 1000
          }
        }
      }
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          total += estimateTokens(tc.function.name + tc.function.arguments)
        }
      }
    }
    return total
  }
}
