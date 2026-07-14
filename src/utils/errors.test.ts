import { describe, it, expect } from 'bun:test'
import {
  TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  toError,
  errorMessage,
  getErrnoCode,
  isENOENT,
  getErrnoPath,
  shortErrorStack,
  hasExactErrorMessage,
} from './errors.js'
import { ShellError } from './errors.js'
import type { AbortReason } from './abortReasons.js'

describe('Error Hierarchy', () => {
  describe('TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS', () => {
    it('should create error with single message', () => {
      const error = new TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS('Test error')
      expect(error.message).toBe('Test error')
      expect(error.name).toBe('TelemetrySafeError')
      expect(error.telemetryMessage).toBe('Test error')
    })

    it('should create error with separate telemetry message', () => {
      const error = new TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS(
        'Full error with file path /home/user/file.txt',
        'Error occurred' // telemetry-safe message
      )
      expect(error.message).toBe('Full error with file path /home/user/file.txt')
      expect(error.telemetryMessage).toBe('Error occurred')
    })

    it('should be instance of Error', () => {
      const error = new TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS('Test')
      expect(error instanceof Error).toBe(true)
    })
  })

  describe('toError', () => {
    it('should return Error instance as-is', () => {
      const original = new Error('Original error')
      const result = toError(original)
      expect(result).toBe(original)
    })

    it('should convert string to Error', () => {
      const result = toError('String error')
      expect(result).toBeInstanceOf(Error)
      expect(result.message).toBe('String error')
    })

    it('should convert null to Error', () => {
      const result = toError(null)
      expect(result).toBeInstanceOf(Error)
      expect(result.message).toBe('null')
    })

    it('should convert object to Error', () => {
      const result = toError({ code: 'ENOENT' })
      expect(result).toBeInstanceOf(Error)
      expect(result.message).toBe('[object Object]')
    })
  })

  describe('errorMessage', () => {
    it('should return message from Error', () => {
      const error = new Error('Test error message')
      expect(errorMessage(error)).toBe('Test error message')
    })

    it('should convert non-Error to string', () => {
      expect(errorMessage('string error')).toBe('string error')
      expect(errorMessage(42)).toBe('42')
      expect(errorMessage({ foo: 'bar' })).toBe('[object Object]')
    })
  })

  describe('getErrnoCode', () => {
    it('should extract errno code from NodeJS error', () => {
      const error = new Error('File not found') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      expect(getErrnoCode(error)).toBe('ENOENT')
    })

    it('should return undefined for error without code', () => {
      const error = new Error('Generic error')
      expect(getErrnoCode(error)).toBeUndefined()
    })

    it('should return undefined for non-object', () => {
      expect(getErrnoCode('string')).toBeUndefined()
      expect(getErrnoCode(null)).toBeUndefined()
      expect(getErrnoCode(42)).toBeUndefined()
    })
  })

  describe('isENOENT', () => {
    it('should return true for ENOENT error', () => {
      const error = new Error('File not found') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      expect(isENOENT(error)).toBe(true)
    })

    it('should return false for other errors', () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException
      error.code = 'EACCES'
      expect(isENOENT(error)).toBe(false)
    })

    it('should return false for errors without code', () => {
      const error = new Error('Generic error')
      expect(isENOENT(error)).toBe(false)
    })
  })

  describe('getErrnoPath', () => {
    it('should extract path from NodeJS error', () => {
      const error = new Error('File not found') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      error.path = '/home/user/missing.txt'
      expect(getErrnoPath(error)).toBe('/home/user/missing.txt')
    })

    it('should return undefined for error without path', () => {
      const error = new Error('Generic error')
      expect(getErrnoPath(error)).toBeUndefined()
    })
  })

  describe('shortErrorStack', () => {
    it('should return message for non-Error', () => {
      expect(shortErrorStack('string error')).toBe('string error')
      expect(shortErrorStack(42)).toBe('42')
    })

    it('should return message for Error without stack', () => {
      const error = new Error('No stack')
      // Remove stack if present
      delete (error as any).stack
      expect(shortErrorStack(error)).toBe('No stack')
    })

    it('should limit stack frames', () => {
      const error = new Error('Test error')
      error.stack = `Error: Test error
    at frame1 (test.js:1)
    at frame2 (test.js:2)
    at frame3 (test.js:3)
    at frame4 (test.js:4)
    at frame5 (test.js:5)
    at frame6 (test.js:6)
    at frame7 (test.js:7)`

      const result = shortErrorStack(error, 3)
      const lines = result.split('\n')
      // Header + 3 frames = 4 lines
      expect(lines.length).toBe(4)
      expect(lines[0]).toContain('Test error')
      expect(lines[1]).toContain('frame1')
      expect(lines[3]).toContain('frame3')
    })

    it('should return full stack if fewer frames than max', () => {
      const error = new Error('Test error')
      error.stack = `Error: Test error
    at frame1 (test.js:1)
    at frame2 (test.js:2)`

      const result = shortErrorStack(error, 5)
      expect(result).toBe(error.stack)
    })
  })

  describe('hasExactErrorMessage', () => {
    it('should return true for exact match', () => {
      const error = new Error('Exact message')
      expect(hasExactErrorMessage(error, 'Exact message')).toBe(true)
    })

    it('should return false for different message', () => {
      const error = new Error('Different message')
      expect(hasExactErrorMessage(error, 'Exact message')).toBe(false)
    })

    it('should return false for non-Error', () => {
      expect(hasExactErrorMessage('string', 'string')).toBe(false)
      expect(hasExactErrorMessage(null, 'message')).toBe(false)
    })
  })

  describe('ShellError', () => {
    it('should create error with stdout, stderr, and code', () => {
      const error = new ShellError('stdout output', 'stderr output', 1, false)
      expect(error.stdout).toBe('stdout output')
      expect(error.stderr).toBe('stderr output')
      expect(error.code).toBe(1)
      expect(error.interrupted).toBe(false)
      expect(error.name).toBe('ShellError')
    })

    it('should handle abort options', () => {
      const error = new ShellError('', '', 130, true, {
        abortReason: 'SIGTERM' as AbortReason,
        abortMessage: 'Process terminated',
        isAbort: true,
      })
      expect(error.abortReason).toBe('SIGTERM')
      expect(error.abortMessage).toBe('Process terminated')
      expect(error.isAbort).toBe(true)
    })

    it('should default isAbort based on abortReason and interrupted', () => {
      const error1 = new ShellError('', '', 1, true, { abortReason: 'SIGTERM' as AbortReason })
      expect(error1.isAbort).toBe(true)

      const error2 = new ShellError('', '', 1, true, { abortReason: undefined })
      expect(error2.isAbort).toBe(false)

      const error3 = new ShellError('', '', 1, false, { abortReason: 'SIGTERM' as AbortReason })
      expect(error3.isAbort).toBe(false)
    })
  })
})