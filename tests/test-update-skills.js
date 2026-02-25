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

// ---- Test update propagates official tool skills but preserves custom tools ----
console.log('\nupdate propagates official tool skills:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

const officialFireperpDir = join(TEST_DIR, '.specdev', 'skills', 'tools', 'fireperp')
const customToolDir = join(TEST_DIR, '.specdev', 'skills', 'tools', 'my-custom-tool')
mkdirSync(customToolDir, { recursive: true })
writeFileSync(join(customToolDir, 'SKILL.md'), '---\nname: my-custom-tool\n---\n')
rmSync(officialFireperpDir, { recursive: true, force: true })

result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds with missing official tool skill')
assert(existsSync(join(officialFireperpDir, 'SKILL.md')), 'restores official fireperp tool skill')
assert(existsSync(join(customToolDir, 'SKILL.md')), 'preserves custom tool skills')

// ---- Test update backfills missing platform adapters ----
console.log('\nupdate backfills missing adapters:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

const claudeMd = join(TEST_DIR, 'CLAUDE.md')
const agentsMd = join(TEST_DIR, 'AGENTS.md')
const cursorRules = join(TEST_DIR, '.cursor', 'rules')

// Delete AGENTS.md and .cursor/rules, keep CLAUDE.md
rmSync(agentsMd)
rmSync(cursorRules)

result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds with missing adapters')
assert(existsSync(claudeMd), 'existing CLAUDE.md preserved')
assert(existsSync(agentsMd), 'missing AGENTS.md backfilled')
assert(existsSync(cursorRules), 'missing .cursor/rules backfilled')

const backfilledAgents = readFileSync(agentsMd, 'utf-8')
assert(backfilledAgents.includes('Specdev:'), 'backfilled AGENTS.md has correct content')

// ---- Test update migrates legacy slash-skill marker installs ----
console.log('\nupdate migrates legacy slash skills:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

const claudeSkillsDir = join(TEST_DIR, '.claude', 'skills')
rmSync(join(claudeSkillsDir, 'specdev-assignment'), { recursive: true, force: true })
mkdirSync(join(claudeSkillsDir, 'specdev-brainstorm'), { recursive: true })
writeFileSync(join(claudeSkillsDir, 'specdev-brainstorm', 'SKILL.md'), '# legacy brainstorm\n')

result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds for legacy slash-skill layout')
assert(existsSync(join(claudeSkillsDir, 'specdev-assignment', 'SKILL.md')), 'installs specdev-assignment for legacy layout')

// ---- Test update removes deprecated slash skills ----
console.log('\nupdate removes deprecated slash skills:')
assert(!existsSync(join(claudeSkillsDir, 'specdev-brainstorm')), 'removes deprecated specdev-brainstorm skill')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
