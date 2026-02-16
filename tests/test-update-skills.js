import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-update-skills-output')

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

// ---- Setup: init with claude platform ----
cleanup()
runCmd(['init', `--target=${TEST_DIR}`, '--platform=claude'])

// ---- Test update overwrites skill files ----
console.log('\nupdate overwrites skills:')
const remindPath = join(TEST_DIR, '.claude', 'skills', 'specdev-remind', 'SKILL.md')
writeFileSync(remindPath, '# tampered content\n')
let result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds')
const afterUpdate = readFileSync(remindPath, 'utf-8')
assert(afterUpdate.includes('specdev remind'), 'skill file restored after update')
assert(!afterUpdate.includes('tampered'), 'tampered content replaced')

// ---- Test update reports skill update ----
assert(result.stdout.includes('.claude/skills'), 'update output mentions skills')

// ---- Test update skips skills when .claude/skills does not exist ----
console.log('\nupdate skips when no .claude/skills:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])  // generic platform, no skills
result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds without skills')
assert(!existsSync(join(TEST_DIR, '.claude', 'skills')), 'does not create .claude/skills')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
