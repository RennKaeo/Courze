import { describe, it, expect } from 'bun:test'
import type {
  QueryEngineConfig,
  SDKMessage,
  SDKStatus,
  SDKPermissionDenial,
  ContentBlockParam,
} from './QueryEngine.js'
import type { Tools, ToolUseContext, CanUseToolFn } from './Tool.js'
import type { Command } from './commands.js'
import type { MCPServerConnection } from './services/mcp/types.js'
import type { AgentDefinition } from './tools/AgentTool/loadAgentsDir.js'
import type { AppState } from './state/AppState.js'
import type { Message } from './types/message.js'
import type { ThinkingConfig } from './utils/thinking.js'
import type { FileStateCache } from './utils/fileStateCache.js'
import type { SDKStatus as SDKStatusType } from './entrypoints/agentSdkTypes.js'
import type { OrphanedPermission } from './types/textInputTypes.js'

describe('QueryEngine Types', () => {
  describe('QueryEngineConfig', () => {
    it('should have all required properties', () => {
      // This is a compile-time type test
      const config: QueryEngineConfig = {
        cwd: '/test',
        tools: [] as Tools,
        commands: [] as Command[],
        mcpClients: [] as MCPServerConnection[],
        agents: [] as AgentDefinition[],
        canUseTool: async () => ({ behavior: 'allow', updatedInput: {} }),
        getAppState: () => ({} as AppState),
        setAppState: (f) => f({} as AppState),
        readFileCache: {} as FileStateCache,
      }

      expect(config.cwd).toBe('/test')
      expect(Array.isArray(config.tools)).toBe(true)
      expect(Array.isArray(config.commands)).toBe(true)
      expect(Array.isArray(config.mcpClients)).toBe(true)
      expect(Array.isArray(config.agents)).toBe(true)
      expect(typeof config.canUseTool).toBe('function')
      expect(typeof config.getAppState).toBe('function')
      expect(typeof config.setAppState).toBe('function')
    })

    it('should accept optional properties', () => {
      const config: QueryEngineConfig = {
        cwd: '/test',
        tools: [] as Tools,
        commands: [] as Command[],
        mcpClients: [] as MCPServerConnection[],
        agents: [] as AgentDefinition[],
        canUseTool: async () => ({ behavior: 'allow', updatedInput: {} }),
        getAppState: () => ({} as AppState),
        setAppState: (f) => f({} as AppState),
        readFileCache: {} as FileStateCache,
        initialMessages: [] as Message[],
        customSystemPrompt: 'custom prompt',
        appendSystemPrompt: 'append prompt',
        userSpecifiedModel: 'gpt-4',
        fallbackModel: 'gpt-3.5',
        thinkingConfig: { type: 'enabled' } as ThinkingConfig,
        maxTurns: 10,
        maxBudgetUsd: 100,
        taskBudget: { total: 50 },
        jsonSchema: { type: 'object' },
        verbose: true,
        replayUserMessages: false,
        includePartialMessages: false,
        handleElicitation: async () => ({ action: 'accept', content: {} }),
        setSDKStatus: (status: SDKStatusType) => {},
        abortController: new AbortController(),
        orphanedPermission: undefined as OrphanedPermission | undefined,
      }

      expect(config.customSystemPrompt).toBe('custom prompt')
      expect(config.maxTurns).toBe(10)
      expect(config.verbose).toBe(true)
    })
  })

  describe('SDKPermissionDenial', () => {
    it('should have correct structure', () => {
      const denial: SDKPermissionDenial = {
        tool_name: 'Bash',
        tool_use_id: 'tool-123',
        tool_input: { command: 'ls' },
      }

      expect(denial.tool_name).toBe('Bash')
      expect(denial.tool_use_id).toBe('tool-123')
      expect(denial.tool_input).toEqual({ command: 'ls' })
    })
  })

  describe('ContentBlockParam', () => {
    it('should allow text content', () => {
      const content: ContentBlockParam = {
        type: 'text',
        text: 'Hello world',
      }
      expect(content.type).toBe('text')
      expect(content.text).toBe('Hello world')
    })

    it('should allow tool_use content', () => {
      const content: ContentBlockParam = {
        type: 'tool_use',
        id: 'tool-123',
        name: 'Bash',
        input: { command: 'ls' },
      }
      expect(content.type).toBe('tool_use')
      expect(content.id).toBe('tool-123')
    })

    it('should allow tool_result content', () => {
      const content: ContentBlockParam = {
        type: 'tool_result',
        tool_use_id: 'tool-123',
        content: 'Output here',
      }
      expect(content.type).toBe('tool_result')
      expect(content.tool_use_id).toBe('tool-123')
    })
  })
})

describe('QueryEngine Module Existence', () => {
  it('should export QueryEngineConfig type', () => {
    // Type-only exports work at compile time
    const config: QueryEngineConfig = {
      cwd: '/test',
      tools: [] as Tools,
      commands: [] as Command[],
      mcpClients: [] as MCPServerConnection[],
      agents: [] as AgentDefinition[],
      canUseTool: async () => ({ behavior: 'allow', updatedInput: {} }),
      getAppState: () => ({} as AppState),
      setAppState: (f) => f({} as AppState),
      readFileCache: {} as FileStateCache,
    }
    expect(config).toBeDefined()
  })
})