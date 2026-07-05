export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  name?: string
  tool_calls?: { id: string; name: string; arguments: string }[]
}

export function countTokens(text: string): number {
  if (!text) return 0
  const tokens = text
    .trim()
    .split(/[\s,.;:!?(){}[\]"'@#$%^&*+=<>/\\|~`\-_]+/)
    .filter(Boolean)
  let count = tokens.length
  for (const token of tokens) {
    if (token.length > 4) {
      count += Math.floor((token.length - 4) / 4)
    }
  }
  return Math.max(1, count)
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
