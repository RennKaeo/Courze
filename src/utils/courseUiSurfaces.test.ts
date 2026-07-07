import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { homedir } from 'os'
import { join } from 'path'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'

import { isInGlobalClaudeFolder } from '../components/permissions/FilePermissionDialog/permissionOptions.tsx'
import { getDisplayPath } from './file.ts'
import { getDefaultPermissionModeOptions } from './permissions/defaultPermissionModeOptions.ts'
import {
  getClaudeSkillScope,
  isClaudeSettingsPath,
} from './permissions/filesystem.ts'
import { getValidationTip } from './settings/validationTips.ts'

const originalConfigDir = process.env.COURSE_CONFIG_DIR
const originalCourseCodeConfigDir = process.env.COURSE_CONFIG_DIR

beforeEach(async () => {
  await acquireSharedMutationLock('courseUiSurfaces.test.ts')
  mock.restore()
  delete process.env.COURSE_CONFIG_DIR
  delete process.env.COURSE_CONFIG_DIR
})

afterEach(() => {
  try {
    if (originalConfigDir === undefined) {
      delete process.env.COURSE_CONFIG_DIR
    } else {
      process.env.COURSE_CONFIG_DIR = originalConfigDir
    }
    if (originalCourseCodeConfigDir === undefined) {
      delete process.env.COURSE_CONFIG_DIR
    } else {
      process.env.COURSE_CONFIG_DIR = originalCourseCodeConfigDir
    }
  } finally {
    releaseSharedMutationLock()
  }
})

describe('Course Code settings path surfaces', () => {
  test('isClaudeSettingsPath recognizes project .course settings files', () => {
    expect(
      isClaudeSettingsPath(
        join(process.cwd(), '.course', 'settings.json'),
      ),
    ).toBe(true)

    expect(
      isClaudeSettingsPath(
        join(process.cwd(), '.course', 'settings.local.json'),
      ),
    ).toBe(true)
  })

  test('permission save destinations point user settings to configured COURSE_CONFIG_DIR', async () => {
    const customConfigDir = join(homedir(), 'custom-course')
    process.env.COURSE_CONFIG_DIR = customConfigDir
    delete process.env.COURSE_CONFIG_DIR
    const { optionForPermissionSaveDestination } = await import(
      '../components/permissions/rules/AddPermissionRules.tsx'
    )

    expect(optionForPermissionSaveDestination('userSettings')).toEqual({
      label: 'User settings',
      description: `Saved in ${getDisplayPath(join(customConfigDir, 'settings.json'))}`,
      value: 'userSettings',
    })
  })

  test('skills help surfaces point user skills to configured COURSE_CONFIG_DIR', async () => {
    const customConfigDir = join(homedir(), 'custom-course')
    process.env.COURSE_CONFIG_DIR = customConfigDir
    delete process.env.COURSE_CONFIG_DIR
    const { getEmptySkillsMenuMessage } = await import(
      '../components/skills/SkillsMenu.tsx'
    )
    const { getCustomCommandsTipContent } = await import(
      '../services/tips/tipRegistry.ts'
    )
    const customSkillPath = getDisplayPath(
      join(customConfigDir, 'skills', '<name>', 'SKILL.md'),
    )

    expect(getEmptySkillsMenuMessage()).toContain(customSkillPath)
    expect(getCustomCommandsTipContent()).toContain(customSkillPath)
  })

  test('permission save destinations point project settings to .course', async () => {
    const { optionForPermissionSaveDestination } = await import(
      '../components/permissions/rules/AddPermissionRules.tsx'
    )

    expect(optionForPermissionSaveDestination('projectSettings')).toEqual({
      label: 'Project settings',
      description: 'Checked in at .course/settings.json',
      value: 'projectSettings',
    })

    expect(optionForPermissionSaveDestination('localSettings')).toEqual({
      label: 'Project settings (local)',
      description: 'Saved in .course/settings.local.json',
      value: 'localSettings',
    })
  })

  test('permission dialog treats ~/.course as the global Claude folder', () => {
    process.env.COURSE_CONFIG_DIR = join(homedir(), '.course')

    expect(
      isInGlobalClaudeFolder(
        join(homedir(), '.course', 'settings.json'),
      ),
    ).toBe(true)
    expect(
      isInGlobalClaudeFolder(join(homedir(), '.claude', 'settings.json')),
    ).toBe(true)
  })

  test('permission dialog does not treat arbitrary COURSE_CONFIG_DIR as the global Claude folder', () => {
    process.env.COURSE_CONFIG_DIR = join(homedir(), 'custom-course')

    expect(
      isInGlobalClaudeFolder(
        join(homedir(), 'custom-course', 'settings.json'),
      ),
    ).toBe(false)
  })

  test('global skill scope recognizes ~/.course and legacy ~/.claude skills', () => {
    process.env.COURSE_CONFIG_DIR = join(homedir(), '.course')

    expect(
      getClaudeSkillScope(
        join(homedir(), '.course', 'skills', 'demo', 'SKILL.md'),
      ),
    ).toEqual({
      skillName: 'demo',
      pattern: '~/.course/skills/demo/**',
    })

    expect(
      getClaudeSkillScope(
        join(homedir(), '.claude', 'skills', 'legacy', 'SKILL.md'),
      ),
    ).toEqual({
      skillName: 'legacy',
      pattern: '~/.claude/skills/legacy/**',
    })
  })

  test('global skill scope does not emit fixed rules for arbitrary COURSE_CONFIG_DIR skills', () => {
    process.env.COURSE_CONFIG_DIR = join(homedir(), 'custom-course')

    expect(
      getClaudeSkillScope(
        join(homedir(), 'custom-course', 'skills', 'demo', 'SKILL.md'),
      ),
    ).toBe(null)
  })
})

describe('Course Code validation tips', () => {
  test('permissions.defaultMode invalid value keeps suggestion but no Claude docs link', () => {
    const tip = getValidationTip({
      path: 'permissions.defaultMode',
      code: 'invalid_value',
      enumValues: [
        'acceptEdits',
        'bypassPermissions',
        'default',
        'dontAsk',
        'fullAccess',
        'plan',
      ],
    })

    expect(tip).toEqual({
      suggestion:
        'Valid modes: "acceptEdits" (ask before file changes), "plan" (analysis only), "bypassPermissions" (auto-accept prompts), "fullAccess" (skip even hard safety-check prompts), or "default" (standard behavior)',
    })
  })
})

describe('Course Code permission mode surfaces', () => {
  test('default permission mode picker excludes dangerous persisted modes', () => {
    const options = getDefaultPermissionModeOptions(true)

    expect(options).not.toContain('bypassPermissions')
    expect(options).not.toContain('fullAccess')
  })
})
