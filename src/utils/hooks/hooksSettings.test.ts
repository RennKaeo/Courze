import { describe, expect, test } from 'bun:test'
import { hookSourceDescriptionDisplayString } from './hooksSettings.js'

describe('hookSourceDescriptionDisplayString', () => {
  test('uses the canonical Course Code plugin path for plugin hooks', () => {
    const description = hookSourceDescriptionDisplayString('pluginHook')

    expect(description).toBe(
      'Plugin hooks (~/.course/plugins/*/hooks/hooks.json)',
    )
    expect(description).not.toContain('~/.claude/')
  })
})
