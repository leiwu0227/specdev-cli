import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanupDir, runSpecdev, assertTest, createMockToolSkill } from './helpers.js'

const TEST_DIR = './tests/test-context-output'
let failures = 0
let passes = 0

function assert(condition, msg, detail = '') {
  if (assertTest(condition, msg, detail)) passes++
  else failures++
}

function runCmd(args) {
  return runSpecdev(args)
}

function cleanup() { cleanupDir(TEST_DIR) }

function writeFixture() {
  cleanup()
  runCmd(['init', `--target=${TEST_DIR}`])

  const specdev = join(TEST_DIR, '.specdev')

  writeFileSync(join(specdev, 'project_notes', 'big_picture.md'), [
    '# Project Big Picture',
    '',
    'A test project for context command.',
    '',
  ].join('\n'), 'utf-8')

  mkdirSync(join(specdev, 'knowledge', 'architecture'), { recursive: true })
  writeFileSync(join(specdev, 'knowledge', 'architecture', 'test-note.md'), [
    '# Test Architecture Note',
    '',
    'Some architecture knowledge.',
    '',
  ].join('\n'), 'utf-8')

  mkdirSync(join(specdev, 'knowledge', 'workflow_feedback'), { recursive: true })
  writeFileSync(join(specdev, 'knowledge', 'workflow_feedback', 'feedback-note.md'), [
    '# Feedback Note',
    '',
    'Some workflow feedback.',
    '',
  ].join('\n'), 'utf-8')

  const assignmentPath = join(specdev, 'assignments', '00001_feature_test-feature')
  mkdirSync(join(assignmentPath, 'brainstorm'), { recursive: true })
  writeFileSync(join(assignmentPath, 'brainstorm', 'proposal.md'), '# Proposal\n\nTest proposal.\n')
  writeFileSync(join(assignmentPath, 'brainstorm', 'design.md'), '# Design\n\nTest design.\n')
  writeFileSync(join(specdev, '.current'), '00001_feature_test-feature')

  createMockToolSkill(TEST_DIR, 'mock-tool')
}

writeFixture()

// --- context --json ---
console.log('\ncontext --json:')
let result = runCmd(['context', `--target=${TEST_DIR}`, '--json'])
assert(result.status === 0, 'context --json exits 0', result.stderr || result.stdout)
let json = null
try {
  json = JSON.parse(result.stdout)
  assert(true, 'context --json outputs valid JSON')
} catch {
  assert(false, 'context --json outputs valid JSON', result.stdout)
}
assert(json?.command === 'context', 'json command identifies context')
assert(json?.version === 1, 'json version is 1')
assert(typeof json?.cli_version === 'string', 'json has cli_version string')

// commands
assert(Array.isArray(json?.commands), 'json has commands array')
assert(json?.commands?.length > 0, 'commands array is non-empty')
const firstCmd = json?.commands?.[0]
assert(typeof firstCmd?.name === 'string', 'command entry has name')
assert(typeof firstCmd?.usage === 'string', 'command entry has usage')
assert(typeof firstCmd?.description === 'string', 'command entry has description')

// assignment
assert(typeof json?.assignment === 'object' && json?.assignment !== null, 'json has assignment object')
assert(json?.assignment?.name === '00001_feature_test-feature', 'assignment name is correct')
assert(typeof json?.assignment?.state === 'string', 'assignment has state')

// knowledge
assert(typeof json?.knowledge === 'object', 'json has knowledge object')
assert(Array.isArray(json?.knowledge?.files), 'knowledge has files array')
assert(json?.knowledge?.files?.length >= 2, 'knowledge has at least 2 files')
const archFile = json?.knowledge?.files?.find(f => f.branch === 'architecture')
assert(archFile !== undefined, 'knowledge includes architecture file')
assert(typeof archFile?.title === 'string', 'knowledge file has title')
assert(typeof archFile?.path === 'string', 'knowledge file has path')
assert(typeof json?.knowledge?.index_exists === 'boolean', 'knowledge has index_exists boolean')

// project_notes
assert(Array.isArray(json?.project_notes), 'json has project_notes array')
assert(json?.project_notes?.some(p => p.includes('big_picture.md')), 'project_notes includes big_picture.md')

// skills
assert(typeof json?.skills === 'object', 'json has skills object')
assert(Array.isArray(json?.skills?.core), 'skills has core array')
assert(json?.skills?.core?.length > 0, 'core skills is non-empty')
assert(Array.isArray(json?.skills?.tools), 'skills has tools array')
assert(json?.skills?.tools?.some(s => s === 'mock-tool'), 'tools includes mock-tool')

// --- context human output ---
console.log('\ncontext human output:')
result = runCmd(['context', `--target=${TEST_DIR}`])
assert(result.status === 0, 'context human exits 0', result.stderr || result.stdout)
assert(result.stdout.includes('Assignment'), 'human output contains Assignment section')
assert(result.stdout.includes('Commands'), 'human output contains Commands section')
assert(result.stdout.includes('Knowledge'), 'human output contains Knowledge section')
assert(result.stdout.includes('Skills'), 'human output contains Skills section')

// --- context with no assignment ---
console.log('\ncontext no assignment:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
writeFileSync(join(TEST_DIR, '.specdev', 'project_notes', 'big_picture.md'), '# Big Picture\n\nTest.\n')
result = runCmd(['context', `--target=${TEST_DIR}`, '--json'])
assert(result.status === 0, 'context with no assignment exits 0', result.stderr || result.stdout)
try {
  json = JSON.parse(result.stdout)
  assert(true, 'no-assignment json is valid')
} catch {
  assert(false, 'no-assignment json is valid', result.stdout)
}
assert(json?.assignment === null, 'assignment is null when none set')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
