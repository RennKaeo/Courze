import { defineVendor } from '../define.js'

export default defineVendor({
  id: 'opencode-zen',
  label: 'OpenCode Zen',
  classification: 'openai-compatible',
  defaultBaseUrl: 'https://opencode.ai/zen/v1',
  defaultModel: 'gpt-5.5',
  requiredEnvVars: ['OPENCODE_API_KEY'],
  setup: {
    requiresAuth: true,
    authMode: 'api-key',
    credentialEnvVars: ['OPENCODE_API_KEY', 'OPENAI_API_KEY'],
  },
  transportConfig: {
    kind: 'openai-compatible',
    openaiShim: {
      preserveReasoningContent: true,
      thinkingRequestFormat: 'openai',
      maxTokensField: 'max_tokens',
    },
  },
  preset: {
    id: 'opencode-zen',
    description: 'OpenCode Zen multi-model gateway',
    apiKeyEnvVars: ['OPENCODE_API_KEY', 'OPENAI_API_KEY'],
  },
  catalog: {
    source: 'static',
    models: [
      { id: 'gpt-5.5', apiName: 'gpt-5.5', label: 'GPT 5.5', modelDescriptorId: 'opencode-gpt-5.5' },
      { id: 'gpt-5.4', apiName: 'gpt-5.4', label: 'GPT 5.4', modelDescriptorId: 'opencode-gpt-5.4' },
      { id: 'claude-opus-4-8', apiName: 'claude-opus-4-8', label: 'Claude Opus 4.8', modelDescriptorId: 'opencode-claude-opus-4-8' },
      { id: 'claude-sonnet-4-6', apiName: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', modelDescriptorId: 'opencode-claude-sonnet-4-6' },
      { id: 'gemini-3.5-flash', apiName: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', modelDescriptorId: 'opencode-gemini-3.5-flash' },
      { id: 'deepseek-v4-pro', apiName: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', modelDescriptorId: 'opencode-deepseek-v4-pro' },
      { id: 'grok-build-0.1', apiName: 'grok-build-0.1', label: 'Grok Build 0.1', modelDescriptorId: 'opencode-grok-build-0.1' },
    ],
  },
  usage: { supported: false },
})
