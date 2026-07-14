import { describe, it, expect } from 'bun:test'
import {
  Tool,
  ToolInputJSONSchema,
  ValidationResult,
  SetToolJSXFn,
  ToolPermissionContext,
  getEmptyToolPermissionContext,
  CompactProgressEvent,
  ToolUseContext,
  ToolResult,
  ToolCallProgress,
  AnyObject,
  toolMatchesName,
  findToolByName,
  Progress,
  filterToolProgressMessages,
} from './Tool.js'

describe('Tool Types', () => {
  describe('ToolInputJSONSchema', () => {
    it('should allow object type with properties', () => {
      const schema: ToolInputJSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      }
      expect(schema.type).toBe('object')
    })
  })

  describe('ValidationResult', () => {
    it('should allow success result', () => {
      const result: ValidationResult = { result: true }
      expect(result.result).toBe(true)
    })

    it('should allow failure result with message and code', () => {
      const result: ValidationResult = {
        result: false,
        message: 'Invalid input',
        errorCode: 400,
      }
      expect(result.result).toBe(false)
      expect(result.message).toBe('Invalid input')
      expect(result.errorCode).toBe(400)
    })
  })

  describe('SetToolJSXFn', () => {
    it('should accept valid JSX setter', () => {
      const setter: SetToolJSXFn = (args) => {
        if (args) {
          expect(args.jsx).toBeDefined()
        }
      }
      setter({ jsx: null, shouldHidePromptInput: false })
      setter(null)
    })
  })

  describe('ToolPermissionContext', () => {
    it('should have correct structure with DeepImmutable', () => {
      const context: ToolPermissionContext = {
        mode: 'default',
        additionalWorkingDirectories: new Map(),
        alwaysAllowRules: {},
        alwaysDenyRules: {},
        alwaysAskRules: {},
        isBypassPermissionsModeAvailable: false,
      }
      expect(context.mode).toBe('default')
    })
  })

  describe('getEmptyToolPermissionContext', () => {
    it('should return empty context with defaults', () => {
      const context = getEmptyToolPermissionContext()
      expect(context.mode).toBe('default')
      expect(context.additionalWorkingDirectories).toBeInstanceOf(Map)
      expect(context.alwaysAllowRules).toEqual({})
      expect(context.alwaysDenyRules).toEqual({})
      expect(context.alwaysAskRules).toEqual({})
      expect(context.isBypassPermissionsModeAvailable).toBe(false)
    })
  })

  describe('CompactProgressEvent', () => {
    it('should allow hooks_start event', () => {
      const event: CompactProgressEvent = {
        type: 'hooks_start',
        hookType: 'pre_compact',
      }
      expect(event.type).toBe('hooks_start')
    })

    it('should allow compact_progress event with ratio', () => {
      const event: CompactProgressEvent = {
        type: 'compact_progress',
        ratio: 0.5,
      }
      expect(event.type).toBe('compact_progress')
      expect(event.ratio).toBe(0.5)
    })
  })

  describe('ToolUseContext', () => {
    it('should have required options structure', () => {
      const context: Partial<ToolUseContext> = {
        options: {
          commands: [],
          debug: false,
          mainLoopModel: 'test-model',
          tools: [],
          verbose: false,
          thinkingConfig: { thinkingBudget: 1000 },
          mcpClients: [],
          mcpResources: {},
          isNonInteractiveSession: false,
          agentDefinitions: { agents: [], builtIn: [] },
        },
      }
      expect(context.options?.commands).toEqual([])
      expect(context.options?.debug).toBe(false)
    })
  })

  describe('ToolResult', () => {
    it('should allow data with optional newMessages', () => {
      const result: ToolResult<string> = {
        data: 'success',
      }
      expect(result.data).toBe('success')
    })

    it('should allow contextModifier', () => {
      const result: ToolResult<string> = {
        data: 'success',
        contextModifier: (ctx) => ctx,
      }
      expect(result.contextModifier).toBeDefined()
    })
  })

  describe('toolMatchesName', () => {
    it('should return true for exact name match', () => {
      const tool = { name: 'read_file', aliases: ['read'] }
      expect(toolMatchesName(tool, 'read_file')).toBe(true)
    })

    it('should return true for alias match', () => {
      const tool = { name: 'read_file', aliases: ['read'] }
      expect(toolMatchesName(tool, 'read')).toBe(true)
    })

    it('should return false for non-matching name', () => {
      const tool = { name: 'read_file', aliases: ['read'] }
      expect(toolMatchesName(tool, 'write_file')).toBe(false)
    })

    it('should handle tool without aliases', () => {
      const tool = { name: 'read_file' }
      expect(toolMatchesName(tool, 'read_file')).toBe(true)
      expect(toolMatchesName(tool, 'other')).toBe(false)
    })
  })

  describe('findToolByName', () => {
    it('should find tool by name', () => {
      const tools = [
        { name: 'read_file' },
        { name: 'write_file', aliases: ['write'] },
      ]
      expect(findToolByName(tools, 'read_file')?.name).toBe('read_file')
    })

    it('should find tool by alias', () => {
      const tools = [
        { name: 'write_file', aliases: ['write'] },
      ]
      expect(findToolByName(tools, 'write')?.name).toBe('write_file')
    })

    it('should return undefined for non-existent tool', () => {
      const tools = [{ name: 'read_file' }]
      expect(findToolByName(tools, 'nonexistent')).toBeUndefined()
    })
  })

  describe('filterToolProgressMessages', () => {
    it('should filter out hook_progress messages', () => {
      const messages = [
        { data: { type: 'bash_progress' } },
        { data: { type: 'hook_progress' } },
        { data: { type: 'mcp_progress' } },
      ]
      const filtered = filterToolProgressMessages(messages as any)
      expect(filtered.length).toBe(2)
      expect(filtered.every(m => m.data?.type !== 'hook_progress')).toBe(true)
    })
  })

  describe('Progress type', () => {
    it('should accept ToolProgressData or HookProgress', () => {
      const toolProgress: Progress = {
        toolUseID: '123',
        data: { type: 'bash_progress', stage: 'running' },
      }
      const hookProgress: Progress = {
        toolUseID: '456',
        data: { type: 'hook_progress', hookType: 'pre_tool' },
      }
      expect(toolProgress.data.type).toBe('bash_progress')
      expect(hookProgress.data.type).toBe('hook_progress')
    })
  })
})