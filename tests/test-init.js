import { existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-init-output')

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
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

// =====================================================================
// Verify Output (spot-check ~15 essential files after init)
// =====================================================================

cleanup()
let result = runCmd(['init', `--target=${TEST_DIR}`])
assert(result.status === 0, 'init succeeds')

const essentialFiles = [
  '.specdev/_main.md',
  '.specdev/_index.md',
  '.specdev/_guides/workflow.md',
  '.specdev/_templates/gate_checklist.md',
  '.specdev/_templates/assignment_examples/feature/00000_feature_email-validator/brainstorm/proposal.md',
  '.specdev/project_notes/big_picture.md',
  '.specdev/assignments/.gitkeep',
  '.specdev/skills/README.md',
  '.specdev/skills/core/brainstorming/SKILL.md',
  '.specdev/skills/core/implementing/SKILL.md',
  '.specdev/skills/core/reviewloop/SKILL.md',
  '.specdev/skills/core/test-driven-development/SKILL.md',
  '.specdev/skills/tools/README.md',
  '.specdev/knowledge/_index.md',
  '.specdev/project_scaffolding/_README.md',
]

console.log('\nverify-output (spot-check):')
const missing = essentialFiles.filter(f => !existsSync(join(TEST_DIR, f)))
if (missing.length > 0) {
  console.error('Missing files:', missing.join(', '))
}
assert(missing.length === 0, `all ${essentialFiles.length} essential files present`)

const mainMd = readFileSync(join(TEST_DIR, '.specdev', '_main.md'), 'utf-8')
assert(mainMd.includes('SpecDev'), '_main.md contains SpecDev reference')
assert(mainMd.includes('Specdev:'), '_main.md contains "Specdev:" announcement rule')

// =====================================================================
// Init Platform Tests
// =====================================================================

console.log('\ndefault init creates all adapters:')
cleanup()
result = runCmd(['init', `--target=${TEST_DIR}`])
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

console.log('\ndefault init installs Claude extras:')
const skillsDir = join(TEST_DIR, '.claude', 'skills')
assert(existsSync(skillsDir), '.claude/skills/ directory created')
assert(existsSync(join(skillsDir, 'specdev-start', 'SKILL.md')), 'specdev-start/SKILL.md installed')
assert(existsSync(join(skillsDir, 'specdev-assignment', 'SKILL.md')), 'specdev-assignment/SKILL.md installed')
assert(existsSync(join(skillsDir, 'specdev-rewind', 'SKILL.md')), 'specdev-rewind/SKILL.md installed')
assert(!existsSync(join(skillsDir, 'specdev-brainstorm', 'SKILL.md')), 'specdev-brainstorm removed (redundant with assignment)')
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

const continueSkill = readFileSync(join(skillsDir, 'specdev-continue', 'SKILL.md'), 'utf-8')
assert(continueSkill.includes('specdev continue'), 'continue skill references specdev continue command')

const reviewSkill = readFileSync(join(skillsDir, 'specdev-review', 'SKILL.md'), 'utf-8')
assert(reviewSkill.includes('specdev review'), 'review skill references specdev review command')

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

console.log('\n--platform=claude backward compat:')
cleanup()
result = runCmd(['init', `--target=${TEST_DIR}`, '--platform=claude'])
assert(result.status === 0, 'init with --platform=claude succeeds')
assert(existsSync(join(TEST_DIR, 'CLAUDE.md')), 'creates CLAUDE.md')
assert(existsSync(join(TEST_DIR, 'AGENTS.md')), 'creates AGENTS.md')
assert(existsSync(join(TEST_DIR, '.cursor', 'rules')), 'creates .cursor/rules')

console.log('\nhook registration idempotent:')
result = runCmd(['init', `--target=${TEST_DIR}`, '--force'])
const settingsAfter = JSON.parse(readFileSync(settingsFile, 'utf-8'))
const hookEntries = settingsAfter.hooks.SessionStart.filter(
  (entry) => entry.hooks && entry.hooks.some((h) => h.command === '.claude/hooks/specdev-session-start.sh')
)
assert(hookEntries.length === 1, 'no duplicate hook entry after re-init with --force')

console.log('\nhook merges with existing settings:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
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

console.log('\ninvalid settings preserved:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
const invalidSettingsPath = join(TEST_DIR, '.claude', 'settings.json')
writeFileSync(invalidSettingsPath, '{ invalid json')
result = runCmd(['init', `--target=${TEST_DIR}`, '--force'])
assert(result.status === 0, 're-init succeeds even with invalid settings')
assert(readFileSync(invalidSettingsPath, 'utf-8') === '{ invalid json', 'keeps invalid settings file untouched')

console.log('\nadapter drift-detection instruction:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
const driftCheck = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
assert(driftCheck.includes('Specdev:'), 'adapter includes "Specdev:" prefix instruction')

console.log('\nno-overwrite:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
const originalContent = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
const modified = originalContent + '\n# My custom rules\n'
writeFileSync(join(TEST_DIR, 'CLAUDE.md'), modified)
result = runCmd(['init', `--target=${TEST_DIR}`, '--force'])
const afterForce = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
assert(afterForce.includes('My custom rules'), 'preserves existing CLAUDE.md content on --force')

const originalAgents = readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8')
const modifiedAgents = originalAgents + '\n# Custom agent rules\n'
writeFileSync(join(TEST_DIR, 'AGENTS.md'), modifiedAgents)
const originalCursor = readFileSync(join(TEST_DIR, '.cursor', 'rules'), 'utf-8')
const modifiedCursor = originalCursor + '\n# Custom cursor rules\n'
writeFileSync(join(TEST_DIR, '.cursor', 'rules'), modifiedCursor)
result = runCmd(['init', `--target=${TEST_DIR}`, '--force'])
assert(readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8').includes('Custom agent rules'), 'preserves existing AGENTS.md content on --force')
assert(readFileSync(join(TEST_DIR, '.cursor', 'rules'), 'utf-8').includes('Custom cursor rules'), 'preserves existing .cursor/rules content on --force')

// =====================================================================
// Start Tests
// =====================================================================

console.log('\nstart without .specdev:')
cleanup()
mkdirSync(TEST_DIR, { recursive: true })
const noSpecdev = runCmd(['start', `--target=${TEST_DIR}`])
assert(noSpecdev.status === 1, 'exits non-zero without .specdev')

console.log('\nstart with template big_picture:')
runCmd(['init', `--target=${TEST_DIR}`])
const startTemplate = runCmd(['start', `--target=${TEST_DIR}`])
assert(startTemplate.status === 0, 'exits 0 with template big_picture')

console.log('\nstart with filled big_picture:')
const bigPicturePath = join(TEST_DIR, '.specdev', 'project_notes', 'big_picture.md')
writeFileSync(bigPicturePath, '# Project Big Picture\n\n## Overview\nThis is a real project with real content that has been filled in properly.\n\n## Tech Stack\nNode.js, TypeScript\n')
const startFilled = runCmd(['start', `--target=${TEST_DIR}`])
assert(startFilled.status === 0, 'exits 0 with filled big_picture')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
