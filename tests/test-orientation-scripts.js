import { existsSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const SCRIPTS_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'core', 'orientation', 'scripts')
const TEST_DIR = join(__dirname, 'test-orientation-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) {
    console.error(`  FAIL ${msg}`)
    failures++
  } else {
    console.log(`  PASS ${msg}`)
    passes++
  }
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
}

// Setup: init a project
cleanup()
const initResult = spawnSync('node', [CLI, 'init', `--target=${TEST_DIR}`], { encoding: 'utf-8' })
assert(initResult.status === 0, 'init succeeds')

// ---- Test list-skills.sh ----
console.log('\nlist-skills.sh:')

const listScript = join(SCRIPTS_DIR, 'list-skills.sh')
const specdevPath = join(TEST_DIR, '.specdev')
const result = spawnSync('bash', [listScript, specdevPath], { encoding: 'utf-8' })

assert(result.status === 0, 'exits with code 0')
assert(result.stdout.includes('# Available Skills'), 'has header')

// Should list folder-based skills
assert(result.stdout.includes('brainstorming'), 'lists brainstorming skill')
assert(result.stdout.includes('implementing'), 'lists implementing skill')
assert(result.stdout.includes('orientation'), 'lists orientation skill')
assert(result.stdout.includes('[folder]'), 'marks folder-based skills')

// Should list flat skills
assert(result.stdout.includes('verification-before-completion'), 'lists flat skills')
assert(result.stdout.includes('[flat]'), 'marks flat skills')

// Should show contracts for folder skills
assert(result.stdout.includes('Input') || result.stdout.includes('Contract'), 'shows contract info')

// Test with bad path
const badResult = spawnSync('bash', [listScript, '/nonexistent'], { encoding: 'utf-8' })
assert(badResult.status !== 0, 'exits non-zero for missing path')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
