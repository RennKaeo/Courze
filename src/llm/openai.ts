import OpenAI from 'openai'
import { LLMProvider, Message, ChatOptions, ChatResponse, ChatStreamChunk, ContentPart, ToolCall } from './provider.js'

function isTextContent(content: string | ContentPart[]): content is string {
  return typeof content === 'string'
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function toOpenAIMessages(messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map((msg) => {
    if (msg.role === 'system') {
      const content = isTextContent(msg.content) ? msg.content : msg.content.filter(c => c.type === 'text').map(c => (c as { type: 'text'; text: string }).text).join('')
      return { role: 'system', content } as OpenAI.Chat.ChatCompletionSystemMessageParam
    }

    if (msg.role === 'user') {
      if (isTextContent(msg.content)) {
        return { role: 'user', content: msg.content } as OpenAI.Chat.ChatCompletionUserMessageParam
      }
      const parts: OpenAI.Chat.ChatCompletionContentPart[] = msg.content.map((part) => {
        if (part.type === 'text') {
          return { type: 'text', text: part.text }
        }
        return {
          type: 'image_url',
          image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` },
        }
      })
      return { role: 'user', content: parts } as OpenAI.Chat.ChatCompletionUserMessageParam
    }

    if (msg.role === 'assistant') {
      const result: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: isTextContent(msg.content) ? msg.content : msg.content.filter(c => c.type === 'text').map(c => (c as { type: 'text'; text: string }).text).join(''),
      }
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        result.tool_calls = msg.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        }))
      }
      return result
    }

    if (msg.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: msg.tool_call_id!,
        content: isTextContent(msg.content) ? msg.content : JSON.stringify(msg.content),
      } as OpenAI.Chat.ChatCompletionToolMessageParam
    }

    return { role: 'user', content: isTextContent(msg.content) ? msg.content : JSON.stringify(msg.content) } as OpenAI.Chat.ChatCompletionUserMessageParam
  })
}

function fromOpenAIResponse(completion: OpenAI.Chat.Completions.ChatCompletion): ChatResponse {
  const choice = completion.choices[0]
  const message = choice.message

  let content = message.content || ''
  let tool_calls: ToolCall[] | undefined

  if (message.tool_calls && message.tool_calls.length > 0) {
    tool_calls = message.tool_calls.map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: { name: tc.function.name, arguments: tc.function.arguments },
    }))
  }

  return {
    content,
    tool_calls,
    usage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : undefined,
    finishReason: choice.finish_reason || 'stop',
  }
}

export class OpenAIProvider extends LLMProvider {
  private client: OpenAI
  private defaultModel: string

  constructor(config: { apiKey?: string; model?: string; baseUrl?: string }) {
    super('openai', true)
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY || '',
      baseURL: config.baseUrl || undefined,
    })
    this.defaultModel = config.model || 'gpt-4o'
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    try {
      const openaiMessages = toOpenAIMessages(messages)
      const tools: OpenAI.Chat.ChatCompletionTool[] | undefined = options?.tools?.map(t => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }))

      const completion = await this.client.chat.completions.create({
        model: options?.model || this.defaultModel,
        messages: openaiMessages,
        max_tokens: options?.maxTokens,
        temperature: options?.temperature,
        tools,
        tool_choice: options?.tool_choice as 'auto' | 'required' | undefined,
      })

      return fromOpenAIResponse(completion)
    } catch (error: any) {
      throw new Error(`OpenAI API error: ${error.message || error}`)
    }
  }

  async *chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<ChatStreamChunk> {
    try {
      const openaiMessages = toOpenAIMessages(messages)
      const tools: OpenAI.Chat.ChatCompletionTool[] | undefined = options?.tools?.map(t => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }))

      const stream = await this.client.chat.completions.create({
        model: options?.model || this.defaultModel,
        messages: openaiMessages,
        max_tokens: options?.maxTokens,
        temperature: options?.temperature,
        tools,
        tool_choice: options?.tool_choice as 'auto' | 'required' | undefined,
        stream: true,
        stream_options: { include_usage: true },
      })

      let toolCallAccumulator: Map<number, { id: string; name: string; arguments: string }> = new Map()

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta

        if (delta?.content) {
          yield { type: 'text', content: delta.content }
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index ?? 0
            if (!toolCallAccumulator.has(index)) {
              toolCallAccumulator.set(index, { id: tc.id || '', name: tc.function?.name || '', arguments: tc.function?.arguments || '' })
            } else {
              const existing = toolCallAccumulator.get(index)!
              if (tc.id) existing.id = tc.id
              if (tc.function?.name) existing.name = tc.function.name
              if (tc.function?.arguments) existing.arguments += tc.function.arguments
            }
          }
        }

        if (chunk.choices?.[0]?.finish_reason) {
          if (toolCallAccumulator.size > 0) {
            for (const [, tc] of toolCallAccumulator) {
              yield {
                type: 'tool_call',
                tool_call: {
                  id: tc.id,
                  type: 'function',
                  function: { name: tc.name, arguments: tc.arguments },
                },
              }
            }
            toolCallAccumulator.clear()
          }

          const usage = chunk.usage
          yield {
            type: 'done',
            usage: usage
              ? {
                  promptTokens: usage.prompt_tokens,
                  completionTokens: usage.completion_tokens,
                  totalTokens: usage.total_tokens,
                }
              : undefined,
          }
        }
      }

      if (toolCallAccumulator.size > 0) {
        for (const [, tc] of toolCallAccumulator) {
          yield {
            type: 'tool_call',
            tool_call: {
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: tc.arguments },
            },
          }
        }
      }
    } catch (error: any) {
      yield { type: 'text', content: `OpenAI API error: ${error.message || error}` }
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
            total += 1000 // rough estimate for images
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
