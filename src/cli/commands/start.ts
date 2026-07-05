import { Command } from 'commander'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { loadConfig } from '../../config/loader.js'
import type { CourseConfig } from '../../config/schema.js'
import { createProvider } from '../../llm/provider.js'
import { ToolRegistry } from '../../tools/registry.js'
import { Agent } from '../../agent/index.js'
import { startSession, stopSession } from '../ui/spinner.js'
import { info, success, error, divider } from '../ui/renderer.js'

export const startCommand = new Command('start')
  .description('Starts an interactive session')
  .option('--model <model>', 'Model identifier to use')
  .option('--provider <provider>', 'LLM provider (openai|anthropic|google|ollama)')
  .option('--mode <mode>', 'Operation mode (auto|assist)')
  .action(async (options) => {
    const config = await loadConfig()
    if (options.provider) config.provider = options.provider
    if (options.model) config.model = options.model
    if (options.mode) config.mode = options.mode

    const provider = createProvider(config.provider, { model: config.model })
    const toolRegistry = new ToolRegistry()
    const agent = new Agent(provider, toolRegistry, {
      provider: config.provider,
      model: config.model,
      mode: config.mode as 'auto' | 'assist',
      maxIterations: config.maxIterations,
      systemPrompt: config.systemPrompt,
    })
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
  })