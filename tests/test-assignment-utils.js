import { strict as assert } from 'assert'
import { mkdtempSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  parseAssignmentId,
  assignmentName,
  resolveAssignmentSelector,
} from '../src/utils/assignment.js'

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
  name: 'assignmentName extracts directory name from path',
  fn: () => {
    assert.equal(assignmentName('/foo/bar/00001_feature_auth'), '00001_feature_auth')
    assert.equal(assignmentName('C:\\foo\\bar\\00001_feature_auth'), '00001_feature_auth')
  }
})

tests.push({
  name: 'resolveAssignmentSelector resolves explicit assignment name',
  fn: async () => {
    const root = mkdtempSync(join(tmpdir(), 'specdev-assignment-utils-'))
    try {
      const specdevPath = join(root, '.specdev')
      const assignments = join(specdevPath, 'assignments')
      mkdirSync(join(assignments, '00001_feature_auth'), { recursive: true })

      const result = await resolveAssignmentSelector(specdevPath, '00001_feature_auth')
      assert.ok(result)
      assert.equal(result.name, '00001_feature_auth')
      assert.equal(result.path, join(assignments, '00001_feature_auth'))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
})

tests.push({
  name: 'resolveAssignmentSelector resolves numeric shorthand',
  fn: async () => {
    const root = mkdtempSync(join(tmpdir(), 'specdev-assignment-utils-'))
    try {
      const specdevPath = join(root, '.specdev')
      const assignments = join(specdevPath, 'assignments')
      mkdirSync(join(assignments, '00001_feature_auth'), { recursive: true })

      const result = await resolveAssignmentSelector(specdevPath, '1')
      assert.ok(result)
      assert.equal(result.name, '00001_feature_auth')
      assert.equal(result.path, join(assignments, '00001_feature_auth'))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
})

tests.push({
  name: 'resolveAssignmentSelector reports ambiguous numeric shorthand',
  fn: async () => {
    const root = mkdtempSync(join(tmpdir(), 'specdev-assignment-utils-'))
    try {
      const specdevPath = join(root, '.specdev')
      const assignments = join(specdevPath, 'assignments')
      mkdirSync(join(assignments, '001_feature_auth'), { recursive: true })
      mkdirSync(join(assignments, '0001_bugfix_login'), { recursive: true })

      const result = await resolveAssignmentSelector(specdevPath, '1')
      assert.ok(result)
      assert.equal(result.ambiguous, true)
      assert.deepEqual(
        new Set(result.matches),
        new Set(['001_feature_auth', '0001_bugfix_login'])
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
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
