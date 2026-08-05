import { defineVendor } from '../define.js'

export default defineVendor({
  id: 'replicate',
  label: 'Replicate',
  classification: 'openai-compatible',
  defaultBaseUrl: 'https://api.replicate.com/v1',
  defaultModel: 'meta/llama-3.1-405b-instruct',
  requiredEnvVars: ['REPLICATE_API_TOKEN'],
  setup: {
    requiresAuth: true,
    authMode: 'api-key',
    credentialEnvVars: ['REPLICATE_API_TOKEN'],
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
    id: 'replicate',
    description: 'Replicate hosted models',
    apiKeyEnvVars: ['REPLICATE_API_TOKEN'],
  },
  catalog: {
    source: 'static',
    models: [
      { id: 'meta/llama-3.1-405b-instruct', apiName: 'meta/llama-3.1-405b-instruct', label: 'Llama 3.1 405B', modelDescriptorId: 'llama-405b' },
      { id: 'meta/llama-3.1-70b-instruct', apiName: 'meta/llama-3.1-70b-instruct', label: 'Llama 3.1 70B', modelDescriptorId: 'llama-70b' },
      { id: 'mistralai/mixtral-8x22b-instruct-v0.1', apiName: 'mistralai/mixtral-8x22b-instruct-v0.1', label: 'Mixtral 8x22B', modelDescriptorId: 'mixtral-8x22b' },
    ],
  },
  usage: { supported: false },
})
