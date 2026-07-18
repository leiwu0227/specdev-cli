import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanupDir, runSpecdev, assertTest } from './helpers.js'

const TEST_DIR = './tests/test-distill-project-output'

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
const assignmentDir = join(specdev, 'assignments', '00001_feature_test-proj')
mkdirSync(join(assignmentDir, 'capture'), { recursive: true })
mkdirSync(join(assignmentDir, 'context'), { recursive: true })

// Write a project-notes diff capture
writeFileSync(join(assignmentDir, 'capture', 'project-notes-diff.md'), `# Project Notes Diff
## Gaps Found
- big_picture.md should mention the new auth system
`)

// Write decisions
writeFileSync(join(assignmentDir, 'context', 'decisions.md'), `# Decisions
- Chose JWT over session cookies for stateless auth
`)

// Test 1: Output is valid JSON with expected fields
console.log('\ndistill project — valid JSON output:')
let result = runCmd(['distill', 'project', `--target=${TEST_DIR}`])
assert(result.status === 0, 'exits with code 0')
let json
try {
  json = JSON.parse(result.stdout.trim())
  assert(true, 'output is valid JSON')
} catch {
  assert(false, 'output is valid JSON: ' + result.stdout.slice(0, 100))
}

if (json) {
  // Test 2: Has expected schema
  assert(json.status === 'ok', 'status is ok')
  assert(typeof json.scanned === 'number', 'has scanned count')
  assert(typeof json.unprocessed === 'number', 'has unprocessed count')
  assert(typeof json.existing_knowledge === 'object', 'has existing_knowledge')
  assert(Array.isArray(json.suggestions), 'has suggestions array')
  assert(typeof json.knowledge_paths === 'object', 'has knowledge_paths')

  // Test 3: Capture diff appears in suggestions with branch
  const captureSuggestion = json.suggestions.find(s => s.source === 'capture-diff')
  assert(captureSuggestion !== undefined, 'capture diff surfaces as suggestion')
  if (captureSuggestion) {
    assert(captureSuggestion.branch !== undefined, 'capture suggestion has branch field')
    assert(captureSuggestion.body.includes('auth system'), 'suggestion body includes diff content')
  }

  // Test 4: existing_knowledge has all four branches
  const branches = ['codestyle', 'architecture', 'domain', 'workflow']
  for (const b of branches) {
    assert(Array.isArray(json.existing_knowledge[b]), `existing_knowledge has ${b} branch`)
  }

  // Test 5: --assignment scopes output
  const scoped = runCmd(['distill', 'project', `--target=${TEST_DIR}`, '--assignment=00001_feature_test-proj'])
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
  // If JSON parsing failed, count remaining assertions as failures
  const remaining = ['status is ok', 'has scanned count', 'has unprocessed count',
    'has existing_knowledge', 'has suggestions array', 'has knowledge_paths',
    'capture diff surfaces as suggestion', 'capture suggestion has branch field',
    'suggestion body includes diff content',
    'existing_knowledge has codestyle branch', 'existing_knowledge has architecture branch',
    'existing_knowledge has domain branch', 'existing_knowledge has workflow branch',
    'scoped output is valid JSON', 'scoped output scans one assignment']
  for (const msg of remaining) {
    assert(false, msg + ' (skipped — no JSON)')
  }
}

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
