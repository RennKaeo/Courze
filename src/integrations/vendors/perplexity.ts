import { defineVendor } from '../define.js'

export default defineVendor({
  id: 'perplexity',
  label: 'Perplexity',
  classification: 'openai-compatible',
  defaultBaseUrl: 'https://api.perplexity.ai',
  defaultModel: 'llama-3.1-sonar-large-128k-online',
  requiredEnvVars: ['PERPLEXITY_API_KEY'],
  setup: {
    requiresAuth: true,
    authMode: 'api-key',
    credentialEnvVars: ['PERPLEXITY_API_KEY'],
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
    id: 'perplexity',
    description: 'Perplexity search-augmented models',
    apiKeyEnvVars: ['PERPLEXITY_API_KEY'],
  },
  catalog: {
    source: 'static',
    models: [
      { id: 'llama-3.1-sonar-large-128k-online', apiName: 'llama-3.1-sonar-large-128k-online', label: 'Sonar Large Online', modelDescriptorId: 'sonar-large' },
      { id: 'llama-3.1-sonar-small-128k-online', apiName: 'llama-3.1-sonar-small-128k-online', label: 'Sonar Small Online', modelDescriptorId: 'sonar-small' },
      { id: 'llama-3.1-sonar-large-128k-chat', apiName: 'llama-3.1-sonar-large-128k-chat', label: 'Sonar Large Chat', modelDescriptorId: 'sonar-large-chat' },
    ],
  },
  usage: { supported: false },
})
