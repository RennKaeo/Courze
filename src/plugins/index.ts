import { readdir, stat } from 'node:fs/promises'
import { join, resolve, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PluginHooks, ToolCall, ToolResult, Message, Session } from './hooks.js'

export interface Plugin {
  name: string
  version: string
  hooks: Partial<PluginHooks>
}

function noop(): Promise<void> {
  return Promise.resolve()
}

function passthrough<T>(val: T): Promise<T> {
  return Promise.resolve(val)
}

export class PluginManager {
  private plugins: Plugin[] = []

  async loadPlugins(dir?: string): Promise<void> {
    const pluginDir = dir
      ? (isAbsolute(dir) ? dir : resolve(process.cwd(), dir))
      : join(process.cwd(), 'plugins')

    let entries: string[]
    try {
      entries = await readdir(pluginDir)
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(pluginDir, entry)
      let s
      try {
        s = await stat(fullPath)
      } catch {
        continue
      }
      if (!s.isDirectory() && !fullPath.endsWith('.js') && !fullPath.endsWith('.mjs')) {
        continue
      }
      try {
        const mod = await import(
          fullPath.startsWith('/') ? fileURLToPath(new URL(`file://${fullPath}`)) : fullPath
        )
        const plugin: Plugin = mod.default ?? mod
        if (plugin && plugin.name && plugin.hooks) {
          this.registerPlugin(plugin)
        }
      } catch {
      }
    }
  }

  registerPlugin(plugin: Plugin): void {
    const existing = this.plugins.findIndex(p => p.name === plugin.name)
    if (existing !== -1) {
      this.plugins[existing] = plugin
    } else {
      this.plugins.push(plugin)
    }
  }

  getHooks(): PluginHooks {
    return {
      beforeToolCall: async (toolCall: ToolCall, session: Session) => {
        let current: ToolCall | null = toolCall
        for (const p of this.plugins) {
          if (p.hooks.beforeToolCall) {
            current = await p.hooks.beforeToolCall(current, session)
            if (current === null) return null
          }
        }
        return current
      },
      afterToolCall: async (result: ToolResult, session: Session) => {
        let current = result
        for (const p of this.plugins) {
          if (p.hooks.afterToolCall) {
            current = await p.hooks.afterToolCall(current, session)
          }
        }
        return current
      },
      beforeMessage: async (message: Message, session: Session) => {
        let current = message
        for (const p of this.plugins) {
          if (p.hooks.beforeMessage) {
            current = await p.hooks.beforeMessage(current, session)
          }
        }
        return current
      },
      afterMessage: async (message: Message, session: Session) => {
        for (const p of this.plugins) {
          if (p.hooks.afterMessage) {
            await p.hooks.afterMessage(message, session)
          }
        }
      },
      onError: async (error: Error, session: Session) => {
        for (const p of this.plugins) {
          if (p.hooks.onError) {
            await p.hooks.onError(error, session)
          }
        }
      },
    }
  }

  getPlugins(): Plugin[] {
    return [...this.plugins]
  }
}