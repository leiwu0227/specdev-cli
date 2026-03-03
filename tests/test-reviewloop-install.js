import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-reviewloop-install-output')

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

// Init project
runCmd(['init', `--target=${TEST_DIR}`])

// Verify reviewloop exists as core skill
console.log('\nreviewloop as core skill:')
const skillMd = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'SKILL.md')
assert(existsSync(skillMd), 'SKILL.md exists at core/ path')

const scriptPath = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'scripts', 'reviewloop.sh')
assert(existsSync(scriptPath), 'reviewloop.sh script exists')

const defaultConfig = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers', 'codex.json')
assert(existsSync(defaultConfig), 'codex.json reviewer config exists')

// Verify frontmatter says core
const skillContent = readFileSync(skillMd, 'utf-8')
assert(skillContent.includes('type: core'), 'SKILL.md has type: core')
assert(skillContent.includes('name: reviewloop'), 'SKILL.md has name: reviewloop')

// No reviewloop in active-tools.json
const activeToolsPath = join(TEST_DIR, '.specdev', 'skills', 'active-tools.json')
if (existsSync(activeToolsPath)) {
  const activeTools = JSON.parse(readFileSync(activeToolsPath, 'utf-8'))
  assert(activeTools.tools['reviewloop'] === undefined, 'reviewloop not in active-tools.json')
} else {
  assert(true, 'reviewloop not in active-tools.json (no active-tools.json)')
}

// No wrapper in .claude/skills/
const wrapperPath = join(TEST_DIR, '.claude', 'skills', 'reviewloop', 'SKILL.md')
assert(!existsSync(wrapperPath), 'no .claude/skills/reviewloop/ wrapper')

// Not in tools/ path
const oldPath = join(TEST_DIR, '.specdev', 'skills', 'tools', 'reviewloop')
assert(!existsSync(oldPath), 'not present at old tools/ path')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
