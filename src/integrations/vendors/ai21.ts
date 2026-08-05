import { defineVendor } from '../define.js'

export default defineVendor({
  id: 'ai21',
  label: 'AI21 Labs',
  classification: 'openai-compatible',
  defaultBaseUrl: 'https://api.ai21.com/studio/v1',
  defaultModel: 'jamba-1.5-large',
  requiredEnvVars: ['AI21_API_KEY'],
  setup: {
    requiresAuth: true,
    authMode: 'api-key',
    credentialEnvVars: ['AI21_API_KEY'],
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
    id: 'ai21',
    description: 'AI21 Labs Jamba models',
    apiKeyEnvVars: ['AI21_API_KEY'],
  },
  catalog: {
    source: 'static',
    models: [
      { id: 'jamba-1.5-large', apiName: 'jamba-1.5-large', label: 'Jamba 1.5 Large', modelDescriptorId: 'jamba-large' },
      { id: 'jamba-1.5-mini', apiName: 'jamba-1.5-mini', label: 'Jamba 1.5 Mini', modelDescriptorId: 'jamba-mini' },
      { id: 'jamba-instruct', apiName: 'jamba-instruct', label: 'Jamba Instruct', modelDescriptorId: 'jamba-instruct' },
    ],
  },
  usage: { supported: false },
})
