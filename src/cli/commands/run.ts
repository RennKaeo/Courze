import { Command } from 'commander'
import { loadConfig } from '../../config/loader.js'
import { createProvider } from '../../llm/provider.js'
import { ToolRegistry } from '../../tools/registry.js'
import { Agent } from '../../agent/index.js'
import { startSession, stopSession } from '../ui/spinner.js'
import { success, error } from '../ui/renderer.js'

export const runCommand = new Command('run')
  .description('Execute a task one-shot')
  .argument('<task>', 'Task description to execute')
  .option('--model <model>', 'Model identifier to use')
  .option('--provider <provider>', 'LLM provider (openai|anthropic|google|ollama)')
  .option('--mode <mode>', 'Operation mode (auto|assist)')
  .action(async (task, options) => {
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

    startSession('Processing...')
    try {
      const result = await agent.run(task)
      stopSession()
      success('Done')
      console.log(result.summary)
    } catch (err) {
      stopSession()
      error(`Agent error: ${err instanceof Error ? err.message : String(err)}`)
    }
  })