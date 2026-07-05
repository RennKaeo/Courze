import { Command } from 'commander'
import { loadConfig } from '../../config/loader.js'
import { createProvider } from '../../llm/factory.js'
import { ToolRegistry } from '../../tools/registry.js'
import { TUI } from '../../tui/index.js'

export const startCommand = new Command('start')
  .description('Starts TUI interactive session')
  .option('--model <model>', 'Model identifier to use')
  .option('--provider <provider>', 'LLM provider (openai|anthropic|google|ollama)')
  .option('--mode <mode>', 'Operation mode (auto|assist)')
  .option('--no-tui', 'Use basic CLI instead of TUI')
  .action(async (options) => {
    const config = await loadConfig()
    if (options.provider) config.provider = options.provider
    if (options.model) config.model = options.model
    if (options.mode) config.mode = options.mode

    const provider = createProvider(config.provider, { model: config.model })
    const toolRegistry = new ToolRegistry()

    const agentConfig = {
      provider: config.provider,
      model: config.model,
      mode: config.mode as 'auto' | 'assist',
      maxIterations: config.maxIterations,
      systemPrompt: config.systemPrompt,
    }

    if (options.tui === false) {
      const { startSession, stopSession } = await import('../ui/spinner.js')
      const { info, success, error, divider } = await import('../ui/renderer.js')
      const { Agent } = await import('../../agent/index.js')
      const { createInterface } = await import('node:readline/promises')
      const { stdin, stdout } = await import('node:process')

      const agent = new Agent(provider, toolRegistry, agentConfig)
      const rl = createInterface({ input: stdin, output: stdout })

      info('Course Code interactive session started. Type your task or "exit" to quit.')
      divider()

      try {
        while (true) {
          const task = await rl.question('> ')
          if (['exit', 'quit'].includes(task.toLowerCase().trim())) break
          if (!task.trim()) continue
          startSession('Thinking...')
          try {
            const result = await agent.run(task)
            stopSession()
            console.log(result.summary)
          } catch (err) {
            stopSession()
            error(`Agent error: ${err instanceof Error ? err.message : String(err)}`)
          }
          divider()
        }
      } finally {
        rl.close()
      }
      return
    }

    const tui = new TUI(provider, toolRegistry, agentConfig)
    tui.start()
  })