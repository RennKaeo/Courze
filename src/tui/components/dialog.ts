import blessed from 'blessed'

export type DialogResult<T = string> = T | null

export class DialogManager {
  private screen: blessed.Widgets.Screen

  constructor(screen: blessed.Widgets.Screen) {
    this.screen = screen
  }

  confirm(input: { title: string; message: string }): Promise<boolean> {
    return new Promise((resolve) => {
      const box = blessed.box({
        top: 'center',
        left: 'center',
        width: 50,
        height: 7,
        border: { type: 'line' },
        style: { bg: 'black', fg: 'white', border: { fg: 'cyan' } },
        tags: true,
        content: `{bold}${input.title}{/bold}\n\n${input.message}\n\n{yellow-fg}[y] Yes  [n] No{/yellow-fg}`,
      })
      this.screen.append(box)
      this.screen.render()

      const cleanup = () => {
        this.screen.remove(box)
        this.screen.render()
      }

      this.screen.key('y', () => { cleanup(); resolve(true) })
      this.screen.key('n', () => { cleanup(); resolve(false) })
    })
  }

  select<T>(input: { title: string; options: { label: string; value: T; description?: string }[] }): Promise<T | null> {
    return new Promise((resolve) => {
      let selected = 0
      const maxIdx = input.options.length - 1

      const box = blessed.box({
        top: 'center',
        left: 'center',
        width: 60,
        height: Math.min(input.options.length + 4, 20),
        border: { type: 'line' },
        style: { bg: 'black', fg: 'white', border: { fg: 'cyan' } },
        tags: true,
      })
      this.screen.append(box)
      this.screen.render()

      const render = () => {
        const items = input.options.map((opt, i) => {
          const marker = i === selected ? '{cyan-fg}›{/cyan-fg}' : ' '
          const desc = opt.description ? ` {dim}${opt.description}{/dim}` : ''
          return ` ${marker} ${opt.label}${desc}`
        }).join('\n')
        box.setContent(`{bold}${input.title}{/bold}\n\n${items}\n\n{dim}↑↓ navigate  enter select  esc cancel{/dim}`)
        this.screen.render()
      }
      render()

      const cleanup = () => {
        this.screen.unkey('up', onUp)
        this.screen.unkey('down', onDown)
        this.screen.unkey('enter', onEnter)
        this.screen.unkey('escape', onEsc)
        this.screen.remove(box)
        this.screen.render()
      }

      const onUp = () => { selected = Math.max(0, selected - 1); render() }
      const onDown = () => { selected = Math.min(maxIdx, selected + 1); render() }
      const onEnter = () => { cleanup(); resolve(input.options[selected].value) }
      const onEsc = () => { cleanup(); resolve(null) }

      this.screen.key('up', onUp)
      this.screen.key('down', onDown)
      this.screen.key('enter', onEnter)
      this.screen.key('escape', onEsc)
    })
  }

  prompt(input: { title: string; placeholder?: string; defaultValue?: string }): Promise<string | null> {
    return new Promise((resolve) => {
      const box = blessed.box({
        top: 'center',
        left: 'center',
        width: 60,
        height: 5,
        border: { type: 'line' },
        style: { bg: 'black', fg: 'white', border: { fg: 'cyan' } },
        tags: true,
        content: `{bold}${input.title}{/bold}\n`,
      })
      const textInput = blessed.textbox({
        top: 2,
        left: 1,
        width: 56,
        height: 1,
        inputOnFocus: true,
        style: { fg: 'white', bg: 'blue' },
        value: input.defaultValue || '',
      })
      box.append(textInput)
      this.screen.append(box)
      this.screen.render()

      textInput.focus()

      const cleanup = () => {
        this.screen.remove(box)
        this.screen.render()
      }

      this.screen.key('enter', () => {
        const val = textInput.getValue()?.trim()
        cleanup()
        resolve(val || null)
      })
      this.screen.key('escape', () => {
        cleanup()
        resolve(null)
      })
    })
  }
}
