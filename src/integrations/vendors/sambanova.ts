import { defineVendor } from '../define.js'

export default defineVendor({
  id: 'sambanova',
  label: 'SambaNova',
  classification: 'openai-compatible',
  defaultBaseUrl: 'https://api.sambanova.ai/v1',
  defaultModel: 'Meta-Llama-3.1-405B-Instruct',
  requiredEnvVars: ['SAMBANOVA_API_KEY'],
  setup: {
    requiresAuth: true,
    authMode: 'api-key',
    credentialEnvVars: ['SAMBANOVA_API_KEY'],
  },
  transportConfig: {
    kind: 'openai-compatible',
    openaiShim: {
      preserveReasoningContent: false,
      thinkingRequestFormat: 'openai',
      maxTokensField: 'max_tokens',
    },
  },
  preset: {
    id: 'sambanova',
    description: 'SambaNova fast inference',
    apiKeyEnvVars: ['SAMBANOVA_API_KEY'],
  },
  catalog: {
    source: 'static',
    models: [
      { id: 'Meta-Llama-3.1-405B-Instruct', apiName: 'Meta-Llama-3.1-405B-Instruct', label: 'Llama 3.1 405B', modelDescriptorId: 'llama-3-1-405b' },
      { id: 'Meta-Llama-3.1-70B-Instruct', apiName: 'Meta-Llama-3.1-70B-Instruct', label: 'Llama 3.1 70B', modelDescriptorId: 'llama-3-1-70b' },
      { id: 'DeepSeek-V3-0324', apiName: 'DeepSeek-V3-0324', label: 'DeepSeek V3', modelDescriptorId: 'deepseek-v3' },
    ],
  },
  usage: { supported: false },
})
