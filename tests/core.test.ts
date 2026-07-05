import { describe, it, expect, vi } from 'vitest'
import { ToolRegistry } from '../src/tools/registry.js'
import { truncate, formatDuration, generateId, sleep } from '../src/utils/helpers.js'

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
})

describe('helpers', () => {
  it('truncates long strings', () => {
    expect(truncate('hello world', 8)).toBe('hello...')
    expect(truncate('short', 10)).toBe('short')
  })

  it('formats duration', () => {
    expect(formatDuration(500)).toBe('500ms')
    expect(formatDuration(1500)).toBe('1.5s')
    expect(formatDuration(65000)).toBe('1m 5s')
  })

  it('generates unique ids', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).not.toBe(id2)
    expect(id1.length).toBeGreaterThan(0)
  })

  it('sleep resolves after time', async () => {
    const start = Date.now()
    await sleep(50)
    expect(Date.now() - start).toBeGreaterThanOrEqual(40)
  })
})