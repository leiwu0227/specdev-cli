import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMockToolSkill } from './helpers.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-update-output')

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

// =====================================================================
// Update Skills Tests
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

console.log('\nupdate overwrites skills:')
const assignmentPath = join(TEST_DIR, '.claude', 'skills', 'specdev-assignment', 'SKILL.md')
writeFileSync(assignmentPath, '# tampered content\n')
let result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds')
const afterUpdate = readFileSync(assignmentPath, 'utf-8')
assert(afterUpdate.includes('specdev assignment'), 'skill file restored after update')
assert(!afterUpdate.includes('tampered'), 'tampered content replaced')

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

console.log('\nupdate preserves custom tools:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

const customToolDir = join(TEST_DIR, '.specdev', 'skills', 'tools', 'my-custom-tool')
mkdirSync(customToolDir, { recursive: true })
writeFileSync(join(customToolDir, 'SKILL.md'), '---\nname: my-custom-tool\n---\n')

result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds with custom tool skill')
assert(existsSync(join(customToolDir, 'SKILL.md')), 'preserves custom tool skills')

console.log('\nupdate restores core reviewloop:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

const reviewloopSkillPath = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'SKILL.md')
writeFileSync(reviewloopSkillPath, '# tampered reviewloop skill\n')
result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds with tampered core reviewloop')
const reviewloopAfterUpdate = readFileSync(reviewloopSkillPath, 'utf-8')
assert(reviewloopAfterUpdate.includes('name: reviewloop'), 'core reviewloop skill restored after update')
assert(!reviewloopAfterUpdate.includes('tampered reviewloop'), 'tampered core reviewloop content replaced')

console.log('\nupdate removes old tools/reviewloop:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

const oldReviewloopDir = join(TEST_DIR, '.specdev', 'skills', 'tools', 'reviewloop')
mkdirSync(oldReviewloopDir, { recursive: true })
writeFileSync(join(oldReviewloopDir, 'SKILL.md'), '# old reviewloop\n')
result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds with old tools/reviewloop')
assert(!existsSync(oldReviewloopDir), 'old tools/reviewloop removed by update')

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

console.log('\nupdate removes deprecated slash skills:')
assert(!existsSync(join(claudeSkillsDir, 'specdev-brainstorm')), 'removes deprecated specdev-brainstorm skill')

// =====================================================================
// Update Sync Tests
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })
createMockToolSkill(TEST_DIR, 'mock-tool')

runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=mock-tool', '--agents=claude-code'])
rmSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool'), { recursive: true })

console.log('\nupdate runs sync:')
result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds')
assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md')), 'wrapper regenerated by update sync')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
