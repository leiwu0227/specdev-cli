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

// ---- Test default init (should generate AGENTS.md) ----
console.log('\ndefault init (generic):')
cleanup()
let result = runCmd(['init', `--target=${TEST_DIR}`])
assert(result.status === 0, 'init succeeds')
assert(existsSync(join(TEST_DIR, '.specdev', '_main.md')), '.specdev created')
assert(existsSync(join(TEST_DIR, 'AGENTS.md')), 'creates AGENTS.md by default')
const agentsMd = readFileSync(join(TEST_DIR, 'AGENTS.md'), 'utf-8')
assert(agentsMd.includes('.specdev/_main.md'), 'AGENTS.md points to _main.md')

// ---- Test --platform=claude ----
console.log('\n--platform=claude:')
cleanup()
result = runCmd(['init', `--target=${TEST_DIR}`, '--platform=claude'])
assert(result.status === 0, 'init with --platform=claude succeeds')
assert(existsSync(join(TEST_DIR, 'CLAUDE.md')), 'creates CLAUDE.md')
const claudeMd = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
assert(claudeMd.includes('.specdev/_main.md'), 'CLAUDE.md points to _main.md')
assert(!existsSync(join(TEST_DIR, 'AGENTS.md')), 'does NOT create AGENTS.md when platform=claude')

// ---- Test --platform=codex ----
console.log('\n--platform=codex:')
cleanup()
result = runCmd(['init', `--target=${TEST_DIR}`, '--platform=codex'])
assert(result.status === 0, 'init with --platform=codex succeeds')
assert(existsSync(join(TEST_DIR, 'AGENTS.md')), 'creates AGENTS.md for codex')

// ---- Test --platform=cursor ----
console.log('\n--platform=cursor:')
cleanup()
result = runCmd(['init', `--target=${TEST_DIR}`, '--platform=cursor'])
assert(result.status === 0, 'init with --platform=cursor succeeds')
assert(existsSync(join(TEST_DIR, '.cursor', 'rules')), 'creates .cursor/rules')
const cursorRules = readFileSync(join(TEST_DIR, '.cursor', 'rules'), 'utf-8')
assert(cursorRules.includes('.specdev/_main.md'), '.cursor/rules points to _main.md')

// ---- Test adapter contains "Using specdev:" instruction ----
console.log('\nadapter drift-detection instruction:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`, '--platform=claude'])
const driftCheck = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
assert(driftCheck.includes('Using specdev:'), 'adapter includes "Using specdev:" prefix instruction')

// ---- Test --platform=claude installs skills ----
console.log('\nclaude skills installation:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`, '--platform=claude'])
const skillsDir = join(TEST_DIR, '.claude', 'skills')
assert(existsSync(skillsDir), '.claude/skills/ directory created')
assert(existsSync(join(skillsDir, 'specdev-start', 'SKILL.md')), 'specdev-start/SKILL.md installed')
assert(existsSync(join(skillsDir, 'specdev-remind', 'SKILL.md')), 'specdev-remind/SKILL.md installed')
assert(existsSync(join(skillsDir, 'specdev-rewind', 'SKILL.md')), 'specdev-rewind/SKILL.md installed')
assert(existsSync(join(skillsDir, 'specdev-brainstorm', 'SKILL.md')), 'specdev-brainstorm/SKILL.md installed')
assert(existsSync(join(skillsDir, 'specdev-continue', 'SKILL.md')), 'specdev-continue/SKILL.md installed')
assert(existsSync(join(skillsDir, 'specdev-review', 'SKILL.md')), 'specdev-review/SKILL.md installed')
const startSkill = readFileSync(join(skillsDir, 'specdev-start', 'SKILL.md'), 'utf-8')
assert(startSkill.includes('big_picture.md'), 'start skill references big_picture.md')
assert(startSkill.includes('What does this project do'), 'start skill includes Q&A instructions')

const remindSkill = readFileSync(join(skillsDir, 'specdev-remind', 'SKILL.md'), 'utf-8')
assert(remindSkill.includes('specdev remind'), 'remind skill references specdev remind command')
assert(remindSkill.includes('Using specdev:'), 'remind skill includes prefix instruction')

const rewindSkill = readFileSync(join(skillsDir, 'specdev-rewind', 'SKILL.md'), 'utf-8')
assert(rewindSkill.includes('.specdev/_main.md'), 'rewind skill references _main.md')

const brainstormSkill = readFileSync(join(skillsDir, 'specdev-brainstorm', 'SKILL.md'), 'utf-8')
assert(brainstormSkill.includes('skills/core/brainstorming/SKILL.md'), 'brainstorm skill references brainstorming SKILL.md')

const continueSkill = readFileSync(join(skillsDir, 'specdev-continue', 'SKILL.md'), 'utf-8')
assert(continueSkill.includes('watching.json'), 'continue skill references watching.json for auto-detection')

const reviewSkill = readFileSync(join(skillsDir, 'specdev-review', 'SKILL.md'), 'utf-8')
assert(reviewSkill.includes('skills/core/review-agent/SKILL.md'), 'review skill references review-agent SKILL.md')

// ---- Test generic platform does NOT install skills ----
console.log('\ngeneric skips skills:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`])
assert(!existsSync(join(TEST_DIR, '.claude', 'skills')), 'generic platform does not create .claude/skills/')

cleanup()
runCmd(['init', `--target=${TEST_DIR}`, '--platform=codex'])
assert(!existsSync(join(TEST_DIR, '.claude', 'skills')), 'codex platform does not create .claude/skills/')

cleanup()
runCmd(['init', `--target=${TEST_DIR}`, '--platform=cursor'])
assert(!existsSync(join(TEST_DIR, '.claude', 'skills')), 'cursor platform does not create .claude/skills/')

// ---- Test adapter does NOT overwrite existing file ----
console.log('\nno-overwrite:')
cleanup()
runCmd(['init', `--target=${TEST_DIR}`, '--platform=claude'])
const originalContent = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
const modified = originalContent + '\n# My custom rules\n'
writeFileSync(join(TEST_DIR, 'CLAUDE.md'), modified)
// Re-init with force (should update .specdev but preserve adapter)
result = runCmd(['init', `--target=${TEST_DIR}`, '--platform=claude', '--force'])
const afterForce = readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')
assert(afterForce.includes('My custom rules'), 'preserves existing adapter content on --force')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
