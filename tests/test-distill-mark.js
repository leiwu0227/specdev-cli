import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-distill-mark-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

const specdev = join(TEST_DIR, '.specdev')
const assignmentDir = join(specdev, 'assignments', '00001_feature_mark-test')
mkdirSync(join(assignmentDir, 'capture'), { recursive: true })
writeFileSync(join(assignmentDir, 'capture', 'workflow-diff.md'), '# Workflow Diff\n## What Worked\n- Tests\n')

// Before marking: distill should show unprocessed
console.log('\ndistill mark-processed — before marking:')
let result = runCmd(['distill', 'workflow', `--target=${TEST_DIR}`])
let json = JSON.parse(result.stdout.trim())
assert(json.unprocessed >= 1, 'assignment is unprocessed before marking')

// Mark it as processed
console.log('\ndistill mark-processed workflow:')
result = runCmd(['distill', 'mark-processed', 'workflow', '00001_feature_mark-test', `--target=${TEST_DIR}`])
assert(result.status === 0, 'mark-processed exits with code 0')

// After marking: distill should show 0 unprocessed
console.log('\ndistill workflow — after marking:')
result = runCmd(['distill', 'workflow', `--target=${TEST_DIR}`])
json = JSON.parse(result.stdout.trim())
assert(json.unprocessed === 0, 'assignment is processed after marking')
assert(json.suggestions.length === 0, 'no suggestions after marking')

// Mark-processed with multiple assignments (comma-separated)
const assignmentDir2 = join(specdev, 'assignments', '00002_feature_mark-test-2')
mkdirSync(join(assignmentDir2, 'capture'), { recursive: true })
writeFileSync(join(assignmentDir2, 'capture', 'project-notes-diff.md'), '# Diff\n## Gaps\n- Missing docs\n')

result = runCmd(['distill', 'mark-processed', 'project', '00001_feature_mark-test,00002_feature_mark-test-2', `--target=${TEST_DIR}`])
assert(result.status === 0, 'mark-processed handles comma-separated assignments')

result = runCmd(['distill', 'project', `--target=${TEST_DIR}`])
json = JSON.parse(result.stdout.trim())
assert(json.unprocessed === 0, 'both assignments marked as processed for project')

// Error cases
console.log('\ndistill mark-processed — error cases:')
result = runCmd(['distill', 'mark-processed', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'fails without type argument')

result = runCmd(['distill', 'mark-processed', 'invalid', 'foo', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'fails with invalid type')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
