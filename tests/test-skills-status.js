import { existsSync, rmSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-skills-status-output')

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
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })

// Before install — fireperp should show [available]
console.log('\nskills listing — before install:')
let result = runCmd(['skills', `--target=${TEST_DIR}`])
assert(result.stdout.includes('fireperp'), 'shows fireperp')
assert(result.stdout.includes('[available]'), 'shows [available] status')

// After install — fireperp should show [active]
runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=fireperp', '--agents=claude-code'])
console.log('\nskills listing — after install:')
result = runCmd(['skills', `--target=${TEST_DIR}`])
assert(result.stdout.includes('[active]'), 'shows [active] status')

// Core skills should NOT show status tags
assert(!result.stdout.match(/brainstorming.*\[(active|available)\]/), 'core skills have no status tag')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
