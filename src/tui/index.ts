import blessed from 'blessed'
import type { LLMProvider, Message } from '../llm/provider.js'
import type { ToolRegistry } from '../tools/registry.js'
import type { AgentConfig, AgentResult, Plan } from '../agent/types.js'
import { Session } from '../agent/session.js'

const PADDING = '  '

export class TUI {
  private screen: blessed.Widgets.Screen
  private headerBox: blessed.Widgets.BoxElement
  private conversationBox: blessed.Widgets.BoxElement
  private outputBox: blessed.Widgets.BoxElement
  private inputBox: blessed.Widgets.TextboxElement
  private provider: LLMProvider
  private toolRegistry: ToolRegistry
  private config: AgentConfig
  private isRunning = false
  private abortController: AbortController | null = null

  constructor(provider: LLMProvider, toolRegistry: ToolRegistry, config: AgentConfig) {
    this.provider = provider
    this.toolRegistry = toolRegistry
    this.config = config

    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Course Code',
      cursor: { artificial: true, shape: 'line', blink: true, color: 'white' },
    })

    this.headerBox = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: this.formatHeader(),
      style: { fg: 'cyan', bold: true },
    })

    this.conversationBox = blessed.box({
      top: 1,
      left: 0,
      width: '100%',
      height: '70%',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: { ch: '│', style: { fg: 'cyan' } },
      tags: true,
      content: '',
      mouse: true,
    })

    this.outputBox = blessed.box({
      top: '70%+1',
      left: 0,
      width: '100%',
      height: '15%',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: { ch: '│', style: { fg: 'yellow' } },
      tags: true,
      content: '',
      style: { fg: 'white', bg: 'black' },
    })

    this.inputBox = blessed.textbox({
      top: '85%+1',
      left: 0,
      width: '100%',
      height: 1,
      inputOnFocus: true,
      style: { fg: 'white', bg: 'blue' },
      content: '',
      keys: true,
      mouse: true,
    })

    this.screen.append(this.headerBox)
    this.screen.append(this.conversationBox)
    this.screen.append(this.outputBox)
    this.screen.append(this.inputBox)

    this.setupInputHandling()
  }

  private setupInputHandling(): void {
    this.screen.key(['escape', 'q', 'C-c'], () => {
      if (this.isRunning) {
        this.abort()
      } else {
        process.exit(0)
      }
    })

    this.screen.key('enter', () => {
      const value = this.inputBox.getValue()?.trim()
      if (!value || this.isRunning) return

      this.inputBox.clearValue()
      this.inputBox.readInput(() => {})

      this.runTask(value)
    })
  }

  private formatHeader(): string {
    const status = this.isRunning ? 'RUNNING' : 'READY'
    const statusColor = this.isRunning ? 'yellow-fg' : 'green-fg'
    return `{bold}Course Code{/bold}  {cyan-fg}|{/cyan-fg}  ${this.provider.name}/${this.config.model}  {cyan-fg}|{/cyan-fg}  mode: ${this.config.mode}  {cyan-fg}|{/cyan-fg}  {${statusColor}}${status}{/${statusColor}}`
  }

  private updateHeader(): void {
    this.headerBox.setContent(this.formatHeader())
    this.screen.render()
  }

  start(): void {
    this.addSystemMessage('Course Code AI Coding Agent')
    this.addSystemMessage(`Provider: ${this.provider.name}  |  Model: ${this.config.model}  |  Mode: ${this.config.mode}`)
    this.addSystemMessage('Type a task below and press Enter. Press Esc or q to exit.')
    this.divider()

    this.inputBox.focus()
    this.screen.render()
  }

  private addSystemMessage(text: string): void {
    const content = this.conversationBox.getContent()
    this.conversationBox.setContent(content + `\n{dim}${PADDING}${text}{/dim}`)
    this.scrollToBottom(this.conversationBox)
  }

  private divider(): void {
    const content = this.conversationBox.getContent()
    this.conversationBox.setContent(content + '\n{dim}────────────────────────────────────────────────{/dim}')
  }

  private async runTask(task: string): Promise<void> {
    this.isRunning = true
    this.abortController = new AbortController()
    this.updateHeader()

    this.addUserMessage(task)
    this.divider()
    this.addOutput(`Starting task: ${task}`)

    try {
      const session = new Session(task, this.config.mode)

      const plan = await this.createPlan(task)
      this.addAIMessage(`Plan: ${plan.goal}`)
      for (const step of plan.steps) {
        this.addAIMessage(`  ${step.id}: ${step.description}`)
      }

      const result = await this.executePlan(plan, session)

      this.addOutput('---')
      if (result.success) {
        this.addAIMessage(`{green-fg}✓ Complete{/green-fg}: ${result.summary}`)
        this.addOutput(`Task completed in ${result.iterations} iteration(s)`)
        if (result.filesChanged.length > 0) {
          this.addOutput(`Files changed: ${result.filesChanged.join(', ')}`)
        }
      } else {
        this.addAIMessage(`{red-fg}✖ Failed{/red-fg}: ${result.summary}`)
        this.addOutput(`Task failed: ${result.error || 'Unknown error'}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.addAIMessage(`{red-fg}✖ Error{/red-fg}: ${msg}`)
      this.addOutput(`Error: ${msg}`)
    } finally {
      this.isRunning = false
      this.abortController = null
      this.updateHeader()
      this.divider()
      this.addSystemMessage('Task finished. Type another task or press Esc/q to exit.')
      this.inputBox.focus()
      this.screen.render()
    }
  }

  private async createPlan(task: string): Promise<Plan> {
    const plannerPrompt = `You are a task planner. Break down this coding task into 2-5 steps.

Task: ${task}

Respond with JSON only:
{
  "goal": "summary",
  "complexity": "low|medium|high",
  "steps": [
    { "id": "step-1", "description": "...", "suggestedTools": ["read"], "expectedOutcome": "..." }
  ]
}`

    const response = await this.provider.chat([
      { role: 'system', content: 'You are a JSON-only task planner. Respond with valid JSON only.' },
      { role: 'user', content: plannerPrompt },
    ], { model: this.config.model, maxTokens: 1024, temperature: 0.3 })

    const text = response.content || ''
    let json = text.trim()
    const m = json.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (m) json = m[1].trim()
    const bs = json.indexOf('{'), be = json.lastIndexOf('}')
    if (bs !== -1 && be !== -1) json = json.slice(bs, be + 1)

    const parsed = JSON.parse(json)
    if (!parsed.goal || !Array.isArray(parsed.steps)) {
      throw new Error('Invalid plan structure')
    }

    const complexity = parsed.complexity === 'low' || parsed.complexity === 'medium' || parsed.complexity === 'high'
      ? parsed.complexity
      : parsed.steps.length <= 2 ? 'low' : parsed.steps.length <= 5 ? 'medium' : 'high'

    return {
      goal: String(parsed.goal),
      steps: parsed.steps.map((s: any, i: number) => ({
        id: String(s.id || `step-${i + 1}`),
        description: String(s.description || ''),
        suggestedTools: Array.isArray(s.suggestedTools) ? s.suggestedTools.map(String) : [],
        expectedOutcome: s.expectedOutcome ? String(s.expectedOutcome) : undefined,
      })),
      complexity,
    }
  }

  private async executePlan(plan: Plan, session: Session): Promise<AgentResult> {
    const maxIter = this.config.maxIterations
    const filesChanged: string[] = []

    const systemMsg: Message = {
      role: 'system',
      content: this.config.systemPrompt || 'You are Course Code, an AI coding agent.',
    }

    const planSummary = plan.steps.map(s => `  ${s.id}: ${s.description}`).join('\n')
    const taskMsg: Message = {
      role: 'user',
      content: `Task: ${session.task}\n\nPlan:\n${planSummary}\n\nExecute this plan.`,
    }

    const messages: Message[] = [systemMsg, taskMsg]

    for (let iter = 1; iter <= maxIter; iter++) {
      session.iteration = iter

      if (this.abortController?.signal.aborted) {
        return { success: false, summary: 'Interrupted', iterations: iter, duration: 0, filesChanged, error: 'Interrupted' }
      }

      this.addOutput(`[iter ${iter}/${maxIter}] Getting LLM response...`)

      let response
      try {
        response = await this.provider.chat(messages, {
          model: this.config.model,
          tools: this.toolRegistry.getDefinitions(),
          tool_choice: 'auto',
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { success: false, summary: msg, iterations: iter, duration: 0, filesChanged, error: msg }
      }

      const assistantMsg: Message = { role: 'assistant', content: response.content || '', tool_calls: response.tool_calls }
      messages.push(assistantMsg)

      if (response.content) {
        this.addAIMessage(response.content)
      }

      if (!response.tool_calls || response.tool_calls.length === 0) {
        this.addOutput(`Task completed in ${iter} iteration(s)`)
        return { success: true, summary: response.content || 'Done', iterations: iter, duration: 0, filesChanged }
      }

      for (const tc of response.tool_calls) {
        const tool = this.toolRegistry.get(tc.function.name)
        let args: Record<string, unknown>
        try {
          args = JSON.parse(tc.function.arguments)
        } catch {
          messages.push({
            role: 'tool', content: `Error: Invalid JSON arguments for ${tc.function.name}`,
            tool_call_id: tc.id, name: tc.function.name,
          } as Message)
          continue
        }

        if (!tool) {
          messages.push({
            role: 'tool', content: `Error: Unknown tool "${tc.function.name}"`,
            tool_call_id: tc.id, name: tc.function.name,
          } as Message)
          continue
        }

        const argsStr = Object.entries(args).map(([k, v]) => {
          const val = typeof v === 'string' && v.length > 100 ? `${v.slice(0, 100)}...` : JSON.stringify(v)
          return `  ${k}: ${val}`
        }).join('\n')

        this.addOutput(`→ ${tc.function.name}\n${argsStr}`)

        if (this.config.mode === 'assist') {
          const approved = await this.promptApproval(tc.function.name, args)
          if (!approved) {
            messages.push({
              role: 'tool', content: `Tool call "${tc.function.name}" rejected by user`,
              tool_call_id: tc.id, name: tc.function.name,
            } as Message)
            continue
          }
        }

        try {
          const result = await tool.handler(args)
          messages.push({
            role: 'tool', content: result, tool_call_id: tc.id, name: tc.function.name,
          } as Message)

          const resultPreview = result.length > 200 ? `${result.slice(0, 200)}...` : result
          this.addOutput(`← Result: ${resultPreview}`)

          if (tc.function.name === 'write' || tc.function.name === 'edit') {
            const fp = args.filePath as string
            if (fp && !filesChanged.includes(fp)) filesChanged.push(fp)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          messages.push({
            role: 'tool', content: `Error: ${msg}`, tool_call_id: tc.id, name: tc.function.name,
          } as Message)
          this.addOutput(`← Error: ${msg}`)
        }
      }
    }

    return {
      success: false,
      summary: `Reached max iterations (${maxIter})`,
      iterations: maxIter, duration: 0, filesChanged,
      error: `Max iterations (${maxIter}) exceeded`,
    }
  }

  private promptApproval(name: string, args: Record<string, unknown>): Promise<boolean> {
    return new Promise((resolve) => {
      this.addOutput(`Approve tool call: {bold}${name}{/bold}? (y=yes / n=no / a=always)`)

      const handler = (ch: string) => {
        this.screen.unkey('y', handler)
        this.screen.unkey('n', handler)
        this.screen.unkey('a', handler)
        const approved = ch === 'y' || ch === 'a'
        if (approved && ch === 'a') {
          this.config.mode = 'auto'
          this.updateHeader()
        }
        resolve(approved)
      }
      this.screen.key('y', handler)
      this.screen.key('n', handler)
      this.screen.key('a', handler)
    })
  }

  private addUserMessage(text: string): void {
    const content = this.conversationBox.getContent()
    this.conversationBox.setContent(content + `\n{blue-fg}▶ You{/blue-fg}: ${text}`)
    this.scrollToBottom(this.conversationBox)
  }

  private addAIMessage(text: string): void {
    const content = this.conversationBox.getContent()
    const lines = text.split('\n').map(l => `${PADDING}${l}`).join('\n')
    this.conversationBox.setContent(content + `\n{green-fg}● Agent{/green-fg}:\n${lines}`)
    this.scrollToBottom(this.conversationBox)
  }

  private addOutput(text: string): void {
    const content = this.outputBox.getContent()
    const timestamp = new Date().toLocaleTimeString()
    this.outputBox.setContent(content + `\n{dim}[${timestamp}]{/dim} ${text}`)
    this.scrollToBottom(this.outputBox)
  }

  private scrollToBottom(box: blessed.Widgets.BoxElement): void {
    box.setScrollPerc(100)
    this.screen.render()
  }

  private abort(): void {
    this.addOutput('Aborting current task...')
    this.abortController?.abort()
  }
}
