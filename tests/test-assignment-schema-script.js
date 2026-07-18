import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT = join(__dirname, '..', 'scripts', 'verify-assignment-schema.js')
const TEST_DIR = join(__dirname, 'test-assignment-schema-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) {
    console.error(`  ❌ ${msg}`)
    failures++
  } else {
    console.log(`  ✓ ${msg}`)
    passes++
  }
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

function runSchemaCheck(path) {
  return spawnSync('node', [SCRIPT, path], { encoding: 'utf-8' })
}

function setupValidReviewPhase() {
  const assignment = join(TEST_DIR, '00001_feature_auth')
  mkdirSync(join(assignment, 'brainstorm'), { recursive: true })
  mkdirSync(join(assignment, 'breakdown'), { recursive: true })
  mkdirSync(join(assignment, 'implementation'), { recursive: true })
  mkdirSync(join(assignment, 'context'), { recursive: true })

  writeFileSync(join(assignment, 'brainstorm', 'design.md'), '# Design\n')
  writeFileSync(join(assignment, 'breakdown', 'plan.md'), '# Plan\n')
  writeFileSync(join(assignment, 'implementation', 'progress.json'), '{}\n')
  writeFileSync(join(assignment, 'review_report.md'), '# Review Report\n')

  return assignment
}

function setupPartialBrainstormPhase() {
  const assignment = join(TEST_DIR, '00002_feature_partial')
  mkdirSync(join(assignment, 'brainstorm'), { recursive: true })
  mkdirSync(join(assignment, 'context'), { recursive: true })
  writeFileSync(join(assignment, 'brainstorm', 'proposal.md'), '# Proposal\n')
  return assignment
}

function setupInvalidMissingContext() {
  const assignment = join(TEST_DIR, '00003_feature_invalid')
  mkdirSync(join(assignment, 'brainstorm'), { recursive: true })
  writeFileSync(join(assignment, 'brainstorm', 'design.md'), '# Design\n')
  return assignment
}

cleanup()
mkdirSync(TEST_DIR, { recursive: true })

console.log('\nvalid review-phase assignment:')
let assignmentPath = setupValidReviewPhase()
let result = runSchemaCheck(assignmentPath)
assert(result.status === 0, 'schema check exits 0 for valid review-phase structure')
assert(result.stdout.includes('Schema checks passed'), 'reports schema checks passed')

console.log('\npartial brainstorm assignment:')
assignmentPath = setupPartialBrainstormPhase()
result = runSchemaCheck(assignmentPath)
assert(result.status === 0, 'schema check exits 0 for valid early-phase structure')
assert(result.stdout.includes('brainstorm artifacts satisfy "any" rule'), 'accepts brainstorm any-rule')

console.log('\ninvalid assignment (missing required dir):')
assignmentPath = setupInvalidMissingContext()
result = runSchemaCheck(assignmentPath)
assert(result.status !== 0, 'schema check exits non-zero when required directory is missing')
assert(result.stdout.includes('context/ missing'), 'reports missing required context directory')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)

