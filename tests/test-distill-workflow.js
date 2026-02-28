import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanupDir, runSpecdev, assertTest } from './helpers.js'

const TEST_DIR = './tests/test-distill-workflow-output'

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (assertTest(condition, msg)) passes++
  else failures++
}

function runCmd(args) {
  return runSpecdev(args)
}

function cleanup() { cleanupDir(TEST_DIR) }

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

const specdev = join(TEST_DIR, '.specdev')
const assignmentDir = join(specdev, 'assignments', '00001_feature_test-a')
mkdirSync(join(assignmentDir, 'capture'), { recursive: true })

// Write a workflow diff capture
writeFileSync(join(assignmentDir, 'capture', 'workflow-diff.md'), `# Workflow Diff — test-a
## What Worked
- TDD approach was effective
## What Didn't
- Brainstorm phase felt too long
`)

// Test 1: Output is valid JSON
console.log('\ndistill workflow — valid JSON output:')
let result = runCmd(['distill', 'workflow', `--target=${TEST_DIR}`])
assert(result.status === 0, 'exits with code 0')
let json
try {
  json = JSON.parse(result.stdout.trim())
  assert(true, 'output is valid JSON')
} catch {
  assert(false, 'output is valid JSON: ' + result.stdout.slice(0, 100))
}

if (json) {
  // Test 2: Has expected fields
  assert(json.status === 'ok', 'status is ok')
  assert(typeof json.scanned === 'number', 'has scanned count')
  assert(typeof json.unprocessed === 'number', 'has unprocessed count')
  assert(Array.isArray(json.suggestions), 'has suggestions array')
  assert(json.knowledge_path !== undefined, 'has knowledge_path')
  assert(Array.isArray(json.existing_knowledge), 'has existing_knowledge array')
  assert(json.existing_knowledge.length === 0, 'existing_knowledge is empty when no feedback files exist')

  // Test 3: Capture diff appears in suggestions
  const captureSuggestion = json.suggestions.find(s => s.source === 'capture-diff')
  assert(captureSuggestion !== undefined, 'capture diff surfaces as suggestion')
  if (captureSuggestion) {
    assert(captureSuggestion.body.includes('TDD approach'), 'suggestion body includes diff content')
  }

  // Test 4: Running again still shows unprocessed (not marked yet)
  result = runCmd(['distill', 'workflow', `--target=${TEST_DIR}`])
  let json2
  try {
    json2 = JSON.parse(result.stdout.trim())
  } catch {
    json2 = null
  }
  assert(json2 !== null, 'second run output is valid JSON')
  if (json2) {
    assert(json2.unprocessed >= 1, 'unprocessed stays until mark-processed is called')
  }

  // Test 5: --assignment scopes output
  const scoped = runCmd(['distill', 'workflow', `--target=${TEST_DIR}`, '--assignment=00001_feature_test-a'])
  let scopedJson = null
  try {
    scopedJson = JSON.parse(scoped.stdout.trim())
  } catch {
    scopedJson = null
  }
  assert(scopedJson !== null, 'scoped output is valid JSON')
  if (scopedJson) {
    assert(scopedJson.scanned === 1, 'scoped output scans one assignment')
  }
} else {
  const remaining = [
    'status is ok',
    'has scanned count',
    'has unprocessed count',
    'has suggestions array',
    'has knowledge_path',
    'has existing_knowledge array',
    'existing_knowledge is empty when no feedback files exist',
    'capture diff surfaces as suggestion',
    'suggestion body includes diff content',
    'second run output is valid JSON',
    'unprocessed stays until mark-processed is called',
    'scoped output is valid JSON',
    'scoped output scans one assignment',
  ]
  for (const msg of remaining) {
    assert(false, `${msg} (skipped — no JSON)`)
  }
}

// Verify ponder is removed
console.log('\nponder removed:')
result = runCmd(['ponder', 'workflow', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'ponder command no longer exists')
assert(
  result.stderr.includes('Unknown command') || result.stdout.includes('Unknown command'),
  'ponder shows unknown command error'
)

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
