import blessed from 'blessed'
import type { LLMProvider } from '../llm/provider.js'
import type { ToolRegistry } from '../tools/registry.js'
import type { AgentConfig, AgentResult } from '../agent/types.js'
import { Agent, type ExecutorCallbacks } from '../agent/index.js'
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

  private agent: Agent
  private isRunning = false
  private currentView: 'home' | 'session' = 'home'

  constructor(provider: LLMProvider, toolRegistry: ToolRegistry, config: AgentConfig) {
    this.theme = new Theme()
    this.screen = this.createScreen()
    this.toasts = new ToastManager(this.screen)
    this.dialogs = new DialogManager(this.screen)
    this.createLayout()
    this.bindKeys()
    this.agent = new Agent(provider, toolRegistry, config, this.createCallbacks())
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
    const tc = this.theme.current

    this.headerBox = blessed.box({
      top: 0, left: 0, width: '100%', height: 1,
      content: this.formatHeader(),
      style: { fg: tc.primary, bold: true },
      tags: true,
    })

    this.mainBox = blessed.box({
      top: 1, left: 0, width: '100%', height: '70%-1',
      scrollable: true, alwaysScroll: true,
      scrollbar: { ch: '\u2502', style: { fg: tc.primary } },
      tags: true, content: '',
      mouse: true,
    })

    this.logBox = blessed.box({
      top: '70%', left: 0, width: '100%', height: '20%',
      scrollable: true, alwaysScroll: true,
      scrollbar: { ch: '\u2502', style: { fg: tc.warning } },
      tags: true, content: '',
      style: { fg: tc.text, bg: tc.background },
    })

    this.promptBox = blessed.textbox({
      top: '90%+1', left: 0, width: '100%', height: 1,
      inputOnFocus: true,
      style: { fg: tc.text, bg: tc.secondary },
      keys: true, mouse: true,
    })

    this.statusBox = blessed.box({
      top: '90%', left: 0, width: '100%', height: 1,
      content: this.formatStatus(),
      style: { fg: tc.textMuted, bg: tc.secondary },
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
    const agentConfig = this.agent.getConfig()
    const provider = this.agent.getProvider().name + '/' + agentConfig.model
    const mode = agentConfig.mode
    const view = this.currentView === 'home' ? 'HOME' : 'SESSION'
    const color = this.isRunning ? 'yellow' : 'green'
    const status = this.isRunning ? '\u25CF RUNNING' : '\u25CF READY'
    return ' {bold}Course Code{/bold}  {gray-fg}|{/gray-fg}  ' + provider + '  {gray-fg}|{/gray-fg}  mode: ' + mode + '  {gray-fg}|{/gray-fg}  {' + color + '-fg}' + status + '{/' + color + '-fg}  {gray-fg}|{/gray-fg}  {bold}[' + view + ']{/bold}'
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
    const ac = this.agent.getConfig()
    this.addLine(' {bold}Provider:{/bold} ' + this.agent.getProvider().name)
    this.addLine(' {bold}Model:{/bold}    ' + ac.model)
    this.addLine(' {bold}Mode:{/bold}     ' + ac.mode)
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

  private createCallbacks(): ExecutorCallbacks {
    return {
      onIteration: (iter, maxIter) => {
        this.addLog('[{bold}' + iter + '{/bold}/' + maxIter + '] Querying LLM...')
        this.render()
      },
      onAssistantMessage: (content) => {
        this.addSessionMessage('agent', content)
        this.render()
      },
      onToolCall: (toolName, args) => {
        this.addLog('\u2192 {bold}' + toolName + '{/bold}')
        this.render()
      },
      onToolResult: (toolName, result) => {
        const preview = result.length > 200 ? result.slice(0, 200) + '...' : result
        this.addLog('  {dim}\u2190{/dim} ' + preview)
        this.render()
      },
      onRequestApproval: async (toolName, args) => {
        const approved = await this.dialogs.confirm({
          title: 'Run tool: ' + toolName,
          message: 'Args: ' + JSON.stringify(args, null, 2),
        })
        return approved ? 'approve' : 'reject'
      },
    }
  }

  // --- Task Execution ---

  private async runTask(task: string): Promise<void> {
    this.isRunning = true
    this.currentView = 'session'

    this.mainBox.setContent('')
    this.logBox.setContent('')
    this.render()

    this.addSessionMessage('user', task)
    this.addLog(`Starting task: ${task}`)
    this.toasts.show({ variant: 'info', title: 'Processing', message: 'Running task...' })

    try {
      this.addLog('Planning...')
      const result = await this.agent.run(task)

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
      this.render()
      this.promptBox.focus()
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
    this.agent.abort()
  }
}
