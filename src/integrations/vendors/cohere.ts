import { defineVendor } from '../define.js'

export default defineVendor({
  id: 'cohere',
  label: 'Cohere',
  classification: 'openai-compatible',
  defaultBaseUrl: 'https://api.cohere.com/v2',
  defaultModel: 'command-r-plus',
  requiredEnvVars: ['COHERE_API_KEY'],
  setup: {
    requiresAuth: true,
    authMode: 'api-key',
    credentialEnvVars: ['COHERE_API_KEY'],
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
    id: 'cohere',
    description: 'Cohere Command models',
    apiKeyEnvVars: ['COHERE_API_KEY'],
  },
  catalog: {
    source: 'static',
    models: [
      { id: 'command-r-plus', apiName: 'command-r-plus', label: 'Command R+', modelDescriptorId: 'command-r-plus' },
      { id: 'command-r', apiName: 'command-r', label: 'Command R', modelDescriptorId: 'command-r' },
      { id: 'command-light', apiName: 'command-light', label: 'Command Light', modelDescriptorId: 'command-light' },
    ],
  },
  usage: { supported: false },
})
