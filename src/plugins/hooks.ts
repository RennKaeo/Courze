export interface ToolCall {
  id: string
  name: string
  arguments: string
}

export interface ToolResult {
  tool_call_id: string
  output: string
  error?: string
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  name?: string
  tool_calls?: ToolCall[]
}

export interface Session {
  id: string
  messages: Message[]
  config: Record<string, unknown>
}

export interface PluginHooks {
  beforeToolCall: (toolCall: ToolCall, session: Session) => Promise<ToolCall | null>
  afterToolCall: (result: ToolResult, session: Session) => Promise<ToolResult>
  beforeMessage: (message: Message, session: Session) => Promise<Message>
  afterMessage: (message: Message, session: Session) => Promise<void>
  onError: (error: Error, session: Session) => Promise<void>
}
