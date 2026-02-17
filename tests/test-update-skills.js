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

// ---- Setup: init (all adapters + claude extras installed by default) ----
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

// ---- Test update overwrites skill files ----
console.log('\nupdate overwrites skills:')
const assignmentPath = join(TEST_DIR, '.claude', 'skills', 'specdev-assignment', 'SKILL.md')
writeFileSync(assignmentPath, '# tampered content\n')
let result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds')
const afterUpdate = readFileSync(assignmentPath, 'utf-8')
assert(afterUpdate.includes('specdev assignment'), 'skill file restored after update')
assert(!afterUpdate.includes('tampered'), 'tampered content replaced')

// ---- Test update refreshes hook script ----
console.log('\nupdate refreshes hook script:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
const hookPath = join(TEST_DIR, '.claude', 'hooks', 'specdev-session-start.sh')
writeFileSync(hookPath, '#!/usr/bin/env bash\n# tampered hook\n')
result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update with hook succeeds')
const hookAfterUpdate = readFileSync(hookPath, 'utf-8')
assert(hookAfterUpdate.includes('SessionStart hook for specdev'), 'hook script restored after update')
assert(!hookAfterUpdate.includes('tampered'), 'tampered hook content replaced')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
