import { GoogleGenerativeAI, FunctionCallingMode } from '@google/generative-ai'
import type { GenerativeModel, Content, Part, Tool } from '@google/generative-ai'
import { LLMProvider, Message, ChatOptions, ChatResponse, ChatStreamChunk, ContentPart, ToolCall } from './provider.js'

function isTextContent(content: string | ContentPart[]): content is string {
  return typeof content === 'string'
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function toGeminiContents(messages: Message[]): Content[] {
  const contents: Content[] = []

  for (const msg of messages) {
    if (msg.role === 'system') continue

    const role = msg.role === 'assistant' ? 'model' : 'user'
    const parts: Part[] = []

    if (msg.role === 'tool') {
      parts.push({
        functionResponse: {
          name: msg.name || 'unknown',
          response: {
            response: isTextContent(msg.content) ? msg.content : JSON.stringify(msg.content),
          },
        },
      })
      contents.push({ role, parts })
      continue
    }

    if (isTextContent(msg.content)) {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments),
            },
          })
        }
      }
      if (msg.content) {
        parts.push({ text: msg.content })
      }
    } else {
      for (const part of msg.content) {
        if (part.type === 'text') {
          parts.push({ text: part.text })
        } else {
          parts.push({
            inlineData: {
              mimeType: part.source.media_type,
              data: part.source.data,
            },
          })
        }
      }
    }

    if (msg.tool_calls && isTextContent(msg.content) && parts.length === 0) {
      for (const tc of msg.tool_calls) {
        parts.push({
          functionCall: {
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments),
          },
        })
      }
    }

    contents.push({ role, parts })
  }

  return contents
}

function extractSystemPrompt(messages: Message[]): string | undefined {
  const systemMessages = messages.filter(m => m.role === 'system')
  if (systemMessages.length === 0) return undefined
  return systemMessages.map(m =>
    isTextContent(m.content) ? m.content : m.content.filter(c => c.type === 'text').map(c => (c as { type: 'text'; text: string }).text).join('')
  ).join('\n')
}

function fromGeminiResponse(response: any, finishReason?: string): ChatResponse {
  let content = ''
  const tool_calls: ToolCall[] = []

  try {
    const candidate = response.candidates?.[0]
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          content += part.text
        }
        if (part.functionCall) {
          tool_calls.push({
            id: part.functionCall.name + '_' + Date.now(),
            type: 'function',
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args),
            },
          })
        }
      }
    }

    const usageMetadata = response.usageMetadata
    return {
      content,
      tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
      usage: usageMetadata
        ? {
            promptTokens: usageMetadata.promptTokenCount,
            completionTokens: usageMetadata.candidatesTokenCount,
            totalTokens: usageMetadata.totalTokenCount,
          }
        : undefined,
      finishReason: finishReason || candidate?.finishReason || 'stop',
    }
  } catch {
    return { content: '', finishReason: 'stop' }
  }
}

export class GoogleProvider extends LLMProvider {
  private model: GenerativeModel
  private defaultModel: string

  constructor(config: { apiKey?: string; model?: string; baseUrl?: string }) {
    super('google', true)
    const apiKey = config.apiKey || process.env.GOOGLE_API_KEY || ''
    const client = new GoogleGenerativeAI(apiKey)
    this.defaultModel = config.model || 'gemini-2.5-pro-exp-03-25'
    this.model = client.getGenerativeModel({ model: this.defaultModel })
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    try {
      const systemInstruction = extractSystemPrompt(messages)
      const history = toGeminiContents(messages)

      const tools: Tool[] | undefined = options?.tools?.map(t => ({
        functionDeclarations: [{
          name: t.name,
          description: t.description,
          parameters: t.parameters as any,
        }],
      }))

      const toolConfig = options?.tool_choice
        ? {
            functionCallingConfig: {
              mode: options.tool_choice === 'required'
                ? FunctionCallingMode.ANY
                : options.tool_choice === 'none'
                  ? FunctionCallingMode.NONE
                  : FunctionCallingMode.AUTO,
            },
          }
        : undefined

      const chat = this.model.startChat({
        history,
        systemInstruction: systemInstruction ? { role: 'user', parts: [{ text: systemInstruction }] } : undefined,
        tools,
        toolConfig,
      })

      const lastMsg = messages[messages.length - 1]
      const prompt = isTextContent(lastMsg.content) ? lastMsg.content : lastMsg.content.filter(c => c.type === 'text').map(c => (c as { type: 'text'; text: string }).text).join('')

      const result = await chat.sendMessage(prompt)
      const response = result.response

      return fromGeminiResponse(response)
    } catch (error: any) {
      return {
        content: `Google API error: ${error.message || error}`,
        finishReason: 'error',
      }
    }
  }

  async *chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<ChatStreamChunk> {
    try {
      const systemInstruction = extractSystemPrompt(messages)
      const history = toGeminiContents(messages)

      const tools: Tool[] | undefined = options?.tools?.map(t => ({
        functionDeclarations: [{
          name: t.name,
          description: t.description,
          parameters: t.parameters as any,
        }],
      }))

      const toolConfig = options?.tool_choice
        ? {
            functionCallingConfig: {
              mode: options.tool_choice === 'required'
                ? FunctionCallingMode.ANY
                : options.tool_choice === 'none'
                  ? FunctionCallingMode.NONE
                  : FunctionCallingMode.AUTO,
            },
          }
        : undefined

      const chat = this.model.startChat({
        history,
        systemInstruction: systemInstruction ? { role: 'user', parts: [{ text: systemInstruction }] } : undefined,
        tools,
        toolConfig,
      })

      const lastMsg = messages[messages.length - 1]
      const prompt = isTextContent(lastMsg.content) ? lastMsg.content : lastMsg.content.filter(c => c.type === 'text').map(c => (c as { type: 'text'; text: string }).text).join('')

      const result = await chat.sendMessageStream(prompt)
      const response = await result.response

      const candidate = response.candidates?.[0]
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            yield { type: 'text', content: part.text }
          }
          if (part.functionCall) {
            yield {
              type: 'tool_call',
              tool_call: {
                id: part.functionCall.name + '_' + Date.now(),
                type: 'function',
                function: {
                  name: part.functionCall.name,
                  arguments: JSON.stringify(part.functionCall.args),
                },
              },
            }
          }
        }
      }

      const usageMetadata = response.usageMetadata
      yield {
        type: 'done',
        usage: usageMetadata
          ? {
              promptTokens: usageMetadata.promptTokenCount,
              completionTokens: usageMetadata.candidatesTokenCount,
              totalTokens: usageMetadata.totalTokenCount,
            }
          : undefined,
      }
    } catch (error: any) {
      yield { type: 'text', content: `Google API error: ${error.message || error}` }
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
