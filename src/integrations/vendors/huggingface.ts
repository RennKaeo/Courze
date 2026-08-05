import { defineVendor } from '../define.js'

export default defineVendor({
  id: 'huggingface',
  label: 'HuggingFace',
  classification: 'openai-compatible',
  defaultBaseUrl: 'https://api-inference.huggingface.co/v1',
  defaultModel: 'meta-llama/Llama-3.1-405B-Instruct',
  requiredEnvVars: ['HUGGINGFACE_API_KEY'],
  setup: {
    requiresAuth: true,
    authMode: 'api-key',
    credentialEnvVars: ['HUGGINGFACE_API_KEY'],
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
    id: 'huggingface',
    description: 'HuggingFace Inference API',
    apiKeyEnvVars: ['HUGGINGFACE_API_KEY'],
  },
  catalog: {
    source: 'static',
    models: [
      { id: 'meta-llama/Llama-3.1-405B-Instruct', apiName: 'meta-llama/Llama-3.1-405B-Instruct', label: 'Llama 3.1 405B', modelDescriptorId: 'llama-405b' },
      { id: 'mistralai/Mixtral-8x22B-Instruct-v0.1', apiName: 'mistralai/Mixtral-8x22B-Instruct-v0.1', label: 'Mixtral 8x22B', modelDescriptorId: 'mixtral-8x22b' },
      { id: 'Qwen/Qwen2.5-72B-Instruct', apiName: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen 2.5 72B', modelDescriptorId: 'qwen-72b' },
    ],
  },
  usage: { supported: false },
})
