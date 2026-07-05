import { OpenAIProvider } from './openai.js'
import { AnthropicProvider } from './anthropic.js'
import { GoogleProvider } from './google.js'
import { OllamaProvider } from './ollama.js'
import type { LLMProvider } from './provider.js'

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
