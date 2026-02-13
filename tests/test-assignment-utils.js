import { strict as assert } from 'assert'
import { parseAssignmentId, formatStatus, timeSince, assignmentName } from '../src/utils/assignment.js'

const tests = []
let passed = 0
let failed = 0

tests.push({
  name: 'parseAssignmentId parses standard format',
  fn: () => {
    const result = parseAssignmentId('00001_feature_auth')
    assert.equal(result.id, '00001')
    assert.equal(result.type, 'feature')
    assert.equal(result.label, 'auth')
  }
})

tests.push({
  name: 'parseAssignmentId handles compound labels',
  fn: () => {
    const result = parseAssignmentId('00002_bugfix_login-page')
    assert.equal(result.id, '00002')
    assert.equal(result.type, 'bugfix')
    assert.equal(result.label, 'login-page')
  }
})

tests.push({
  name: 'parseAssignmentId returns null fields for non-standard names',
  fn: () => {
    const result = parseAssignmentId('random-folder')
    assert.equal(result.id, null)
    assert.equal(result.type, null)
    assert.equal(result.label, 'random-folder')
  }
})

tests.push({
  name: 'formatStatus returns icons for known statuses',
  fn: () => {
    assert(formatStatus('pending').includes('pending'))
    assert(formatStatus('in_progress').includes('in_progress'))
    assert(formatStatus('passed').includes('passed'))
    assert(formatStatus('failed').includes('failed'))
    assert(formatStatus('awaiting_approval').includes('awaiting_approval'))
  }
})

tests.push({
  name: 'formatStatus returns raw string for unknown status',
  fn: () => {
    assert.equal(formatStatus('unknown_thing'), 'unknown_thing')
  }
})

tests.push({
  name: 'timeSince returns human-readable duration',
  fn: () => {
    const now = new Date()
    const thirtySecsAgo = new Date(now - 30000).toISOString()
    const fiveMinsAgo = new Date(now - 300000).toISOString()
    const twoHoursAgo = new Date(now - 7200000).toISOString()

    assert(timeSince(thirtySecsAgo).endsWith('s ago'))
    assert(timeSince(fiveMinsAgo).endsWith('m ago'))
    assert(timeSince(twoHoursAgo).endsWith('h ago'))
  }
})

tests.push({
  name: 'assignmentName extracts directory name from path',
  fn: () => {
    assert.equal(assignmentName('/foo/bar/00001_feature_auth'), '00001_feature_auth')
    assert.equal(assignmentName('C:\\foo\\bar\\00001_feature_auth'), '00001_feature_auth')
  }
})

for (const test of tests) {
  try {
    await test.fn()
    passed++
    console.log(`  \u2705 ${test.name}`)
  } catch (err) {
    failed++
    console.log(`  \u274c ${test.name}: ${err.message}`)
  }
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
