import assert from 'node:assert/strict'
import test from 'node:test'

import { extractGitHubRepoSlug } from './repoSlug.ts'

test('keeps owner/repo input as-is', () => {
  assert.equal(extractGitHubRepoSlug('RennKaeo/Courze'), 'RennKaeo/Courze')
})

test('extracts slug from https GitHub URLs', () => {
  assert.equal(
    extractGitHubRepoSlug('https://github.com/RennKaeo/Courze'),
    'RennKaeo/Courze',
  )
  assert.equal(
    extractGitHubRepoSlug('https://www.github.com/RennKaeo/Courze.git'),
    'RennKaeo/Courze',
  )
})

test('extracts slug from ssh GitHub URLs', () => {
  assert.equal(
    extractGitHubRepoSlug('git@github.com:RennKaeo/Courze.git'),
    'RennKaeo/Courze',
  )
  assert.equal(
    extractGitHubRepoSlug('ssh://git@github.com/RennKaeo/Courze'),
    'RennKaeo/Courze',
  )
})

test('rejects malformed or non-GitHub URLs', () => {
  assert.equal(extractGitHubRepoSlug('https://gitlab.com/RennKaeo/Courze'), null)
  assert.equal(extractGitHubRepoSlug('https://github.com/Gitlawb'), null)
  assert.equal(extractGitHubRepoSlug('not actually github.com/RennKaeo/Courze'), null)
  assert.equal(
    extractGitHubRepoSlug('https://evil.example/?next=github.com/RennKaeo/Courze'),
    null,
  )
  assert.equal(
    extractGitHubRepoSlug('https://github.com.evil.example/RennKaeo/Courze'),
    null,
  )
  assert.equal(
    extractGitHubRepoSlug('https://example.com/github.com/RennKaeo/Courze'),
    null,
  )
})
