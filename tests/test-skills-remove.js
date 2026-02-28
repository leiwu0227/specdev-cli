import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMockToolSkill } from './helpers.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-skills-remove-output')

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
createMockToolSkill(TEST_DIR, 'mock-tool')

// First install a skill
runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=mock-tool', '--agents=claude-code'])
assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md')), 'precondition: wrapper exists after install')

// Remove it
console.log('\nskills remove:')
let result = runCmd(['skills', 'remove', 'mock-tool', `--target=${TEST_DIR}`])
assert(result.status === 0, 'remove succeeds')
assert(!existsSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md')), 'wrapper deleted')

// active-tools.json updated
const activeTools = JSON.parse(readFileSync(join(TEST_DIR, '.specdev', 'skills', 'active-tools.json'), 'utf-8'))
assert(activeTools.tools['mock-tool'] === undefined, 'removed from active-tools.json')

// Remove unknown skill gives error
console.log('\nskills remove (unknown):')
result = runCmd(['skills', 'remove', 'nonexistent', `--target=${TEST_DIR}`])
assert(result.status === 1, 'remove fails for unknown skill')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
