import { existsSync, rmSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-skills-subcmd-output')

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

// `specdev skills` (no subcommand) still lists skills
console.log('\nskills (list):')
let result = runCmd(['skills', `--target=${TEST_DIR}`])
assert(result.status === 0, 'skills list succeeds')
assert(result.stdout.includes('Core skills'), 'shows core skills')

// `specdev skills install` without flags shows available
console.log('\nskills install (no selection):')
result = runCmd(['skills', 'install', `--target=${TEST_DIR}`])
assert(result.status !== null, 'skills install does not crash')

// `specdev skills remove` without name shows error
console.log('\nskills remove (no name):')
result = runCmd(['skills', 'remove', `--target=${TEST_DIR}`])
assert(result.status === 1, 'skills remove without name fails')

// `specdev skills sync` runs cleanly on empty state
console.log('\nskills sync (empty):')
result = runCmd(['skills', 'sync', `--target=${TEST_DIR}`])
assert(result.status === 0, 'skills sync succeeds on empty state')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
