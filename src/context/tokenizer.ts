import { encode } from 'gpt-tokenizer'

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  name?: string
  tool_calls?: { id: string; name: string; arguments: string }[]
}

export function countTokens(text: string): number {
  if (!text) return 0
  return encode(text).length
}

export function countMessageTokens(msg: Message): number {
  let total = 0
  total += countTokens(msg.content)
  total += msg.role === 'system' ? 4 : msg.role === 'tool' ? 2 : 3
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      total += countTokens(tc.id) + countTokens(tc.name) + countTokens(tc.arguments)
    }
  }
  if (msg.tool_call_id) {
    total += countTokens(msg.tool_call_id)
  }
  if (msg.name) {
    total += countTokens(msg.name)
  }
  return total
}
