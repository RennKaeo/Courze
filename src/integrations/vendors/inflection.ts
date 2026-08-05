import { defineVendor } from '../define.js'

export default defineVendor({
  id: 'inflection',
  label: 'Inflection AI',
  classification: 'openai-compatible',
  defaultBaseUrl: 'https://api.inflection.ai/v1',
  defaultModel: 'inflection-3',
  requiredEnvVars: ['INFLECTION_API_KEY'],
  setup: {
    requiresAuth: true,
    authMode: 'api-key',
    credentialEnvVars: ['INFLECTION_API_KEY'],
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
    id: 'inflection',
    description: 'Inflection AI Pi models',
    apiKeyEnvVars: ['INFLECTION_API_KEY'],
  },
  catalog: {
    source: 'static',
    models: [
      { id: 'inflection-3', apiName: 'inflection-3', label: 'Inflection 3', modelDescriptorId: 'inflection-3' },
    ],
  },
  usage: { supported: false },
})
