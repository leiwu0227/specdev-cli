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
