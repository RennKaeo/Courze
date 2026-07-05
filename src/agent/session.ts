import { randomUUID } from 'node:crypto'
import type { Message, ContentPart } from '../llm/provider.js'
import type { Message as TokenizerMessage } from '../context/tokenizer.js'
import { ContextManager } from '../context/manager.js'
import type { AgentConfig, AgentMode, AgentResult } from './types.js'

export interface SessionContext {
  messages: Message[]
  task: string
  mode: AgentMode
  iteration: number
  filesRead: string[]
  filesWritten: string[]
}

export interface SessionSummary {
  task: string
  iterations: number
  duration: number
  result: string
  filesChanged: string[]
}

function toTokenizerMessage(msg: Message): TokenizerMessage {
  const content = typeof msg.content === 'string'
    ? msg.content
    : msg.content.map((p: ContentPart) => p.type === 'text' ? p.text : '[image]').join('\n')

  return {
    role: msg.role,
    content,
    tool_call_id: msg.tool_call_id,
    name: msg.name,
    tool_calls: msg.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    })),
  }
}

export class Session {
  id: string
  task: string
  mode: AgentMode
  startTime: number
  iteration: number
  filesRead: string[]
  filesWritten: string[]
  private _messages: Message[]
  private contextManager: ContextManager

  constructor(task: string, mode: AgentMode, maxTokens?: number) {
    this.id = randomUUID()
    this.task = task
    this.mode = mode
    this.startTime = Date.now()
    this.iteration = 0
    this.filesRead = []
    this.filesWritten = []
    this._messages = []
    this.contextManager = new ContextManager(maxTokens)
  }

  get messages(): Message[] {
    return this._messages
  }

  addMessage(msg: Message): void {
    this._messages.push(msg)
    const tokenizerMsg = toTokenizerMessage(msg)
    this.contextManager.addMessage(tokenizerMsg)
  }

  getContext(): SessionContext {
    return {
      messages: [...this._messages],
      task: this.task,
      mode: this.mode,
      iteration: this.iteration,
      filesRead: [...this.filesRead],
      filesWritten: [...this.filesWritten],
    }
  }

  isComplete(): boolean {
    if (this._messages.length === 0) return false
    const last = this._messages[this._messages.length - 1]
    if (last.role !== 'assistant') return false
    if (last.tool_calls && last.tool_calls.length > 0) return false
    return last.content !== '' && last.content !== null
  }

  summary(result: string): SessionSummary {
    return {
      task: this.task,
      iterations: this.iteration,
      duration: Date.now() - this.startTime,
      result,
      filesChanged: [...new Set([...this.filesRead, ...this.filesWritten])],
    }
  }

  trackFileRead(filePath: string): void {
    if (!this.filesRead.includes(filePath)) {
      this.filesRead.push(filePath)
    }
  }

  trackFileWritten(filePath: string): void {
    if (!this.filesWritten.includes(filePath)) {
      this.filesWritten.push(filePath)
    }
  }
}
