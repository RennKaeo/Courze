import { describe, it, expect } from 'bun:test'
import { getLogDisplayTitle } from './log.js'

describe('getLogDisplayTitle', () => {
  it('should return log title', () => {
    const log = { firstPrompt: 'test prompt' }
    const result = getLogDisplayTitle(log)
    expect(result).toBe('test prompt')
  })

  it('should handle empty log', () => {
    const log = {}
    const result = getLogDisplayTitle(log)
    expect(typeof result).toBe('string')
  })
})
