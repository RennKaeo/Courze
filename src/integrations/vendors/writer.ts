import { defineVendor } from '../define.js'

export default defineVendor({
  id: 'writer',
  label: 'Writer',
  classification: 'openai-compatible',
  defaultBaseUrl: 'https://api.writer.com/v1',
  defaultModel: 'palmyra-x-004',
  requiredEnvVars: ['WRITER_API_KEY'],
  setup: {
    requiresAuth: true,
    authMode: 'api-key',
    credentialEnvVars: ['WRITER_API_KEY'],
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
    id: 'writer',
    description: 'Writer Palmyra models',
    apiKeyEnvVars: ['WRITER_API_KEY'],
  },
  catalog: {
    source: 'static',
    models: [
      { id: 'palmyra-x-004', apiName: 'palmyra-x-004', label: 'Palmyra X 004', modelDescriptorId: 'palmyra-x-004' },
      { id: 'palmyra-x-003', apiName: 'palmyra-x-003', label: 'Palmyra X 003', modelDescriptorId: 'palmyra-x-003' },
    ],
  },
  usage: { supported: false },
})
