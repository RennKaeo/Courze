export type AgentMode = 'auto' | 'assist'

export interface AgentConfig {
  provider: string
  model: string
  mode: AgentMode
  maxIterations: number
  systemPrompt?: string
}

export interface Plan {
  goal: string
  steps: Step[]
  complexity: 'low' | 'medium' | 'high'
}

export interface Step {
  id: string
  description: string
  suggestedTools?: string[]
  expectedOutcome?: string
}

export interface AgentResult {
  success: boolean
  summary: string
  iterations: number
  duration: number
  filesChanged: string[]
  error?: string
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  toolCallId: string
  name: string
  result: string
  error?: string
}

export interface ExecutorCallbacks {
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void
  onToolResult?: (toolName: string, result: string) => void
  onAssistantMessage?: (content: string) => void
  onIteration?: (iter: number, maxIter: number) => void
  onRequestApproval?: (toolName: string, args: Record<string, unknown>) => Promise<'approve' | 'reject' | 'approve-all'>
}
