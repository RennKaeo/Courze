import { z } from 'zod'

export const ConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'ollama']).default('openai'),
  model: z.string().default('gpt-4o'),
  mode: z.enum(['auto', 'assist']).default('auto'),
  maxIterations: z.number().min(1).max(100).default(25),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(100).max(128000).default(4096),
  apiKeys: z.object({
    openai: z.string().optional(),
    anthropic: z.string().optional(),
    google: z.string().optional(),
  }).default({}),
  systemPrompt: z.string().default(
    'You are Course Code, an expert AI coding agent. You help users write, debug, and improve code. ' +
    'You have access to tools for reading/writing files, running commands, and searching code. ' +
    'Think step by step, use tools when needed, and provide clear explanations.'
  ),
})

export type CourseConfig = z.infer<typeof ConfigSchema>
