import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-distill-workflow-output')

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
assert(captureSuggestion.body.includes('TDD approach'), 'suggestion body includes diff content')

// Test 4: Running again still shows unprocessed (not marked yet)
result = runCmd(['distill', 'workflow', `--target=${TEST_DIR}`])
json = JSON.parse(result.stdout.trim())
assert(json.unprocessed >= 1, 'unprocessed stays until mark-processed is called')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
