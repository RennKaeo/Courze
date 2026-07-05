import { OpenAIProvider } from './openai.js'
import { AnthropicProvider } from './anthropic.js'
import { GoogleProvider } from './google.js'
import { OllamaProvider } from './ollama.js'

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | ContentPart[]
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ChatOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  tools?: ToolDefinition[]
  tool_choice?: 'auto' | 'required' | 'none'
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ChatResponse {
  content: string
  tool_calls?: ToolCall[]
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  finishReason: string
}

export interface ChatStreamChunk {
  type: 'text' | 'tool_call' | 'done'
  content?: string
  tool_call?: ToolCall
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export abstract class LLMProvider {
  name: string
  supportsToolUse: boolean

  constructor(name: string, supportsToolUse: boolean) {
    this.name = name
    this.supportsToolUse = supportsToolUse
  }

  abstract chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>
  abstract chatStream(messages: Message[], options?: ChatOptions): AsyncIterable<ChatStreamChunk>
  abstract countTokens(messages: Message[]): Promise<number>
}

export function createProvider(type: string, config: { apiKey?: string; model?: string; baseUrl?: string }): LLMProvider {
  switch (type) {
    case 'openai':
      return new OpenAIProvider(config)
    case 'anthropic':
      return new AnthropicProvider(config)
    case 'google':
      return new GoogleProvider(config)
    case 'ollama':
      return new OllamaProvider(config)
    default:
      throw new Error(`Unknown provider: ${type}`)
  }
}