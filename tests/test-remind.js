import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-remind-output')

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

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
}

// ---- No .specdev directory ----
console.log('\nno .specdev:')
cleanup()
mkdirSync(TEST_DIR, { recursive: true })
let result = runCmd(['remind', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'exits with error when no .specdev')
assert(result.stderr.includes('No .specdev'), 'error mentions missing .specdev')

// ---- No assignments ----
console.log('\nno assignments:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
result = runCmd(['remind', `--target=${TEST_DIR}`])
assert(result.status !== 0, 'exits with error when no assignments')
assert(result.stderr.includes('No assignments') || result.stderr.includes('No active'), 'error mentions no assignments')

// ---- Assignment in brainstorm phase (only proposal.md exists) ----
console.log('\nbrainstorm phase:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
const assignDir = join(TEST_DIR, '.specdev', 'assignments', '00001_feature_auth')
mkdirSync(assignDir, { recursive: true })
writeFileSync(join(assignDir, 'proposal.md'), '# Proposal\n')
result = runCmd(['remind', `--target=${TEST_DIR}`])
assert(result.status === 0, 'succeeds with assignment in brainstorm phase')
assert(result.stdout.includes('00001_feature_auth'), 'output includes assignment name')
assert(result.stdout.includes('brainstorm'), 'output includes phase name')
assert(result.stdout.includes('Using specdev:'), 'output includes prefix reminder')

// ---- Assignment in implementation phase ----
console.log('\nimplementation phase:')
writeFileSync(join(assignDir, 'plan.md'), '# Plan\n')
writeFileSync(join(assignDir, 'implementation.md'), '# Implementation\n')
result = runCmd(['remind', `--target=${TEST_DIR}`])
assert(result.status === 0, 'succeeds with assignment in implementation phase')
assert(result.stdout.includes('implementation'), 'output includes implementation phase')

// ---- Assignment with tasks ----
console.log('\nwith tasks:')
const tasksDir = join(assignDir, 'tasks')
mkdirSync(join(tasksDir, 'task_01'), { recursive: true })
mkdirSync(join(tasksDir, 'task_02'), { recursive: true })
mkdirSync(join(tasksDir, 'task_03'), { recursive: true })
writeFileSync(join(tasksDir, 'task_01', 'result.md'), 'done')
writeFileSync(join(tasksDir, 'task_02', 'result.md'), 'done')
result = runCmd(['remind', `--target=${TEST_DIR}`])
assert(result.status === 0, 'succeeds with tasks')
assert(result.stdout.includes('2/3'), 'output shows task progress')

// ---- Multiple assignments, uses latest ----
console.log('\nmultiple assignments (uses latest):')
const assign2 = join(TEST_DIR, '.specdev', 'assignments', '00002_bugfix_login')
mkdirSync(assign2, { recursive: true })
writeFileSync(join(assign2, 'proposal.md'), '# Proposal\n')
result = runCmd(['remind', `--target=${TEST_DIR}`])
assert(result.status === 0, 'succeeds with multiple assignments')
assert(result.stdout.includes('00002_bugfix_login'), 'shows latest assignment')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
