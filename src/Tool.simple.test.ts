import { describe, it, expect } from 'bun:test'

describe('Tool', () => {
  it('should export Tool class', async () => {
    const { Tool } = await import('./Tool.js')
    expect(Tool).toBeDefined()
  })
})
