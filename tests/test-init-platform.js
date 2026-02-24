import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-init-platform-output')

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

// ---- Test default init creates all three adapters ----
console.log('\ndefault init creates all adapters:')
cleanup()
let result = runCmd(['init', `--target=${TEST_DIR}`])
assert(result.status === 0, 'init succeeds')
assert(existsSync(join(TEST_DIR, '.specdev', '_main.md')), '.specdev created')
assert(existsSync(join(TEST_DIR, 'CLAUDE.md')), 'creates CLAUDE.md')
assert(existsSync(join(TEST_DIR, 'AGENTS.md')), 'creates AGENTS.md')
assert(existsSync(join(TEST_DIR, '.cursor', 'rules')), 'creates .cursor/rules')

const claudeMd = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
assert(claudeMd.includes('.specdev/_main.md'), 'CLAUDE.md points to _main.md')
const agentsMd = readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8')
assert(agentsMd.includes('.specdev/_main.md'), 'AGENTS.md points to _main.md')
const cursorRules = readFileSync(join(TEST_DIR, '.cursor', 'rules'), 'utf-8')
assert(cursorRules.includes('.specdev/_main.md'), '.cursor/rules points to _main.md')

// ---- Test default init installs Claude extras (skills, hooks, settings) ----
console.log('\ndefault init installs Claude extras:')
const skillsDir = join(TEST_DIR, '.claude', 'skills')
assert(existsSync(skillsDir), '.claude/skills/ directory created')
assert(existsSync(join(skillsDir, 'specdev-start', 'SKILL.md')), 'specdev-start/SKILL.md installed')
assert(existsSync(join(skillsDir, 'specdev-assignment', 'SKILL.md')), 'specdev-assignment/SKILL.md installed')
assert(existsSync(join(skillsDir, 'specdev-rewind', 'SKILL.md')), 'specdev-rewind/SKILL.md installed')
assert(existsSync(join(skillsDir, 'specdev-brainstorm', 'SKILL.md')), 'specdev-brainstorm/SKILL.md installed')
assert(existsSync(join(skillsDir, 'specdev-continue', 'SKILL.md')), 'specdev-continue/SKILL.md installed')
assert(existsSync(join(skillsDir, 'specdev-review', 'SKILL.md')), 'specdev-review/SKILL.md installed')

const startSkill = readFileSync(join(skillsDir, 'specdev-start', 'SKILL.md'), 'utf-8')
assert(startSkill.includes('big_picture.md'), 'start skill references big_picture.md')
assert(startSkill.includes('What does this project do'), 'start skill includes Q&A instructions')

const assignmentSkill = readFileSync(join(skillsDir, 'specdev-assignment', 'SKILL.md'), 'utf-8')
assert(assignmentSkill.includes('specdev assignment'), 'assignment skill references specdev assignment command')
assert(assignmentSkill.includes('Specdev:'), 'assignment skill includes prefix instruction')

const rewindSkill = readFileSync(join(skillsDir, 'specdev-rewind', 'SKILL.md'), 'utf-8')
assert(rewindSkill.includes('.specdev/_main.md'), 'rewind skill references _main.md')

const brainstormSkill = readFileSync(join(skillsDir, 'specdev-brainstorm', 'SKILL.md'), 'utf-8')
assert(brainstormSkill.includes('skills/core/brainstorming/SKILL.md'), 'brainstorm skill references brainstorming SKILL.md')

const continueSkill = readFileSync(join(skillsDir, 'specdev-continue', 'SKILL.md'), 'utf-8')
assert(continueSkill.includes('specdev continue'), 'continue skill references specdev continue command')

const reviewSkill = readFileSync(join(skillsDir, 'specdev-review', 'SKILL.md'), 'utf-8')
assert(reviewSkill.includes('specdev review'), 'review skill references specdev review command')

// ---- Test hook installation ----
console.log('\nhook installation:')
const hookScript = join(TEST_DIR, '.claude', 'hooks', 'specdev-session-start.sh')
assert(existsSync(hookScript), '.claude/hooks/specdev-session-start.sh exists')
const hookContent = readFileSync(hookScript, 'utf-8')
assert(hookContent.startsWith('#!/usr/bin/env bash'), 'hook script starts with bash shebang')
const settingsFile = join(TEST_DIR, '.claude', 'settings.json')
assert(existsSync(settingsFile), '.claude/settings.json exists')
const settings = JSON.parse(readFileSync(settingsFile, 'utf-8'))
assert(
  settings.hooks &&
  Array.isArray(settings.hooks.SessionStart) &&
  settings.hooks.SessionStart.some(
    (entry) => entry.hooks && entry.hooks.some((h) => h.command === '.claude/hooks/specdev-session-start.sh')
  ),
  'settings.json contains SessionStart hook pointing to specdev script'
)

// ---- Test --platform=claude still works (backward compat, deprecation notice) ----
console.log('\n--platform=claude backward compat:')
cleanup()
result = runCmd(['init', `--target=${TEST_DIR}`, '--platform=claude'])
assert(result.status === 0, 'init with --platform=claude succeeds')
assert(existsSync(join(TEST_DIR, 'CLAUDE.md')), 'creates CLAUDE.md')
assert(existsSync(join(TEST_DIR, 'AGENTS.md')), 'creates AGENTS.md')
assert(existsSync(join(TEST_DIR, '.cursor', 'rules')), 'creates .cursor/rules')

// ---- Test hook registration is idempotent ----
console.log('\nhook registration idempotent:')
result = runCmd(['init', `--target=${TEST_DIR}`, '--force'])
const settingsAfter = JSON.parse(readFileSync(settingsFile, 'utf-8'))
const hookEntries = settingsAfter.hooks.SessionStart.filter(
  (entry) => entry.hooks && entry.hooks.some((h) => h.command === '.claude/hooks/specdev-session-start.sh')
)
assert(hookEntries.length === 1, 'no duplicate hook entry after re-init with --force')

// ---- Test hook merges with existing settings ----
console.log('\nhook merges with existing settings:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
// Add extra settings and re-init
const settingsPath2 = join(TEST_DIR, '.claude', 'settings.json')
const existing = JSON.parse(readFileSync(settingsPath2, 'utf-8'))
existing.permissions = { allow: ['Read'] }
writeFileSync(settingsPath2, JSON.stringify(existing, null, 2) + '\n')
result = runCmd(['init', `--target=${TEST_DIR}`, '--force'])
const merged = JSON.parse(readFileSync(settingsPath2, 'utf-8'))
assert(merged.permissions && merged.permissions.allow.includes('Read'), 'preserves existing permissions key')
assert(
  merged.hooks && merged.hooks.SessionStart.length > 0,
  'preserves hook registration alongside existing settings'
)

// ---- Test invalid settings are preserved (no overwrite) ----
console.log('\ninvalid settings preserved:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
const invalidSettingsPath = join(TEST_DIR, '.claude', 'settings.json')
writeFileSync(invalidSettingsPath, '{ invalid json')
result = runCmd(['init', `--target=${TEST_DIR}`, '--force'])
assert(result.status === 0, 're-init succeeds even with invalid settings')
assert(readFileSync(invalidSettingsPath, 'utf-8') === '{ invalid json', 'keeps invalid settings file untouched')

// ---- Test adapter contains "Specdev:" instruction ----
console.log('\nadapter drift-detection instruction:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
const driftCheck = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
assert(driftCheck.includes('Specdev:'), 'adapter includes "Specdev:" prefix instruction')

// ---- Test adapters do NOT overwrite existing files ----
console.log('\nno-overwrite:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
const originalContent = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
const modified = originalContent + '\n# My custom rules\n'
writeFileSync(join(TEST_DIR, 'CLAUDE.md'), modified)
// Re-init with force (should update .specdev but preserve adapter)
result = runCmd(['init', `--target=${TEST_DIR}`, '--force'])
const afterForce = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
assert(afterForce.includes('My custom rules'), 'preserves existing CLAUDE.md content on --force')

// Also verify AGENTS.md and .cursor/rules are preserved
const originalAgents = readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8')
const modifiedAgents = originalAgents + '\n# Custom agent rules\n'
writeFileSync(join(TEST_DIR, 'AGENTS.md'), modifiedAgents)
const originalCursor = readFileSync(join(TEST_DIR, '.cursor', 'rules'), 'utf-8')
const modifiedCursor = originalCursor + '\n# Custom cursor rules\n'
writeFileSync(join(TEST_DIR, '.cursor', 'rules'), modifiedCursor)
result = runCmd(['init', `--target=${TEST_DIR}`, '--force'])
assert(readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8').includes('Custom agent rules'), 'preserves existing AGENTS.md content on --force')
assert(readFileSync(join(TEST_DIR, '.cursor', 'rules'), 'utf-8').includes('Custom cursor rules'), 'preserves existing .cursor/rules content on --force')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
