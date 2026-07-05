#!/usr/bin/env node

import { program } from './cli/index.js'
import { loadConfig, getDefaultConfig } from './config/loader.js'
import { ToolRegistry } from './tools/registry.js'
import { createProvider } from './llm/factory.js'
import { Agent } from './agent/index.js'
import { logger } from './utils/logger.js'

async function main() {
  try {
    await program.parseAsync(process.argv)
  } catch (error) {
    logger.error('Fatal error:', error)
    process.exit(1)
  }
}

main()

export { main, ToolRegistry, createProvider, Agent, loadConfig, getDefaultConfig }