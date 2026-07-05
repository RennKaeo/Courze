import pc from 'picocolors'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const LEVEL_COLORS: Record<LogLevel, (s: string) => string> = {
  debug: pc.dim,
  info: pc.cyan,
  warn: pc.yellow,
  error: pc.red,
}

function getConfiguredLevel(): LogLevel {
  const env = process.env.DEBUG?.toLowerCase()
  if (env === 'true' || env === '1' || env === 'debug') return 'debug'
  if (env === 'info') return 'info'
  if (env === 'warn') return 'warn'
  if (env === 'error') return 'error'
  return 'info'
}

function timestamp(): string {
  return new Date().toISOString()
}

export class Logger {
  private level: LogLevel

  constructor(level?: LogLevel) {
    this.level = level ?? getConfiguredLevel()
  }

  setLevel(level: LogLevel): void {
    this.level = level
  }

  debug(...args: unknown[]): void {
    this.log('debug', ...args)
  }

  info(...args: unknown[]): void {
    this.log('info', ...args)
  }

  warn(...args: unknown[]): void {
    this.log('warn', ...args)
  }

  error(...args: unknown[]): void {
    this.log('error', ...args)
  }

  private log(level: LogLevel, ...args: unknown[]): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.level]) return
    const color = LEVEL_COLORS[level]
    const prefix = color(`[${timestamp()}] [${level.toUpperCase()}]`)
    const message = args
      .map(a => (typeof a === 'string' ? a : JSON.stringify(a, null, 0)))
      .join(' ')
    if (level === 'error') {
      console.error(prefix, message)
    } else {
      console.log(prefix, message)
    }
  }
}

export const logger = new Logger()
