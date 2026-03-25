import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-reviewloop-focus-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true }) }

cleanup()

// Init a test project
spawnSync('node', [CLI, 'init', `--target=${TEST_DIR}`], { encoding: 'utf-8' })

// Create a test reviewer that echoes SPECDEV_FOCUS to a file
const reviewersDir = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers')
const focusOutputPath = join(TEST_DIR, 'focus-output.txt')
const echoReviewer = {
  name: 'echo-focus',
  command: `echo "$SPECDEV_FOCUS" > ${focusOutputPath}`,
  max_rounds: 5
}
writeFileSync(join(reviewersDir, 'echo-focus.json'), JSON.stringify(echoReviewer))

// Create a minimal assignment
const assignmentDir = join(TEST_DIR, '.specdev', 'assignments', '00001_feature_test')
mkdirSync(join(assignmentDir, 'brainstorm'), { recursive: true })
mkdirSync(join(assignmentDir, 'review'), { recursive: true })
writeFileSync(join(assignmentDir, 'brainstorm', 'proposal.md'), '# Test')
writeFileSync(join(assignmentDir, 'brainstorm', 'design.md'), '# Test Design')

// Write .current
writeFileSync(join(TEST_DIR, '.specdev', '.current'), '00001_feature_test')

console.log('\nreviewloop SPECDEV_FOCUS integration:')

const result = spawnSync('node', [CLI, 'reviewloop', 'brainstorm', '--reviewer=echo-focus', `--target=${TEST_DIR}`], {
  encoding: 'utf-8',
  timeout: 10000
})

// The reviewloop will error because echo-focus doesn't write feedback, but SPECDEV_FOCUS should have been set
if (existsSync(focusOutputPath)) {
  const focusOutput = readFileSync(focusOutputPath, 'utf-8').trim()
  assert(focusOutput.includes('Architecture'), 'round 1 SPECDEV_FOCUS contains Architecture')
} else {
  assert(false, 'round 1 SPECDEV_FOCUS was set (focus-output.txt not created)')
}

console.log('\nreview.js SPECDEV_FOCUS display:')

const reviewResult = spawnSync('node', [CLI, 'review', 'brainstorm', '--round=1', `--target=${TEST_DIR}`], {
  encoding: 'utf-8',
  timeout: 10000,
  env: { ...process.env, SPECDEV_FOCUS: 'Test focus instruction' }
})
assert(reviewResult.stdout.includes('Review Focus'), 'review output includes Review Focus header')
assert(reviewResult.stdout.includes('Test focus instruction'), 'review output includes focus text')

const reviewNoFocus = spawnSync('node', [CLI, 'review', 'brainstorm', '--round=1', `--target=${TEST_DIR}`], {
  encoding: 'utf-8',
  timeout: 10000,
  env: { ...process.env, SPECDEV_FOCUS: '' }
})
assert(!reviewNoFocus.stdout.includes('Review Focus'), 'review output omits Review Focus when empty')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
