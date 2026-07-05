import type { LLMProvider } from '../llm/provider.js'
import type { ToolRegistry } from '../tools/registry.js'
import { Planner } from './planner.js'
import { Executor } from './executor.js'
import { Session } from './session.js'
import type { AgentConfig, AgentResult, Plan } from './types.js'

export type { AgentConfig, AgentResult, Plan }
export { Session } from './session.js'
export { Planner } from './planner.js'
export { Executor } from './executor.js'
export * from './types.js'

export function createAgent(provider: LLMProvider, toolRegistry: ToolRegistry, config: AgentConfig): Agent {
  return new Agent(provider, toolRegistry, config)
}

export class Agent {
  private provider: LLMProvider
  private toolRegistry: ToolRegistry
  private config: AgentConfig
  private planner: Planner
  private executor: Executor
  private abortSignal: AbortController

  constructor(provider: LLMProvider, toolRegistry: ToolRegistry, config: AgentConfig) {
    this.provider = provider
    this.toolRegistry = toolRegistry
    this.config = config
    this.planner = new Planner(provider, config)
    this.executor = new Executor(provider, toolRegistry, config)
    this.abortSignal = new AbortController()
  }

  async run(task: string): Promise<AgentResult> {
    const startTime = Date.now()
    const session = this.startSession(task)

    this.setupInterruptHandler(session)

    try {
      if (this.abortSignal.signal.aborted) {
        return this.abortedResult(startTime)
      }

      let plan: Plan
      try {
        const context = session.getContext()
        plan = await this.planner.plan(task, context)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          success: false,
          summary: `Planning failed: ${message}`,
          iterations: 0,
          duration: Date.now() - startTime,
          filesChanged: [],
          error: message,
        }
      }

      if (this.abortSignal.signal.aborted) {
        return this.abortedResult(startTime)
      }

      const result = await this.executor.execute(plan, session)

      if (this.abortSignal.signal.aborted) {
        return this.abortedResult(startTime, result.filesChanged)
      }

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        summary: `Agent execution failed: ${message}`,
        iterations: session.iteration,
        duration: Date.now() - startTime,
        filesChanged: [...session.filesWritten],
        error: message,
      }
    } finally {
      this.cleanupInterruptHandler()
    }
  }

  startSession(task?: string): Session {
    return new Session(task || '', this.config.mode)
  }

  getProvider(): LLMProvider {
    return this.provider
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry
  }

  getConfig(): AgentConfig {
    return { ...this.config }
  }

  abort(): void {
    this.abortSignal.abort()
  }

  private setupInterruptHandler(session: Session): void {
    const handler = () => {
      process.stderr.write('\n\nInterrupted by user. Finishing current step...\n')
      this.abortSignal.abort()
    }
    process.on('SIGINT', handler)
    process.on('SIGTERM', handler)
  }

  private cleanupInterruptHandler(): void {
    process.removeAllListeners('SIGINT')
    process.removeAllListeners('SIGTERM')
  }

  private abortedResult(startTime: number, filesChanged: string[] = []): AgentResult {
    return {
      success: false,
      summary: 'Execution was interrupted by user',
      iterations: 0,
      duration: Date.now() - startTime,
      filesChanged,
      error: 'Interrupted by user',
    }
  }
}
