import { describe, it, expect, vi } from 'vitest'
import { ToolRegistry } from '../src/tools/registry.js'
import { truncate, formatDuration, generateId, sleep, validatePath } from '../src/utils/helpers.js'
import { countTokens, countMessageTokens } from '../src/context/tokenizer.js'
import { ContextManager } from '../src/context/manager.js'
import { PluginManager } from '../src/plugins/index.js'
import { ConfigSchema } from '../src/config/schema.js'

describe('ToolRegistry', () => {
  it('registers and retrieves tools', () => {
    const registry = new ToolRegistry()
    const mockTool = {
      name: 'test_tool',
      description: 'A test tool',
      schema: { type: 'object', properties: { input: { type: 'string' } } },
      handler: vi.fn().mockResolvedValue('result'),
    }
    registry.register(mockTool)
    expect(registry.get('test_tool')).toEqual(mockTool)
    expect(registry.list()).toContainEqual(expect.objectContaining({ name: 'test_tool' }))
  })

  it('throws on duplicate registration', () => {
    const registry = new ToolRegistry()
    const mockTool = { name: 'dup', description: 'd', schema: {}, handler: vi.fn() }
    registry.register(mockTool)
    expect(() => registry.register(mockTool)).toThrow()
  })

  it('pre-registers 7 default tools', () => {
    const registry = new ToolRegistry()
    const names = registry.list().map(t => t.name)
    expect(names).toContain('read')
    expect(names).toContain('write')
    expect(names).toContain('edit')
    expect(names).toContain('glob')
    expect(names).toContain('bash')
    expect(names).toContain('grep')
    expect(names).toContain('web_fetch')
    expect(registry.list()).toHaveLength(7)
  })

  it('get returns undefined for unknown tool', () => {
    const registry = new ToolRegistry()
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('getAll returns all tools', () => {
    const registry = new ToolRegistry()
    expect(registry.getAll()).toHaveLength(7)
  })

  it('getDefinitions returns formatted tool definitions', () => {
    const registry = new ToolRegistry()
    const defs = registry.getDefinitions()
    expect(defs.length).toBeGreaterThan(0)
    expect(defs[0]).toHaveProperty('name')
    expect(defs[0]).toHaveProperty('description')
    expect(defs[0]).toHaveProperty('parameters')
  })
})

describe('helpers', () => {
  it('truncates long strings', () => {
    expect(truncate('hello world', 8)).toBe('hello...')
    expect(truncate('short', 10)).toBe('short')
    expect(truncate('', 5)).toBe('')
  })

  it('formats duration', () => {
    expect(formatDuration(500)).toBe('500ms')
    expect(formatDuration(1500)).toBe('1.5s')
    expect(formatDuration(65000)).toBe('1m 5s')
    expect(formatDuration(120000)).toBe('2m')
  })

  it('generates unique ids', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).not.toBe(id2)
    expect(id1.length).toBeGreaterThan(0)
    expect(id2.length).toBeGreaterThan(0)
  })

  it('sleep resolves after time', async () => {
    const start = Date.now()
    await sleep(50)
    expect(Date.now() - start).toBeGreaterThanOrEqual(40)
  })

  it('validatePath accepts paths within cwd', () => {
    expect(() => validatePath(process.cwd())).not.toThrow()
  })

  it('validatePath rejects paths outside cwd', () => {
    expect(() => validatePath('/etc/passwd')).toThrow('outside the allowed directory')
  })
})

describe('tokenizer', () => {
  it('countTokens returns 0 for empty text', () => {
    expect(countTokens('')).toBe(0)
    expect(countTokens(' ')).toBeGreaterThan(0)
  })

  it('countTokens returns positive count for text', () => {
    expect(countTokens('hello world')).toBeGreaterThan(0)
    expect(countTokens('Hello, this is a test sentence with multiple words.')).toBeGreaterThan(3)
  })

  it('countTokens with longer text returns more tokens', () => {
    const short = countTokens('short text')
    const long = countTokens('a '.repeat(100))
    expect(long).toBeGreaterThan(short)
  })

  it('countMessageTokens accounts for role overhead', () => {
    const msg = { role: 'user', content: 'hello' }
    const tokens = countMessageTokens(msg)
    expect(tokens).toBeGreaterThan(countTokens('hello'))
  })

  it('countMessageTokens handles tool calls', () => {
    const msg = {
      role: 'assistant',
      content: '',
      tool_calls: [{ id: 'call_1', name: 'read', arguments: '{}' }],
    }
    const tokens = countMessageTokens(msg)
    expect(tokens).toBeGreaterThan(0)
  })

  it('countMessageTokens handles name and tool_call_id', () => {
    const msg = {
      role: 'tool',
      content: 'result',
      name: 'read',
      tool_call_id: 'call_1',
    }
    const tokens = countMessageTokens(msg)
    expect(tokens).toBeGreaterThan(countTokens('result'))
  })
})

describe('ContextManager', () => {
  it('starts empty', () => {
    const cm = new ContextManager()
    expect(cm.getMessages()).toEqual([])
  })

  it('adds messages', () => {
    const cm = new ContextManager()
    cm.addMessage({ role: 'user', content: 'hello' })
    expect(cm.getMessages()).toHaveLength(1)
  })

  it('trims when token limit exceeded', () => {
    const cm = new ContextManager(100)
    for (let i = 0; i < 20; i++) {
      cm.addMessage({ role: 'user', content: 'hello world '.repeat(10) })
    }
    expect(cm.getMessages().length).toBeLessThan(20)
    expect(cm.getMessages().length).toBeGreaterThan(0)
  })

  it('preserves system messages during trim', () => {
    const cm = new ContextManager(100)
    cm.addMessage({ role: 'system', content: 'You are a helpful assistant.' })
    for (let i = 0; i < 20; i++) {
      cm.addMessage({ role: 'user', content: 'hello world '.repeat(10) })
    }
    const msgs = cm.getMessages()
    expect(msgs.filter(m => m.role === 'system').length).toBeGreaterThanOrEqual(1)
  })

  it('getMessages returns a copy', () => {
    const cm = new ContextManager()
    cm.addMessage({ role: 'user', content: 'test' })
    const msgs = cm.getMessages()
    msgs.push({ role: 'user', content: 'hacked' })
    expect(cm.getMessages()).toHaveLength(1)
  })
})

describe('PluginManager', () => {
  it('starts with no plugins', () => {
    const pm = new PluginManager()
    expect(pm.getPlugins()).toEqual([])
  })

  it('registers plugins', () => {
    const pm = new PluginManager()
    const plugin = {
      name: 'test-plugin',
      version: '1.0.0',
      hooks: {
        beforeToolCall: vi.fn().mockResolvedValue({ id: '1', name: 'read', arguments: '{}' }),
        afterToolCall: vi.fn().mockResolvedValue({ tool_call_id: '1', output: 'done' }),
      },
    }
    pm.registerPlugin(plugin)
    expect(pm.getPlugins()).toHaveLength(1)
  })

  it('replaces existing plugin with same name', () => {
    const pm = new PluginManager()
    pm.registerPlugin({ name: 'p', version: '1', hooks: {} })
    pm.registerPlugin({ name: 'p', version: '2', hooks: {} })
    expect(pm.getPlugins()).toHaveLength(1)
    expect(pm.getPlugins()[0].version).toBe('2')
  })

  it('getHooks returns composed hooks', () => {
    const pm = new PluginManager()
    const hooks = pm.getHooks()
    expect(hooks).toHaveProperty('beforeToolCall')
    expect(hooks).toHaveProperty('afterToolCall')
    expect(hooks).toHaveProperty('beforeMessage')
    expect(hooks).toHaveProperty('afterMessage')
    expect(hooks).toHaveProperty('onError')
  })

  it('beforeToolCall can reject tool calls', async () => {
    const pm = new PluginManager()
    pm.registerPlugin({
      name: 'rejector',
      version: '1',
      hooks: {
        beforeToolCall: vi.fn().mockResolvedValue(null),
      },
    })
    const hooks = pm.getHooks()
    const result = await hooks.beforeToolCall(
      { id: '1', name: 'bash', arguments: '{}' },
      { id: 's1', messages: [], config: {} },
    )
    expect(result).toBeNull()
  })
})

describe('ConfigSchema', () => {
  it('parses valid config', () => {
    const config = ConfigSchema.parse({
      provider: 'openai',
      model: 'gpt-4o',
      mode: 'auto',
      maxIterations: 25,
    })
    expect(config.provider).toBe('openai')
    expect(config.model).toBe('gpt-4o')
    expect(config.mode).toBe('auto')
    expect(config.maxIterations).toBe(25)
  })

  it('applies defaults for missing fields', () => {
    const config = ConfigSchema.parse({})
    expect(config.provider).toBe('openai')
    expect(config.model).toBe('gpt-4o')
    expect(config.mode).toBe('auto')
    expect(config.maxIterations).toBe(25)
    expect(config.temperature).toBe(0.7)
    expect(config.maxTokens).toBe(4096)
  })

  it('rejects invalid mode', () => {
    expect(() => ConfigSchema.parse({ mode: 'invalid' })).toThrow()
  })

  it('rejects negative maxIterations', () => {
    expect(() => ConfigSchema.parse({ maxIterations: -1 })).toThrow()
  })

  it('rejects invalid temperature range', () => {
    expect(() => ConfigSchema.parse({ temperature: 2.5 })).toThrow()
    expect(() => ConfigSchema.parse({ temperature: -1 })).toThrow()
  })
})
