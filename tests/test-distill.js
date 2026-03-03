import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanupDir, runSpecdev, assertTest } from './helpers.js'

const TEST_DIR = './tests/test-distill-output'

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

// =====================================================================
// Distill Workflow
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

const specdev = join(TEST_DIR, '.specdev')
const assignmentDir = join(specdev, 'assignments', '00001_feature_test-a')
mkdirSync(join(assignmentDir, 'capture'), { recursive: true })

writeFileSync(join(assignmentDir, 'capture', 'workflow-diff.md'), `# Workflow Diff — test-a
## What Worked
- TDD approach was effective
## What Didn't
- Brainstorm phase felt too long
`)

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
  assert(json.status === 'ok', 'status is ok')
  assert(typeof json.scanned === 'number', 'has scanned count')
  assert(typeof json.unprocessed === 'number', 'has unprocessed count')
  assert(Array.isArray(json.suggestions), 'has suggestions array')
  assert(json.knowledge_path !== undefined, 'has knowledge_path')
  assert(Array.isArray(json.existing_knowledge), 'has existing_knowledge array')
  assert(json.existing_knowledge.length === 0, 'existing_knowledge is empty when no feedback files exist')

  const captureSuggestion = json.suggestions.find(s => s.source === 'capture-diff')
  assert(captureSuggestion !== undefined, 'capture diff surfaces as suggestion')
  if (captureSuggestion) {
    assert(captureSuggestion.body.includes('TDD approach'), 'suggestion body includes diff content')
  }

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
    'status is ok', 'has scanned count', 'has unprocessed count',
    'has suggestions array', 'has knowledge_path', 'has existing_knowledge array',
    'existing_knowledge is empty when no feedback files exist',
    'capture diff surfaces as suggestion', 'suggestion body includes diff content',
    'second run output is valid JSON', 'unprocessed stays until mark-processed is called',
    'scoped output is valid JSON', 'scoped output scans one assignment',
  ]
  for (const msg of remaining) {
    assert(false, `${msg} (skipped — no JSON)`)
  }
}

console.log('\nponder removed:')
result = runCmd(['ponder', 'workflow', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'ponder command no longer exists')
assert(
  result.stderr.includes('Unknown command') || result.stdout.includes('Unknown command'),
  'ponder shows unknown command error'
)

// =====================================================================
// Distill Project
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

const specdev2 = join(TEST_DIR, '.specdev')
const assignmentDir2 = join(specdev2, 'assignments', '00001_feature_test-proj')
mkdirSync(join(assignmentDir2, 'capture'), { recursive: true })
mkdirSync(join(assignmentDir2, 'context'), { recursive: true })

writeFileSync(join(assignmentDir2, 'capture', 'project-notes-diff.md'), `# Project Notes Diff
## Gaps Found
- big_picture.md should mention the new auth system
`)

writeFileSync(join(assignmentDir2, 'context', 'decisions.md'), `# Decisions
- Chose JWT over session cookies for stateless auth
`)

console.log('\ndistill project — valid JSON output:')
result = runCmd(['distill', 'project', `--target=${TEST_DIR}`])
assert(result.status === 0, 'project exits with code 0')
let projJson
try {
  projJson = JSON.parse(result.stdout.trim())
  assert(true, 'project output is valid JSON')
} catch {
  assert(false, 'project output is valid JSON: ' + result.stdout.slice(0, 100))
}

if (projJson) {
  assert(projJson.status === 'ok', 'project status is ok')
  assert(typeof projJson.scanned === 'number', 'project has scanned count')
  assert(typeof projJson.unprocessed === 'number', 'project has unprocessed count')
  assert(typeof projJson.existing_knowledge === 'object', 'project has existing_knowledge')
  assert(Array.isArray(projJson.suggestions), 'project has suggestions array')
  assert(typeof projJson.knowledge_paths === 'object', 'project has knowledge_paths')

  const captureSuggestion = projJson.suggestions.find(s => s.source === 'capture-diff')
  assert(captureSuggestion !== undefined, 'project capture diff surfaces as suggestion')
  if (captureSuggestion) {
    assert(captureSuggestion.branch !== undefined, 'project capture suggestion has branch field')
    assert(captureSuggestion.body.includes('auth system'), 'project suggestion body includes diff content')
  }

  const branches = ['codestyle', 'architecture', 'domain', 'workflow']
  for (const b of branches) {
    assert(Array.isArray(projJson.existing_knowledge[b]), `existing_knowledge has ${b} branch`)
  }

  const scoped = runCmd(['distill', 'project', `--target=${TEST_DIR}`, '--assignment=00001_feature_test-proj'])
  let scopedJson = null
  try {
    scopedJson = JSON.parse(scoped.stdout.trim())
  } catch {
    scopedJson = null
  }
  assert(scopedJson !== null, 'project scoped output is valid JSON')
  if (scopedJson) {
    assert(scopedJson.scanned === 1, 'project scoped output scans one assignment')
  }
} else {
  const remaining = ['project status is ok', 'project has scanned count', 'project has unprocessed count',
    'project has existing_knowledge', 'project has suggestions array', 'project has knowledge_paths',
    'project capture diff surfaces as suggestion', 'project capture suggestion has branch field',
    'project suggestion body includes diff content',
    'existing_knowledge has codestyle branch', 'existing_knowledge has architecture branch',
    'existing_knowledge has domain branch', 'existing_knowledge has workflow branch',
    'project scoped output is valid JSON', 'project scoped output scans one assignment']
  for (const msg of remaining) {
    assert(false, msg + ' (skipped — no JSON)')
  }
}

// =====================================================================
// Distill Mark-Processed
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

const specdev3 = join(TEST_DIR, '.specdev')
const markDir = join(specdev3, 'assignments', '00001_feature_mark-test')
mkdirSync(join(markDir, 'capture'), { recursive: true })
writeFileSync(join(markDir, 'capture', 'workflow-diff.md'), '# Workflow Diff\n## What Worked\n- Tests\n')

console.log('\ndistill mark-processed — before marking:')
result = runCmd(['distill', 'workflow', `--target=${TEST_DIR}`])
json = JSON.parse(result.stdout.trim())
assert(json.unprocessed >= 1, 'assignment is unprocessed before marking')

console.log('\ndistill mark-processed workflow:')
result = runCmd(['distill', 'mark-processed', 'workflow', '00001_feature_mark-test', `--target=${TEST_DIR}`])
assert(result.status === 0, 'mark-processed exits with code 0')

console.log('\ndistill workflow — after marking:')
result = runCmd(['distill', 'workflow', `--target=${TEST_DIR}`])
json = JSON.parse(result.stdout.trim())
assert(json.unprocessed === 0, 'assignment is processed after marking')
assert(json.suggestions.length === 0, 'no suggestions after marking')

const markDir2 = join(specdev3, 'assignments', '00002_feature_mark-test-2')
mkdirSync(join(markDir2, 'capture'), { recursive: true })
writeFileSync(join(markDir2, 'capture', 'project-notes-diff.md'), '# Diff\n## Gaps\n- Missing docs\n')

result = runCmd(['distill', 'mark-processed', 'project', '00001_feature_mark-test,00002_feature_mark-test-2', `--target=${TEST_DIR}`])
assert(result.status === 0, 'mark-processed handles comma-separated assignments')

result = runCmd(['distill', 'project', `--target=${TEST_DIR}`])
json = JSON.parse(result.stdout.trim())
assert(json.unprocessed === 0, 'both assignments marked as processed for project')

console.log('\ndistill mark-processed — error cases:')
result = runCmd(['distill', 'mark-processed', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'fails without type argument')

result = runCmd(['distill', 'mark-processed', 'invalid', 'foo', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'fails with invalid type')

result = runCmd(['distill', 'mark-processed', 'project', 'does-not-exist', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'fails with unknown assignment name')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
