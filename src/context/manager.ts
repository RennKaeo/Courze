import { countMessageTokens, type Message } from '../context/tokenizer.js'

const DEFAULT_MAX_TOKENS = 32_000
const TRIM_THRESHOLD = 0.85

export class ContextManager {
  private messages: Message[] = []
  private maxTokens: number

  constructor(maxTokens: number = DEFAULT_MAX_TOKENS) {
    this.maxTokens = maxTokens
  }

  addMessage(msg: Message): void {
    this.messages.push(msg)
    const totalTokens = this.messages.reduce((sum, m) => sum + countMessageTokens(m), 0)
    if (totalTokens > this.maxTokens * TRIM_THRESHOLD) {
      this.trimToLimit(this.maxTokens)
    }
  }

  getMessages(): Message[] {
    return [...this.messages]
  }

  trimToLimit(maxTokens: number): void {
    this.maxTokens = maxTokens
    let totalTokens = this.messages.reduce((sum, m) => sum + countMessageTokens(m), 0)
    if (totalTokens <= maxTokens) return

    const systemMessages: Message[] = []
    const nonSystemMessages: Message[] = []
    for (const msg of this.messages) {
      if (msg.role === 'system') {
        systemMessages.push(msg)
      } else {
        nonSystemMessages.push(msg)
      }
    }

    const preservedToolResults: Message[] = []
    const droppable: Message[] = []
    let foundNonTool = false
    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const msg = nonSystemMessages[i]
      if (!foundNonTool && msg.role === 'tool') {
        preservedToolResults.unshift(msg)
      } else {
        if (msg.role !== 'tool') foundNonTool = true
        droppable.unshift(msg)
      }
    }

    droppable.sort(
      (a, b) => (a.role === 'assistant' ? 0 : 1) - (b.role === 'assistant' ? 0 : 1)
    )

    while (droppable.length > 0) {
      const total = [...systemMessages, ...droppable, ...preservedToolResults]
      totalTokens = total.reduce((sum, m) => sum + countMessageTokens(m), 0)
      if (totalTokens <= maxTokens) break
      droppable.shift()
    }

    this.messages = [...systemMessages, ...droppable, ...preservedToolResults]
  }

  clear(): void {
    this.messages = []
  }

  setMaxTokens(max: number): void {
    this.maxTokens = max
  }
}
