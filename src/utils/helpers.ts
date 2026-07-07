import { open } from 'node:fs/promises'
import { resolve, relative } from 'node:path'

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + '...'
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
}

let counter = 0

export function generateId(): string {
  counter++
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 6)
  const seq = counter.toString(36)
  return `${timestamp}${random}${seq}`
}

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.avif',
  '.zip', '.gz', '.tar', '.bz2', '.xz', '.zst',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.mp3', '.mp4', '.avi', '.mov', '.mkv', '.wav', '.flac', '.ogg',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.o', '.a', '.lib', '.obj',
  '.pyc', '.pyo', '.pyd',
  '.class', '.jar',
  '.DS_Store', '.gitkeep',
])

export function validatePath(targetPath: string, allowedBase?: string): string {
  const resolved = resolve(targetPath)
  const base = allowedBase ? resolve(allowedBase) : process.cwd()
  const rel = relative(base, resolved)
  if (rel.startsWith('..') || (rel === resolved && base !== resolved)) {
    throw new Error(`Path "${targetPath}" is outside the allowed directory "${base}"`)
  }
  return resolved
}

export async function isBinaryFile(filePath: string): Promise<boolean> {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  if (BINARY_EXTENSIONS.has(ext)) return true

  try {
    const handle = await open(filePath, 'r')
    try {
      const buffer = Buffer.alloc(8192)
      const { bytesRead } = await handle.read(buffer, 0, 8192, 0)
      for (let i = 0; i < bytesRead; i++) {
        const byte = buffer[i]
        if (byte === 0) return true
      }
      return false
    } finally {
      await handle.close()
    }
  } catch {
    return false
  }
}
