export class CourseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CourseError'
  }
}

export class ConfigError extends CourseError {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

export class ToolExecutionError extends CourseError {
  public toolName: string
  public exitCode?: number
  public stderr?: string

  constructor(message: string, toolName: string, exitCode?: number, stderr?: string) {
    super(message)
    this.name = 'ToolExecutionError'
    this.toolName = toolName
    this.exitCode = exitCode
    this.stderr = stderr
  }
}

export class LLMError extends CourseError {
  public statusCode?: number
  public retryable: boolean
  public retryAfter?: number

  constructor(
    message: string,
    statusCode?: number,
    retryable: boolean = false,
    retryAfter?: number
  ) {
    super(message)
    this.name = 'LLMError'
    this.statusCode = statusCode
    this.retryable = retryable
    this.retryAfter = retryAfter
  }
}

export class UserInterruptError extends CourseError {
  constructor(message: string = 'Operation cancelled by user') {
    super(message)
    this.name = 'UserInterruptError'
  }
}
