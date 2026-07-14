import { describe, it, expect } from 'bun:test'
import {
  TaskType,
  TaskStatus,
  isTerminalTaskStatus,
  generateTaskId,
  createTaskStateBase,
  TASK_ID_PREFIXES,
} from './Task.js'

describe('Task Types', () => {
  describe('TaskType', () => {
    it('should have all expected task types', () => {
      const expectedTypes: TaskType[] = [
        'local_bash',
        'local_agent',
        'remote_agent',
        'in_process_teammate',
        'local_workflow',
        'monitor_mcp',
        'dream',
      ]
      expect(expectedTypes.length).toBe(7)
    })
  })

  describe('TaskStatus', () => {
    it('should have all expected statuses', () => {
      const expectedStatuses: TaskStatus[] = [
        'pending',
        'running',
        'completed',
        'failed',
        'killed',
      ]
      expect(expectedStatuses.length).toBe(5)
    })
  })

  describe('isTerminalTaskStatus', () => {
    it('should return true for completed', () => {
      expect(isTerminalTaskStatus('completed')).toBe(true)
    })

    it('should return true for failed', () => {
      expect(isTerminalTaskStatus('failed')).toBe(true)
    })

    it('should return true for killed', () => {
      expect(isTerminalTaskStatus('killed')).toBe(true)
    })

    it('should return false for pending', () => {
      expect(isTerminalTaskStatus('pending')).toBe(false)
    })

    it('should return false for running', () => {
      expect(isTerminalTaskStatus('running')).toBe(false)
    })
  })

  describe('generateTaskId', () => {
    it('should generate ID with correct prefix for each type', () => {
      const types: TaskType[] = [
        'local_bash',
        'local_agent',
        'remote_agent',
        'in_process_teammate',
        'local_workflow',
        'monitor_mcp',
        'dream',
      ]

      for (const type of types) {
        const id = generateTaskId(type)
        const expectedPrefix = TASK_ID_PREFIXES[type]
        expect(id.startsWith(expectedPrefix)).toBe(true)
      }
    })

    it('should generate IDs of correct length (prefix + 8 chars)', () => {
      const id = generateTaskId('local_bash')
      expect(id.length).toBe(9) // 'b' + 8 chars
    })

    it('should generate unique IDs', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(generateTaskId('local_bash'))
      }
      expect(ids.size).toBe(100)
    })

    it('should only use alphanumeric lowercase characters after prefix', () => {
      const id = generateTaskId('local_agent')
      const suffix = id.slice(1) // Remove prefix
      expect(suffix).toMatch(/^[0-9a-z]+$/)
    })
  })

  describe('createTaskStateBase', () => {
    it('should create base state with correct defaults', () => {
      const state = createTaskStateBase('test-id', 'local_bash', 'Test task')

      expect(state.id).toBe('test-id')
      expect(state.type).toBe('local_bash')
      expect(state.status).toBe('pending')
      expect(state.description).toBe('Test task')
      expect(state.startTime).toBeGreaterThan(0)
      expect(state.outputFile).toContain('test-id')
      expect(state.outputOffset).toBe(0)
      expect(state.notified).toBe(false)
      expect(state.toolUseId).toBeUndefined()
      expect(state.endTime).toBeUndefined()
      expect(state.totalPausedMs).toBeUndefined()
    })

    it('should include toolUseId when provided', () => {
      const state = createTaskStateBase('test-id', 'local_agent', 'Test task', 'tool-123')
      expect(state.toolUseId).toBe('tool-123')
    })
  })

  describe('TASK_ID_PREFIXES', () => {
    it('should have correct prefixes for all types', () => {
      expect(TASK_ID_PREFIXES.local_bash).toBe('b')
      expect(TASK_ID_PREFIXES.local_agent).toBe('a')
      expect(TASK_ID_PREFIXES.remote_agent).toBe('r')
      expect(TASK_ID_PREFIXES.in_process_teammate).toBe('t')
      expect(TASK_ID_PREFIXES.local_workflow).toBe('w')
      expect(TASK_ID_PREFIXES.monitor_mcp).toBe('m')
      expect(TASK_ID_PREFIXES.dream).toBe('d')
    })

    it('should have prefix for every TaskType', () => {
      const types: TaskType[] = [
        'local_bash',
        'local_agent',
        'remote_agent',
        'in_process_teammate',
        'local_workflow',
        'monitor_mcp',
        'dream',
      ]

      for (const type of types) {
        expect(TASK_ID_PREFIXES[type]).toBeDefined()
        expect(TASK_ID_PREFIXES[type].length).toBe(1)
      }
    })
  })
})