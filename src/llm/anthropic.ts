import Anthropic from '@anthropic-ai/sdk'
import { LLMProvider, Message, ChatOptions, ChatResponse, ChatStreamChunk, ContentPart, ToolCall } from './provider.js'

function isTextContent(content: string | ContentPart[]): content is string {
  return typeof content === 'string'
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function toAnthropicMessages(messages: Message[]): { system: string; messages: Anthropic.MessageParam[] } {
  let system = ''
  const msgs: Anthropic.MessageParam[] = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      const text = isTextContent(msg.content) ? msg.content : msg.content.filter(c => c.type === 'text').map(c => (c as { type: 'text'; text: string }).text).join('')
      system += (system ? '\n' : '') + text
      continue
    }

    if (msg.role === 'user') {
      if (isTextContent(msg.content)) {
        msgs.push({ role: 'user', content: msg.content })
      } else {
        const blocks: Anthropic.ContentBlockParam[] = msg.content.map((part) => {
          if (part.type === 'text') {
            return { type: 'text', text: part.text }
          }
          return {
            type: 'image',
            source: { type: 'base64', media_type: part.source.media_type, data: part.source.data },
          } as Anthropic.ImageBlockParam
        })
        msgs.push({ role: 'user', content: blocks })
      }
      continue
    }

    if (msg.role === 'assistant') {
      const blocks: Anthropic.ContentBlockParam[] = []

      if (msg.content) {
        const text = isTextContent(msg.content) ? msg.content : msg.content.filter(c => c.type === 'text').map(c => (c as { type: 'text'; text: string }).text).join('')
        if (text) {
          blocks.push({ type: 'text', text })
        }
      }

      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          })
        }
      }

      msgs.push({ role: 'assistant', content: blocks })
      continue
    }

    if (msg.role === 'tool') {
      const content = isTextContent(msg.content) ? msg.content : JSON.stringify(msg.content)
      msgs.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: msg.tool_call_id!,
            content,
          },
        ],
      } as unknown as Anthropic.MessageParam)
      continue
    }
  }

  return { system, messages: msgs }
}

function fromAnthropicResponse(response: Anthropic.Message): ChatResponse {
  let content = ''
  const tool_calls: ToolCall[] = []

  for (const block of response.content) {
    if (block.type === 'text') {
      content += block.text
    } else if (block.type === 'tool_use') {
      tool_calls.push({
        id: block.id,
        type: 'function',
        function: { name: block.name, arguments: JSON.stringify(block.input) },
      })
    }
  }

  return {
    content,
    tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
    usage: response.usage
      ? {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        }
      : undefined,
    finishReason: response.stop_reason === 'end_turn' ? 'stop' : response.stop_reason || 'stop',
  }
}

export class AnthropicProvider extends LLMProvider {
  private client: Anthropic
  private defaultModel: string

  constructor(config: { apiKey?: string; model?: string; baseUrl?: string }) {
    super('anthropic', true)
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY || '',
      baseURL: config.baseUrl || undefined,
    })
    this.defaultModel = config.model || 'claude-sonnet-4-20250514'
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    try {
      const { system, messages: anthropicMessages } = toAnthropicMessages(messages)

      const tools: Anthropic.Tool[] | undefined = options?.tools?.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Tool.InputSchema,
      }))

      const response = await this.client.messages.create({
        model: options?.model || this.defaultModel,
        max_tokens: options?.maxTokens ?? 4096,
        system: system || undefined,
        messages: anthropicMessages,
        temperature: options?.temperature,
        tools,
        tool_choice: options?.tool_choice === 'required'
          ? { type: 'any' }
          : options?.tool_choice === 'none'
            ? { type: 'none' }
            : options?.tool_choice === 'auto'
              ? { type: 'auto' }
              : undefined,
      })

      return fromAnthropicResponse(response)
    } catch (error: any) {
      throw new Error(`Anthropic API error: ${error.message || error}`)
    }
  }

  async *chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<ChatStreamChunk> {
    try {
      const { system, messages: anthropicMessages } = toAnthropicMessages(messages)

      const tools: Anthropic.Tool[] | undefined = options?.tools?.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Tool.InputSchema,
      }))

      const stream = await this.client.messages.create({
        model: options?.model || this.defaultModel,
        max_tokens: options?.maxTokens ?? 4096,
        system: system || undefined,
        messages: anthropicMessages,
        temperature: options?.temperature,
        tools,
        tool_choice: options?.tool_choice === 'required'
          ? { type: 'any' }
          : options?.tool_choice === 'none'
            ? { type: 'none' }
            : options?.tool_choice === 'auto'
              ? { type: 'auto' }
              : undefined,
        stream: true,
      })

      let currentToolCall: { id: string; name: string; input: string } | null = null
      let usageData: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield { type: 'text', content: event.delta.text }
          } else if (event.delta.type === 'input_json_delta') {
            if (currentToolCall) {
              currentToolCall.input += event.delta.partial_json
            }
          }
        } else if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            currentToolCall = {
              id: event.content_block.id,
              name: event.content_block.name,
              input: '',
            }
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolCall) {
            yield {
              type: 'tool_call',
              tool_call: {
                id: currentToolCall.id,
                type: 'function',
                function: { name: currentToolCall.name, arguments: currentToolCall.input },
              },
            }
            currentToolCall = null
          }
        } else if (event.type === 'message_delta') {
          const usage = (event as any).usage
          if (usage) {
            usageData = {
              promptTokens: usage.input_tokens,
              completionTokens: usage.output_tokens,
              totalTokens: usage.input_tokens + usage.output_tokens,
            }
          }
        } else if (event.type === 'message_stop') {
          yield { type: 'done', usage: usageData }
        }
      }

      if (!usageData) {
        yield { type: 'done' }
      }
    } catch (error: any) {
      yield { type: 'text', content: `Anthropic API error: ${error.message || error}` }
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
