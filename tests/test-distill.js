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
// Combined distill command
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

const specdev = join(TEST_DIR, '.specdev')
const assignmentDir = join(specdev, 'assignments', '00001_feature_test-a')
mkdirSync(join(assignmentDir, 'capture'), { recursive: true })
mkdirSync(join(assignmentDir, 'context'), { recursive: true })

writeFileSync(join(assignmentDir, 'capture', 'project-notes-diff.md'), `# Project Notes Diff
## Gaps Found
- big_picture.md should mention the new auth system
`)

writeFileSync(join(assignmentDir, 'capture', 'workflow-diff.md'), `# Workflow Diff
## What Worked
- TDD approach was effective
## What Didn't
- Brainstorm phase felt too long
`)

writeFileSync(join(assignmentDir, 'context', 'decisions.md'), `# Decisions
- Chose JWT over session cookies
`)

console.log('\ndistill combined — valid JSON output:')
let result = runCmd(['distill', `--target=${TEST_DIR}`, '--assignment=00001_feature_test-a'])
assert(result.status === 0, 'exits with code 0')

let json
try {
  json = JSON.parse(result.stdout.trim())
  assert(true, 'output is valid JSON')
} catch {
  assert(false, 'output is valid JSON: ' + result.stdout.slice(0, 200))
}

if (json) {
  assert(json.status === 'ok', 'status is ok')
  assert(json.assignment === '00001_feature_test-a', 'has assignment name')
  assert(typeof json.capture === 'object', 'has capture object')
  assert(json.capture.project_notes_diff.includes('auth system'), 'capture includes project diff')
  assert(json.capture.workflow_diff.includes('TDD approach'), 'capture includes workflow diff')
  assert(typeof json.knowledge_files === 'object', 'has knowledge_files')
  assert(Array.isArray(json.knowledge_files.codestyle), 'has codestyle branch')
  assert(Array.isArray(json.knowledge_files._workflow_feedback), 'has _workflow_feedback branch')
  assert(typeof json.big_picture_word_count === 'number', 'has big_picture_word_count')
  assert(json.big_picture_word_limit === 2000, 'big_picture_word_limit is 2000')
  assert(Array.isArray(json.heuristics), 'has heuristics array')
}

console.log('\ndistill — missing assignment:')
result = runCmd(['distill', `--target=${TEST_DIR}`, '--assignment=does-not-exist'])
assert(result.status !== 0, 'fails with unknown assignment')
try {
  const errJson = JSON.parse(result.stdout.trim())
  assert(errJson.status === 'error', 'error status in JSON')
} catch {
  assert(false, 'error output is valid JSON')
}

console.log('\ndistill — missing --assignment flag:')
result = runCmd(['distill', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'fails without --assignment')

console.log('\ndistill — no captures:')
const noCaptureDir = join(specdev, 'assignments', '00002_feature_no-captures')
mkdirSync(noCaptureDir, { recursive: true })
result = runCmd(['distill', `--target=${TEST_DIR}`, '--assignment=00002_feature_no-captures'])
assert(result.status === 0, 'exits 0 with no captures')
try {
  const ncJson = JSON.parse(result.stdout.trim())
  assert(ncJson.status === 'no_captures', 'status is no_captures')
} catch {
  assert(false, 'no_captures output is valid JSON')
}

console.log('\nold commands removed:')
result = runCmd(['distill', 'project', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'distill project no longer works')

result = runCmd(['distill', 'workflow', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'distill workflow no longer works')

// =====================================================================
// Distill Done
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

const specdevDone = join(TEST_DIR, '.specdev')
const doneDirAssignment = join(specdevDone, 'assignments', '00001_feature_done-test')
mkdirSync(join(doneDirAssignment, 'capture'), { recursive: true })
writeFileSync(join(doneDirAssignment, 'capture', 'workflow-diff.md'), '# Diff\n')

// Create big_picture.md under limit
const projectNotes = join(specdevDone, 'project_notes')
writeFileSync(join(projectNotes, 'big_picture.md'), 'A short overview of the project.\n')

// Create feature_descriptions.md with entry
writeFileSync(join(projectNotes, 'feature_descriptions.md'),
  '# Feature Descriptions\n\n### Done Test\n**Assignment:** 00001_feature_done-test\n')

console.log('\ndistill done — big_picture over limit:')
writeFileSync(join(projectNotes, 'big_picture.md'), ('word '.repeat(2001)).trim())
result = runCmd(['distill', 'done', '00001_feature_done-test', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'fails when big_picture over word limit')
assert(
  result.stderr.includes('big_picture.md') || result.stdout.includes('big_picture.md'),
  'error mentions big_picture.md'
)

console.log('\ndistill done — missing feature_descriptions entry:')
writeFileSync(join(projectNotes, 'big_picture.md'), 'Short.\n')
writeFileSync(join(projectNotes, 'feature_descriptions.md'), '# Feature Descriptions\n')
result = runCmd(['distill', 'done', '00001_feature_done-test', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'fails when assignment not in feature_descriptions')

console.log('\ndistill done — unknown assignment:')
result = runCmd(['distill', 'done', 'does-not-exist', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'fails with unknown assignment')

console.log('\ndistill done — success:')
writeFileSync(join(projectNotes, 'big_picture.md'), 'A short overview of the project.\n')
writeFileSync(join(projectNotes, 'feature_descriptions.md'),
  '# Feature Descriptions\n\n### Done Test\n**Assignment:** 00001_feature_done-test\n')
result = runCmd(['distill', 'done', '00001_feature_done-test', `--target=${TEST_DIR}`])
assert(result.status === 0, 'distill done exits 0')
try {
  json = JSON.parse(result.stdout.trim())
  assert(json.status === 'ok', 'distill done status ok')
  assert(json.marked === '00001_feature_done-test', 'marked correct assignment')
} catch {
  assert(false, 'distill done output is valid JSON')
}

// Verify marked as processed — distill still works but assignment is tracked
result = runCmd(['distill', `--target=${TEST_DIR}`, '--assignment=00001_feature_done-test'])
json = JSON.parse(result.stdout.trim())
assert(json.status === 'ok' || json.status === 'no_captures', 'distill still runs on processed assignment')

console.log('\ndistill done — already processed:')
result = runCmd(['distill', 'done', '00001_feature_done-test', `--target=${TEST_DIR}`])
assert(result.status === 0, 'already processed exits 0')

console.log('\nold mark-processed removed:')
result = runCmd(['distill', 'mark-processed', 'project', '00001_feature_done-test', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'mark-processed no longer works')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
