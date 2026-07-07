import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

const originalEnv = {
  COURSE_CONFIG_DIR: process.env.COURSE_CONFIG_DIR,
  COURSE_CONFIG_DIR: process.env.COURSE_CONFIG_DIR,
  COURSE_CODE_CUSTOM_OAUTH_URL: process.env.COURSE_CODE_CUSTOM_OAUTH_URL,
  USER_TYPE: process.env.USER_TYPE,
}

let tempDir: string

beforeEach(async () => {
  await acquireSharedMutationLock('env.test.ts')
  tempDir = mkdtempSync(join(tmpdir(), 'course-env-test-'))
  delete process.env.COURSE_CONFIG_DIR
  process.env.COURSE_CONFIG_DIR = tempDir
  delete process.env.COURSE_CODE_CUSTOM_OAUTH_URL
  delete process.env.USER_TYPE
})

afterEach(() => {
  try {
    rmSync(tempDir, { recursive: true, force: true })
    if (originalEnv.COURSE_CONFIG_DIR === undefined) {
      delete process.env.COURSE_CONFIG_DIR
    } else {
      process.env.COURSE_CONFIG_DIR = originalEnv.COURSE_CONFIG_DIR
    }
    if (originalEnv.COURSE_CONFIG_DIR === undefined) {
      delete process.env.COURSE_CONFIG_DIR
    } else {
      process.env.COURSE_CONFIG_DIR = originalEnv.COURSE_CONFIG_DIR
    }
    if (originalEnv.COURSE_CODE_CUSTOM_OAUTH_URL === undefined) {
      delete process.env.COURSE_CODE_CUSTOM_OAUTH_URL
    } else {
      process.env.COURSE_CODE_CUSTOM_OAUTH_URL = originalEnv.COURSE_CODE_CUSTOM_OAUTH_URL
    }
    if (originalEnv.USER_TYPE === undefined) {
      delete process.env.USER_TYPE
    } else {
      process.env.USER_TYPE = originalEnv.USER_TYPE
    }
  } finally {
    releaseSharedMutationLock()
  }
})

async function importFreshEnvModule() {
  return import(`./env.js?ts=${Date.now()}-${Math.random()}`)
}

// getGlobalClaudeFile — default path plus explicit override compatibility

test('getGlobalClaudeFile: new install returns .course.json when neither file exists', async () => {
  const { getGlobalClaudeFile } = await importFreshEnvModule()
  expect(getGlobalClaudeFile()).toBe(join(tempDir, '.course.json'))
})

test('getGlobalClaudeFile: explicit config dir keeps .claude.json fallback when only legacy file exists', async () => {
  writeFileSync(join(tempDir, '.claude.json'), '{}')
  const { getGlobalClaudeFile } = await importFreshEnvModule()
  expect(getGlobalClaudeFile()).toBe(join(tempDir, '.claude.json'))
})

test('getGlobalClaudeFile: migrated user uses .course.json when both files exist', async () => {
  writeFileSync(join(tempDir, '.claude.json'), '{}')
  writeFileSync(join(tempDir, '.course.json'), '{}')
  const { getGlobalClaudeFile } = await importFreshEnvModule()
  expect(getGlobalClaudeFile()).toBe(join(tempDir, '.course.json'))
})

test('getGlobalClaudeFile: COURSE_CONFIG_DIR uses preferred config dir', async () => {
  const preferredDir = mkdtempSync(join(tmpdir(), 'course-preferred-env-test-'))
  try {
    process.env.COURSE_CONFIG_DIR = preferredDir
    process.env.COURSE_CONFIG_DIR = tempDir

    const { getGlobalClaudeFile } = await importFreshEnvModule()

    expect(getGlobalClaudeFile()).toBe(join(preferredDir, '.course.json'))
  } finally {
    rmSync(preferredDir, { recursive: true, force: true })
  }
})

test('getGlobalClaudeFile: COURSE_CONFIG_DIR keeps .claude.json fallback when only legacy file exists', async () => {
  const preferredDir = mkdtempSync(join(tmpdir(), 'course-preferred-env-test-'))
  try {
    process.env.COURSE_CONFIG_DIR = preferredDir
    process.env.COURSE_CONFIG_DIR = tempDir
    writeFileSync(join(preferredDir, '.claude.json'), '{}')

    const { getGlobalClaudeFile } = await importFreshEnvModule()

    expect(getGlobalClaudeFile()).toBe(join(preferredDir, '.claude.json'))
  } finally {
    rmSync(preferredDir, { recursive: true, force: true })
  }
})

test('resolveGlobalClaudeFile: failed default migration keeps legacy file when new file is missing', async () => {
  writeFileSync(join(tempDir, '.claude.json'), '{}')
  const { resolveGlobalClaudeFile } = await importFreshEnvModule()

  expect(
    resolveGlobalClaudeFile({
      homeDir: tempDir,
      migrationSucceeded: false,
      existsSync: path => path === join(tempDir, '.claude.json'),
    }),
  ).toBe(join(tempDir, '.claude.json'))
})
