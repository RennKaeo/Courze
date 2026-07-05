import blessed from 'blessed'
import type { LLMProvider, Message } from '../llm/provider.js'
import type { ToolRegistry } from '../tools/registry.js'
import type { AgentConfig, AgentResult, Plan } from '../agent/types.js'
import { Session } from '../agent/session.js'
import { ToastManager, type ToastVariant } from './components/toast.js'
import { DialogManager } from './components/dialog.js'
import { Theme } from './components/theme.js'

export class TUI {
  private screen: blessed.Widgets.Screen
  private theme: Theme
  private toasts: ToastManager
  private dialogs: DialogManager

  private headerBox!: blessed.Widgets.BoxElement
  private mainBox!: blessed.Widgets.BoxElement
  private logBox!: blessed.Widgets.BoxElement
  private promptBox!: blessed.Widgets.TextboxElement
  private statusBox!: blessed.Widgets.BoxElement

  private provider: LLMProvider
  private toolRegistry: ToolRegistry
  private config: AgentConfig
  private isRunning = false
  private abortController: AbortController | null = null
  private currentView: 'home' | 'session' = 'home'

  constructor(provider: LLMProvider, toolRegistry: ToolRegistry, config: AgentConfig) {
    this.provider = provider
    this.toolRegistry = toolRegistry
    this.config = config
    this.theme = new Theme()
    this.screen = this.createScreen()
    this.toasts = new ToastManager(this.screen)
    this.dialogs = new DialogManager(this.screen)
    this.createLayout()
    this.bindKeys()
  }

  private createScreen(): blessed.Widgets.Screen {
    const s = blessed.screen({
      smartCSR: true,
      title: 'Course Code',
      cursor: { artificial: true, shape: 'line', blink: true, color: 'white' },
      dockBorders: true,
      fullUnicode: true,
    })
    s.key(['C-c'], () => {
      if (this.isRunning) {
        this.abort()
        this.toasts.show({ variant: 'warning', title: 'Aborted', message: 'Task cancelled' })
      } else {
        process.exit(0)
      }
    })
    return s
  }

  private createLayout(): void {
    this.headerBox = blessed.box({
      top: 0, left: 0, width: '100%', height: 1,
      content: this.formatHeader(),
      style: { fg: 'cyan', bold: true },
      tags: true,
    })

    this.mainBox = blessed.box({
      top: 1, left: 0, width: '100%', height: '70%-1',
      scrollable: true, alwaysScroll: true,
      scrollbar: { ch: '│', style: { fg: 'cyan' } },
      tags: true, content: '',
      mouse: true,
    })

    this.logBox = blessed.box({
      top: '70%', left: 0, width: '100%', height: '20%',
      scrollable: true, alwaysScroll: true,
      scrollbar: { ch: '│', style: { fg: 'yellow' } },
      tags: true, content: '',
      style: { fg: 'white', bg: 'black' },
    })

    this.promptBox = blessed.textbox({
      top: '90%+1', left: 0, width: '100%', height: 1,
      inputOnFocus: true,
      style: { fg: 'white', bg: 'blue' },
      keys: true, mouse: true,
    })

    this.statusBox = blessed.box({
      top: '90%', left: 0, width: '100%', height: 1,
      content: this.formatStatus(),
      style: { fg: 'gray', bg: 'blue' },
      tags: true,
    })

    this.screen.append(this.headerBox)
    this.screen.append(this.mainBox)
    this.screen.append(this.logBox)
    this.screen.append(this.statusBox)
    this.screen.append(this.promptBox)
  }

  private bindKeys(): void {
    this.screen.key(['escape', 'q'], () => {
      if (this.currentView === 'session') {
        this.showHome()
      } else {
        process.exit(0)
      }
    })

    this.screen.key('enter', () => {
      if (this.isRunning) return
      const task = this.promptBox.getValue()?.trim()
      if (!task) return
      this.promptBox.clearValue()
      this.promptBox.readInput(() => {})
      this.runTask(task)
    })

    this.screen.key('h', () => {
      if (!this.isRunning) this.showHome()
    })
  }

  private formatHeader(): string {
    const provider = `${this.provider.name}/${this.config.model}`
    const mode = this.config.mode
    const view = this.currentView === 'home' ? 'HOME' : 'SESSION'
    const color = this.isRunning ? 'yellow' : 'green'
    const status = this.isRunning ? '● RUNNING' : '● READY'
    return ` {bold}Course Code{/bold}  {gray-fg}|{/gray-fg}  ${provider}  {gray-fg}|{/gray-fg}  mode: ${mode}  {gray-fg}|{/gray-fg}  {${color}-fg}${status}{/${color}-fg}  {gray-fg}|{/gray-fg}  {bold}[${view}]{/bold}`
  }

  private formatStatus(): string {
    if (this.currentView === 'home') {
      return ' {dim}Type a task and press Enter  •  Esc/q to quit  •  h for home{/dim}'
    }
    return ' {dim}Esc to return home  •  Ctrl-C to abort  •  h for home{/dim}'
  }

  private render(): void {
    this.headerBox.setContent(this.formatHeader())
    this.statusBox.setContent(this.formatStatus())
    this.screen.render()
  }

  showHome(): void {
    this.currentView = 'home'
    this.mainBox.setContent('')
    this.logBox.setContent('')
    this.addHomeView()
    this.render()
    this.promptBox.focus()
  }

  private addHomeView(): void {
    this.addLine('')
    this.addLine(' {cyan-fg}{bold}╔══════════════════════════════════════╗{/bold}{/cyan-fg}')
    this.addLine(' {cyan-fg}{bold}║       Course Code AI Coding Agent     ║{/bold}{/cyan-fg}')
    this.addLine(' {cyan-fg}{bold}╚══════════════════════════════════════╝{/bold}{/cyan-fg}')
    this.addLine('')
    this.addLine(` {bold}Provider:{/bold} ${this.provider.name}`)
    this.addLine(` {bold}Model:{/bold}    ${this.config.model}`)
    this.addLine(` {bold}Mode:{/bold}     ${this.config.mode}`)
    this.addLine('')
    this.addLine(' {dim}Type a coding task below and press Enter.{/dim}')
    this.addLine(' {dim}Examples:{/dim}')
    this.addLine('   {green-fg}•{/green-fg} {dim}"Add a README to this project"{/dim}')
    this.addLine('   {green-fg}•{/green-fg} {dim}"Fix the login bug in src/auth.ts"{/dim}')
    this.addLine('   {green-fg}•{/green-fg} {dim}"Refactor the main module"{/dim}')
    this.addLine('')
    this.divider()
  }

  start(): void {
    this.showHome()
  }

  // --- Task Execution ---

  private async runTask(task: string): Promise<void> {
    this.isRunning = true
    this.currentView = 'session'
    this.abortController = new AbortController()

    this.mainBox.setContent('')
    this.logBox.setContent('')
    this.render()

    this.addSessionMessage('user', task)
    this.addLog(`Starting task: ${task}`)
    this.toasts.show({ variant: 'info', title: 'Processing', message: `Running task...` })

    try {
      const session = new Session(task, this.config.mode)

      this.addLog('Planning...')
      const plan = await this.createPlan(task)
      this.addSessionMessage('agent', `{bold}Plan:{/bold} ${plan.goal}`)
      for (const step of plan.steps) {
        this.addSessionMessage('agent', `  {dim}${step.id}:{/dim} ${step.description}`)
      }

      this.addLog('Executing plan...')
      const result = await this.executePlan(plan, session)

      if (result.success) {
        this.addSessionMessage('agent', `\n{green-fg}{bold}✓ Task Complete{/bold}{/green-fg}`)
        this.addLog(`Completed in ${result.iterations} iteration(s)`)
        if (result.filesChanged.length > 0) {
          this.addLog(`Files: ${result.filesChanged.join(', ')}`)
        }
        this.toasts.show({ variant: 'success', title: 'Done', message: `Completed in ${result.iterations} iterations` })
      } else {
        this.addSessionMessage('agent', `\n{red-fg}{bold}✖ Failed{/bold}{/red-fg}: ${result.summary}`)
        this.toasts.show({ variant: 'error', title: 'Failed', message: result.error || 'Unknown error' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.addSessionMessage('agent', `\n{red-fg}{bold}✖ Error{/bold}{/red-fg}: ${msg}`)
      this.toasts.show({ variant: 'error', title: 'Error', message: msg })
    } finally {
      this.isRunning = false
      this.abortController = null
      this.render()
      this.promptBox.focus()
    }
  }

  private async createPlan(task: string): Promise<Plan> {
    const prompt = `You are a JSON task planner. Break this coding task into 2-5 steps.

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
      { role: 'system', content: 'You are a JSON-only planner. Respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ], { model: this.config.model, maxTokens: 1024, temperature: 0.3 })

    return this.parsePlan(response.content || '')
  }

  private parsePlan(text: string): Plan {
    let json = text.trim()
    const m = json.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (m) json = m[1].trim()
    const bs = json.indexOf('{'), be = json.lastIndexOf('}')
    if (bs !== -1 && be !== -1) json = json.slice(bs, be + 1)

    const parsed = JSON.parse(json)
    if (!parsed.goal || !Array.isArray(parsed.steps)) throw new Error('Invalid plan')

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
        return { success: false, summary: 'Aborted', iterations: iter, duration: 0, filesChanged, error: 'Aborted' }
      }

      this.addLog(`[${iter}/${maxIter}] Querying LLM...`)

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
        this.addSessionMessage('agent', response.content)
      }

      if (!response.tool_calls || response.tool_calls.length === 0) {
        return { success: true, summary: response.content || 'Done', iterations: iter, duration: 0, filesChanged }
      }

      for (const tc of response.tool_calls) {
        const tool = this.toolRegistry.get(tc.function.name)
        let args: Record<string, unknown>
        try { args = JSON.parse(tc.function.arguments) } catch {
          messages.push({ role: 'tool', content: `Error: Invalid JSON for ${tc.function.name}`, tool_call_id: tc.id, name: tc.function.name } as Message)
          continue
        }
        if (!tool) {
          messages.push({ role: 'tool', content: `Error: Unknown tool "${tc.function.name}"`, tool_call_id: tc.id, name: tc.function.name } as Message)
          continue
        }

        this.addLog(`→ {bold}${tc.function.name}{/bold}`)

        if (this.config.mode === 'assist') {
          const approved = await this.dialogs.confirm({
            title: `Run tool: ${tc.function.name}`,
            message: `Args: ${JSON.stringify(args, null, 2)}`,
          })
          if (!approved) {
            messages.push({ role: 'tool', content: `Tool call rejected by user`, tool_call_id: tc.id, name: tc.function.name } as Message)
            continue
          }
        }

        try {
          const result = await tool.handler(args)
          messages.push({ role: 'tool', content: result, tool_call_id: tc.id, name: tc.function.name } as Message)

          const preview = result.length > 200 ? `${result.slice(0, 200)}...` : result
          this.addLog(`  {dim}←{/dim} ${preview}`)

          if (tc.function.name === 'write' || tc.function.name === 'edit') {
            const fp = args.filePath as string
            if (fp && !filesChanged.includes(fp)) filesChanged.push(fp)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          messages.push({ role: 'tool', content: `Error: ${msg}`, tool_call_id: tc.id, name: tc.function.name } as Message)
          this.addLog(`  {red-fg}✖{/red-fg} ${msg}`)
        }
      }
    }

    return {
      success: false,
      summary: `Max iterations (${maxIter}) reached`,
      iterations: maxIter, duration: 0, filesChanged,
      error: `Max iterations exceeded`,
    }
  }

  // --- Rendering Helpers ---

  private addLine(text: string): void {
    const content = this.mainBox.getContent()
    this.mainBox.setContent(content + text + '\n')
    this.scrollBottom(this.mainBox)
  }

  private divider(): void {
    this.addLine('{dim}────────────────────────────────────────────────{/dim}')
  }

  private addSessionMessage(role: 'user' | 'agent', text: string): void {
    const prefix = role === 'user'
      ? '{blue-fg}{bold}▶ You{/bold}{/blue-fg}'
      : '{green-fg}{bold}● Agent{/bold}{/green-fg}'
    const lines = text.split('\n').map(l => `  ${l}`).join('\n')
    this.addLine(`\n${prefix}:\n${lines}`)
  }

  private addLog(text: string): void {
    const content = this.logBox.getContent()
    const ts = new Date().toLocaleTimeString()
    this.logBox.setContent(content + `\n{dim}[${ts}]{/dim} ${text}`)
    this.scrollBottom(this.logBox)
    this.render()
  }

  private scrollBottom(box: blessed.Widgets.BoxElement): void {
    box.setScrollPerc(100)
  }

  private abort(): void {
    this.abortController?.abort()
  }
}
