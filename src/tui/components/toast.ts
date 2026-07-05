import blessed from 'blessed'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: string
  variant: ToastVariant
  title?: string
  message: string
  duration: number
}

export class ToastManager {
  private screen: blessed.Widgets.Screen
  private container: blessed.Widgets.BoxElement
  private toasts: Toast[] = []
  private timers: Map<string, NodeJS.Timeout> = new Map()

  constructor(screen: blessed.Widgets.Screen) {
    this.screen = screen
    this.container = blessed.box({
      top: 0,
      right: 0,
      width: 40,
      height: 'shrink',
      tags: true,
    })
    screen.append(this.container)
  }

  show(input: { variant?: ToastVariant; title?: string; message: string; duration?: number }): void {
    const toast: Toast = {
      id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      variant: input.variant || 'info',
      title: input.title,
      message: input.message,
      duration: input.duration ?? 4000,
    }
    this.toasts.push(toast)
    this.render()
    const timer = setTimeout(() => this.dismiss(toast.id), toast.duration)
    this.timers.set(toast.id, timer)
  }

  dismiss(id: string): void {
    const timer = this.timers.get(id)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(id)
    }
    this.toasts = this.toasts.filter(t => t.id !== id)
    this.render()
  }

  private render(): void {
    const items = this.toasts.map(t => {
      const color = { info: 'cyan', success: 'green', warning: 'yellow', error: 'red' }[t.variant]
      const icon = { info: 'ℹ', success: '✔', warning: '⚠', error: '✖' }[t.variant]
      const title = t.title ? ` {bold}${t.title}{/bold}\n` : ''
      return `{${color}-fg}{bold}${icon}{/bold} ${title}{/${color}-fg}${t.message}`
    }).join('\n\n')
    this.container.setContent(items)
    this.screen.render()
  }

  destroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
    this.toasts = []
  }
}
