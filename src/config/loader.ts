import Conf from 'conf'
import { readFile, access, writeFile } from 'node:fs/promises'
import { join, resolve, isAbsolute } from 'node:path'
import { ConfigSchema, type CourseConfig } from './schema.js'

const GLOBAL_CONFIG_KEYS = ['provider', 'model', 'mode', 'temperature', 'maxTokens', 'apiKeys', 'systemPrompt'] as const

function parseJSON5(text: string): Record<string, unknown> {
  const stripped = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  try {
    return JSON.parse(stripped)
  } catch {
    return JSON.parse(stripped
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/(['"])?([a-zA-Z_$][\w$]*)(['"])?\s*:/g, '"$2":')
    )
  }
}

async function tryReadJSON(path: string): Promise<Record<string, unknown> | null> {
  try {
    await access(path)
    const raw = await readFile(path, 'utf-8')
    return parseJSON5(raw)
  } catch {
    return null
  }
}

function getGlobalConfig(): Record<string, unknown> {
  const conf = new Conf({ projectName: 'courze' })
  const result: Record<string, unknown> = {}
  for (const key of GLOBAL_CONFIG_KEYS) {
    const val = conf.get(key)
    if (val !== undefined) result[key] = val
  }
  return result
}

export function getDefaultConfig(): CourseConfig {
  return ConfigSchema.parse({}) as CourseConfig
}

export async function loadConfig(path?: string, overrides?: Partial<CourseConfig>): Promise<CourseConfig> {
  const defaults = getDefaultConfig()
  const global = getGlobalConfig()

  let project: Record<string, unknown> = {}
  if (path) {
    const resolved = isAbsolute(path) ? path : resolve(process.cwd(), path)
    const candidate = join(resolved, '.courzerc.jsonc')
    const direct = resolved.endsWith('.jsonc') ? resolved : candidate
    const found = await tryReadJSON(direct)
    if (found) project = found
  } else {
    const local = await tryReadJSON(join(process.cwd(), '.courzerc.jsonc'))
    if (local) project = local
  }

  const merged = { ...defaults, ...global, ...project, ...(overrides ?? {}) }
  return ConfigSchema.parse(merged) as CourseConfig
}

export async function saveConfig(config: Partial<CourseConfig>, path?: string): Promise<void> {
  if (path) {
    const resolved = isAbsolute(path) ? path : join(process.cwd(), path, '.courzerc.jsonc')
    const data = JSON.stringify(config, null, 2)
    await writeFile(resolved, data, 'utf-8')
  }
}