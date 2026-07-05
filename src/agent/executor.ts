import { createInterface } from 'node:readline'
import type { LLMProvider, Message, ContentPart } from '../llm/provider.js'
import type { ToolRegistry } from '../tools/registry.js'
import type { Message as TokenizerMessage } from '../context/tokenizer.js'
import { ContextManager } from '../context/manager.js'
import type { Plan, AgentResult, AgentConfig } from './types.js'
import { type Session } from './session.js'

const DEFAULT_SYSTEM_PROMPT = `You are Course Code, an AI coding agent. You help users with software engineering tasks by using available tools.

Available tools allow you to:
- Read, write, and edit files
- Search file contents with grep and glob patterns
- Execute shell commands
- Fetch web content

Guidelines:
1. Use tools step by step - explore first, then implement
2. Always read existing files before modifying them
3. After making changes, verify they're correct
4. When you're done, provide a clear summary of what was accomplished
5. Handle errors gracefully and try alternative approaches

When you complete the task, respond with a summary of what was done.`

export class Executor {
  private provider: LLMProvider
  private toolRegistry: ToolRegistry
  private config: AgentConfig
  private maxIterations: number
  private autoApproved: boolean

  constructor(provider: LLMProvider, toolRegistry: ToolRegistry, config: AgentConfig) {
    this.provider = provider
    this.toolRegistry = toolRegistry
    this.config = config
    this.maxIterations = config.maxIterations
    this.autoApproved = false
  }

  async execute(plan: Plan, session: Session): Promise<AgentResult> {
    const startTime = Date.now()
    const filesChanged: string[] = []
    let iterations = 0
    this.autoApproved = false

    const contextManager = new ContextManager()
    for (const msg of session.messages) {
      contextManager.addMessage(this.toTokenizerMessage(msg))
    }

    const systemMessage: Message = {
      role: 'system',
      content: this.config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    }
    session.addMessage(systemMessage)
    contextManager.addMessage(this.toTokenizerMessage(systemMessage))

    const planSummary = this.formatPlanForPrompt(plan)
    const taskMessage: Message = {
      role: 'user',
      content: `Task: ${session.task}\n\nPlan:\n${planSummary}\n\nExecute this plan step by step. Use the available tools to explore and make changes. When finished, provide a summary.`,
    }
    session.addMessage(taskMessage)
    contextManager.addMessage(this.toTokenizerMessage(taskMessage))

    while (iterations < this.maxIterations) {
      iterations++
      session.iteration = iterations

      let response
      try {
        response = await this.provider.chat(contextManager.getMessages() as Message[], {
          model: this.config.model,
          tools: this.toolRegistry.getDefinitions(),
          tool_choice: 'auto',
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return this.createResult(false, `LLM error: ${message}`, iterations, startTime, filesChanged, message)
      }

      const assistantMsg: Message = {
        role: 'assistant',
        content: response.content || '',
        tool_calls: response.tool_calls,
      }
      session.addMessage(assistantMsg)
      contextManager.addMessage(this.toTokenizerMessage(assistantMsg))

      if (!response.tool_calls || response.tool_calls.length === 0) {
        return this.createResult(true, response.content || 'Task completed', iterations, startTime, filesChanged)
      }

      for (const tc of response.tool_calls) {
        const toolName = tc.function.name
        let args: Record<string, unknown>

        try {
          args = JSON.parse(tc.function.arguments)
        } catch {
          const errorMsg = `Error: Invalid JSON in arguments for tool "${toolName}": ${tc.function.arguments}`
          const toolMsg: Message = {
            role: 'tool',
            content: errorMsg,
            tool_call_id: tc.id,
            name: toolName,
          }
          session.addMessage(toolMsg)
          contextManager.addMessage(this.toTokenizerMessage(toolMsg))
          continue
        }

        const tool = this.toolRegistry.get(toolName)
        if (!tool) {
          const errorMsg = `Error: Unknown tool "${toolName}". Available tools: ${this.toolRegistry.getAll().map(t => t.name).join(', ')}`
          const toolMsg: Message = {
            role: 'tool',
            content: errorMsg,
            tool_call_id: tc.id,
            name: toolName,
          }
          session.addMessage(toolMsg)
          contextManager.addMessage(this.toTokenizerMessage(toolMsg))
          continue
        }

        if (session.mode === 'assist' && !this.autoApproved) {
          const approved = await this.promptForApproval(toolName, args)
          if (approved === 'reject') {
            const toolMsg: Message = {
              role: 'tool',
              content: `Tool call "${toolName}" was rejected by user`,
              tool_call_id: tc.id,
              name: toolName,
            }
            session.addMessage(toolMsg)
            contextManager.addMessage(this.toTokenizerMessage(toolMsg))
            continue
          }
          if (approved === 'approve-all') {
            this.autoApproved = true
          }
        }

        try {
          const result = await tool.handler(args)
          const toolMsg: Message = {
            role: 'tool',
            content: result,
            tool_call_id: tc.id,
            name: toolName,
          }
          session.addMessage(toolMsg)
          contextManager.addMessage(this.toTokenizerMessage(toolMsg))

          if (toolName === 'write' || toolName === 'edit') {
            const filePath = args.filePath as string | undefined
            if (filePath && !filesChanged.includes(filePath)) {
              filesChanged.push(filePath)
            }
          }

          if (toolName === 'read') {
            const filePath = args.filePath as string | undefined
            if (filePath) {
              session.trackFileRead(filePath)
            }
          }

          if (toolName === 'write') {
            const filePath = args.filePath as string | undefined
            if (filePath) {
              session.trackFileWritten(filePath)
            }
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          const toolMsg: Message = {
            role: 'tool',
            content: `Error executing "${toolName}": ${errorMsg}`,
            tool_call_id: tc.id,
            name: toolName,
          }
          session.addMessage(toolMsg)
          contextManager.addMessage(this.toTokenizerMessage(toolMsg))
        }
      }
    }

    return this.createResult(
      false,
      `Reached maximum iterations (${this.maxIterations}) without completing the task`,
      iterations,
      startTime,
      filesChanged,
      `Max iterations (${this.maxIterations}) exceeded`,
    )
  }

  private formatPlanForPrompt(plan: Plan): string {
    const lines = [`Goal: ${plan.goal}`, `Complexity: ${plan.complexity}`, '']
    for (const step of plan.steps) {
      lines.push(`  ${step.id}: ${step.description}`)
      if (step.suggestedTools && step.suggestedTools.length > 0) {
        lines.push(`    Tools: ${step.suggestedTools.join(', ')}`)
      }
      if (step.expectedOutcome) {
        lines.push(`    Expected: ${step.expectedOutcome}`)
      }
    }
    return lines.join('\n')
  }

  private toTokenizerMessage(msg: Message): TokenizerMessage {
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

  private async promptForApproval(
    name: string,
    args: Record<string, unknown>,
  ): Promise<'approve' | 'reject' | 'approve-all'> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    const argsStr = Object.entries(args)
      .map(([k, v]) => {
        const val = typeof v === 'string' && v.length > 200 ? `${v.slice(0, 200)}...` : JSON.stringify(v)
        return `  ${k}: ${val}`
      })
      .join('\n')

    return new Promise((resolve) => {
      rl.question(
        `\n${'='.repeat(60)}\nTool: ${name}\nArguments:\n${argsStr}\n${'='.repeat(60)}\nApprove? (y)es / (n)o / (a)ll: `,
        (answer) => {
          rl.close()
          const trimmed = answer.trim().toLowerCase()
          if (trimmed === 'a' || trimmed === 'all') {
            resolve('approve-all')
          } else if (trimmed === 'y' || trimmed === 'yes' || trimmed === '') {
            resolve('approve')
          } else {
            resolve('reject')
          }
        },
      )
    })
  }

  private createResult(
    success: boolean,
    summary: string,
    iterations: number,
    startTime: number,
    filesChanged: string[],
    error?: string,
  ): AgentResult {
    return {
      success,
      summary,
      iterations,
      duration: Date.now() - startTime,
      filesChanged,
      error,
    }
  }
}
