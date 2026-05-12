import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMockToolSkill } from './helpers.js'

// Single comprehensive scenario: init once, tamper everything we expect
// `specdev update` to repair/preserve/migrate, then call update once and
// assert all outcomes. The 8-scenario / 8-init layout previously here
// inflated suite runtime dramatically on slow filesystems; collapsing
// into one init keeps the contract tested without the cost.

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

// ── Setup: one init ────────────────────────────────────────────────────
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

// ── Tamper state we expect update to repair/preserve/migrate ───────────

// Tampered command skills
const claudeAssignmentPath = join(TEST_DIR, '.claude', 'skills', 'specdev-assignment', 'SKILL.md')
const codexAssignmentPath = join(TEST_DIR, '.codex', 'skills', 'specdev-assignment', 'SKILL.md')
writeFileSync(claudeAssignmentPath, '# tampered content\n')
writeFileSync(codexAssignmentPath, '# tampered codex content\n')

// Tampered core skill
const reviewloopSkillPath = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'SKILL.md')
writeFileSync(reviewloopSkillPath, '# tampered reviewloop skill\n')

// Tampered hook
const hookPath = join(TEST_DIR, '.claude', 'hooks', 'specdev-session-start.sh')
writeFileSync(hookPath, '#!/usr/bin/env bash\n# tampered hook\n')

// Missing agents directory (drift backfill)
rmSync(join(TEST_DIR, '.specdev', 'agents'), { recursive: true, force: true })

// Custom user-installed tool skill (must be preserved)
const customToolDir = join(TEST_DIR, '.specdev', 'skills', 'tools', 'my-custom-tool')
mkdirSync(customToolDir, { recursive: true })
writeFileSync(join(customToolDir, 'SKILL.md'), '---\nname: my-custom-tool\n---\n')

// Stale legacy directory that should be removed
const oldReviewloopDir = join(TEST_DIR, '.specdev', 'skills', 'tools', 'reviewloop')
mkdirSync(oldReviewloopDir, { recursive: true })
writeFileSync(join(oldReviewloopDir, 'SKILL.md'), '# old reviewloop\n')

// Legacy slash-skill layout (deprecated specdev-brainstorm; missing current specdev-assignment)
const claudeSkillsDir = join(TEST_DIR, '.claude', 'skills')
const codexSkillsDir = join(TEST_DIR, '.codex', 'skills')
mkdirSync(join(claudeSkillsDir, 'specdev-brainstorm'), { recursive: true })
mkdirSync(join(codexSkillsDir, 'specdev-brainstorm'), { recursive: true })
writeFileSync(join(claudeSkillsDir, 'specdev-brainstorm', 'SKILL.md'), '# legacy brainstorm\n')
writeFileSync(join(codexSkillsDir, 'specdev-brainstorm', 'SKILL.md'), '# legacy brainstorm\n')

// Tool-skill wrapper removed (sync should regenerate it)
createMockToolSkill(TEST_DIR, 'mock-tool')
runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=mock-tool', '--agents=claude-code'])
rmSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool'), { recursive: true })

// ── Run update once and assert all outcomes ────────────────────────────

console.log('\nupdate (one shot, drift + preservation + migration + sync):')
const result = runCmd(['update', `--target=${TEST_DIR}`])
assert(result.status === 0, 'update succeeds')

// Skills restored
const claudeAfter = readFileSync(claudeAssignmentPath, 'utf-8')
const codexAfter = readFileSync(codexAssignmentPath, 'utf-8')
assert(claudeAfter.includes('specdev assignment') && !claudeAfter.includes('tampered'), 'claude command skill restored')
assert(codexAfter.includes('specdev assignment') && !codexAfter.includes('tampered'), 'codex command skill restored')

// Layout-migration skill installed
assert(existsSync(join(claudeSkillsDir, 'specdev-layout-migration', 'SKILL.md')), 'claude layout-migration installed')
assert(existsSync(join(codexSkillsDir, 'specdev-layout-migration', 'SKILL.md')), 'codex layout-migration installed')

// Core reviewloop SKILL restored
const reviewloopAfter = readFileSync(reviewloopSkillPath, 'utf-8')
assert(reviewloopAfter.includes('name: reviewloop') && !reviewloopAfter.includes('tampered'), 'core reviewloop SKILL restored')

// Hook restored
const hookAfter = readFileSync(hookPath, 'utf-8')
assert(hookAfter.includes('SessionStart hook for specdev') && !hookAfter.includes('tampered'), 'hook script restored')

// Agents backfilled
assert(existsSync(join(TEST_DIR, '.specdev', 'agents', 'researcher', 'agent.md')), 'researcher agent backfilled')
assert(result.stdout.includes('agents'), 'human update output mentions agents')

// Custom tool preserved
assert(existsSync(join(customToolDir, 'SKILL.md')), 'custom user-installed tool preserved')

// Legacy directory removed
assert(!existsSync(oldReviewloopDir), 'legacy skills/tools/reviewloop removed')

// Legacy slash-skill migration
assert(!existsSync(join(claudeSkillsDir, 'specdev-brainstorm')), 'deprecated specdev-brainstorm removed from .claude')
assert(!existsSync(join(codexSkillsDir, 'specdev-brainstorm')), 'deprecated specdev-brainstorm removed from .codex')

// Sync regenerates removed wrapper
assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md')), 'tool-skill wrapper regenerated by update sync')

// Dry-run JSON listing (smoke — runs against an already-up-to-date tree, must succeed and parse)
const dryRun = JSON.parse(runCmd(['update', `--target=${TEST_DIR}`, '--dry-run', '--json']).stdout)
assert(Array.isArray(dryRun.would_update), 'dry-run JSON returns would_update array')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
