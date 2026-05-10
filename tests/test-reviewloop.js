import { existsSync, rmSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-reviewloop-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true }) }

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

// =====================================================================
// Reviewloop Install Tests
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

console.log('\nreviewloop as core skill:')
const skillMd = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'SKILL.md')
assert(existsSync(skillMd), 'SKILL.md exists at core/ path')

const defaultConfig = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers', 'codex.json')
assert(existsSync(defaultConfig), 'codex.json reviewer config exists')

const cursorConfig = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers', 'cursor.json')
assert(existsSync(cursorConfig), 'cursor.json reviewer config exists')

if (existsSync(cursorConfig)) {
  const cursorContent = JSON.parse(readFileSync(cursorConfig, 'utf-8'))
  assert(cursorContent.name === 'cursor', 'cursor.json has name=cursor')
  assert(cursorContent.command && cursorContent.command.includes('cursor-agent'), 'cursor.json command includes cursor-agent')
  assert(typeof cursorContent.max_rounds === 'number', 'cursor.json has numeric max_rounds')
}

const claudeConfig = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers', 'claude.json')
assert(existsSync(claudeConfig), 'claude.json reviewer config exists')

if (existsSync(claudeConfig)) {
  const claudeContent = JSON.parse(readFileSync(claudeConfig, 'utf-8'))
  assert(claudeContent.name === 'claude', 'claude.json has name=claude')
  assert(claudeContent.command && claudeContent.command.includes('claude'), 'claude.json command includes claude')
  assert(claudeContent.command && claudeContent.command.includes("--model 'claude-opus-4-6[1m]'"), 'claude.json command includes opus model')
  assert(claudeContent.command && claudeContent.command.includes('--fallback-model sonnet'), 'claude.json command includes fallback model')
  assert(claudeContent.command && claudeContent.command.includes('--effort high'), 'claude.json command includes high effort')
  assert(claudeContent.command && claudeContent.command.includes('--output-format stream-json'), 'claude.json command includes stream-json output')
  assert(claudeContent.command && claudeContent.command.includes('--verbose'), 'claude.json command includes verbose stream output')
  assert(claudeContent.command && claudeContent.command.includes('$SPECDEV_FEEDBACK_FILE'), 'claude.json command includes feedback file env var')
  assert(claudeContent.command && claudeContent.command.includes('$SPECDEV_CHANGELOG_FILE'), 'claude.json command includes changelog file env var')
  assert(claudeContent.command && claudeContent.command.includes('--print'), 'claude.json command includes --print')
  assert(claudeContent.command && claudeContent.command.includes('--no-session-persistence'), 'claude.json command includes --no-session-persistence')
  assert(claudeContent.command && claudeContent.command.includes('--dangerously-skip-permissions'), 'claude.json command includes --dangerously-skip-permissions')
  assert(claudeContent.stream_json === true, 'claude.json declares stream_json=true')
  assert(typeof claudeContent.max_rounds === 'number', 'claude.json has numeric max_rounds')
  assert(typeof claudeContent.timeout_seconds === 'number', 'claude.json has numeric timeout_seconds')
  assert(claudeContent.timeout_seconds === 1200, 'claude.json has timeout_seconds=1200')
}

const reviewersReadme = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers', 'README.md')
assert(existsSync(reviewersReadme), 'reviewers README exists')
if (existsSync(reviewersReadme)) {
  const reviewersReadmeContent = readFileSync(reviewersReadme, 'utf-8')
  assert(reviewersReadmeContent.includes('Claude'), 'reviewers README documents Claude')
  assert(reviewersReadmeContent.includes('Codex'), 'reviewers README documents Codex')
  assert(reviewersReadmeContent.includes('reviewer log'), 'reviewers README documents reviewer logs')
  assert(reviewersReadmeContent.includes('heartbeat'), 'reviewers README documents heartbeat')
  assert(reviewersReadmeContent.includes('stream-json'), 'reviewers README documents stream-json')
  assert(reviewersReadmeContent.includes('salvaged from stdout'), 'reviewers README documents strict salvage marker')
  assert(reviewersReadmeContent.includes('SPECDEV_REVIEWER_TIMEOUT'), 'reviewers README documents timeout override')
}

const focusConfig = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'review-focus.json')
assert(existsSync(focusConfig), 'review-focus.json exists after init')

if (existsSync(focusConfig)) {
  const focusContent = JSON.parse(readFileSync(focusConfig, 'utf-8'))
  assert(focusContent.round_focus, 'review-focus.json has round_focus object')
  assert(typeof focusContent.round_focus['1'] === 'string', 'review-focus.json has round 1 focus')
  assert(typeof focusContent.round_focus['2'] === 'string', 'review-focus.json has round 2 focus')
  assert(typeof focusContent.round_focus['3'] === 'string', 'review-focus.json has round 3 focus')
  assert(typeof focusContent.round_focus.default === 'string', 'review-focus.json has default focus')
}

console.log('\nreviewer max_rounds check:')
const reviewersDir = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers')
const reviewerFiles = ['codex.json', 'cursor.json', 'claude.json']
for (const file of reviewerFiles) {
  const filePath = join(reviewersDir, file)
  if (existsSync(filePath)) {
    const content = JSON.parse(readFileSync(filePath, 'utf-8'))
    assert(content.max_rounds === 10, `${file} has max_rounds=10`)
  }
}

const skillContent = readFileSync(skillMd, 'utf-8')
assert(skillContent.includes('type: core'), 'SKILL.md has type: core')
assert(skillContent.includes('name: reviewloop'), 'SKILL.md has name: reviewloop')

const activeToolsPath = join(TEST_DIR, '.specdev', 'skills', 'active-tools.json')
if (existsSync(activeToolsPath)) {
  const activeTools = JSON.parse(readFileSync(activeToolsPath, 'utf-8'))
  assert(activeTools.tools['reviewloop'] === undefined, 'reviewloop not in active-tools.json')
} else {
  assert(true, 'reviewloop not in active-tools.json (no active-tools.json)')
}

const wrapperPath = join(TEST_DIR, '.claude', 'skills', 'reviewloop', 'SKILL.md')
assert(!existsSync(wrapperPath), 'no .claude/skills/reviewloop/ wrapper')

const oldPath = join(TEST_DIR, '.specdev', 'skills', 'tools', 'reviewloop')
assert(!existsSync(oldPath), 'not present at old tools/ path')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
