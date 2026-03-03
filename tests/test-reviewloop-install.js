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

// Create .claude dir (simulate agent)
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })

// Verify reviewloop skill exists in templates after init
console.log('\nreviewloop skill discovery:')
const skillMd = join(TEST_DIR, '.specdev', 'skills', 'tools', 'reviewloop', 'SKILL.md')
assert(existsSync(skillMd), 'SKILL.md exists after init')

const scriptPath = join(TEST_DIR, '.specdev', 'skills', 'tools', 'reviewloop', 'scripts', 'reviewloop.sh')
assert(existsSync(scriptPath), 'reviewloop.sh script exists after init')

const defaultConfig = join(TEST_DIR, '.specdev', 'skills', 'tools', 'reviewloop', 'reviewers', 'codex.json')
assert(existsSync(defaultConfig), 'codex.json exists after init')

// Install the skill
console.log('\nreviewloop skill install:')
let result = runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=reviewloop', '--agents=claude-code'])
assert(result.status === 0, 'install succeeds')

// Wrapper created
const wrapperPath = join(TEST_DIR, '.claude', 'skills', 'reviewloop', 'SKILL.md')
assert(existsSync(wrapperPath), 'wrapper created for claude-code')

const wrapper = readFileSync(wrapperPath, 'utf-8')
assert(wrapper.includes('name: reviewloop'), 'wrapper has name')
assert(wrapper.includes('.specdev/skills/tools/reviewloop/SKILL.md'), 'wrapper points to source')

// active-tools.json updated
const activeToolsPath = join(TEST_DIR, '.specdev', 'skills', 'active-tools.json')
assert(existsSync(activeToolsPath), 'active-tools.json created')
const activeTools = JSON.parse(readFileSync(activeToolsPath, 'utf-8'))
assert(activeTools.tools['reviewloop'] !== undefined, 'reviewloop in active tools')
assert(activeTools.tools['reviewloop'].wrappers.length > 0, 'wrappers tracked')

// Verify skill frontmatter is parseable
const skillContent = readFileSync(skillMd, 'utf-8')
assert(skillContent.includes('name: reviewloop'), 'SKILL.md has name in frontmatter')
assert(skillContent.includes('type: tool'), 'SKILL.md has type: tool')
assert(skillContent.includes('triggers:'), 'SKILL.md has triggers')

// Skills list shows reviewloop
console.log('\nskills list:')
result = runCmd(['skills', `--target=${TEST_DIR}`])
assert(result.status === 0, 'skills list command succeeds')

// Sync works with reviewloop installed
console.log('\nskills sync:')
result = runCmd(['skills', 'sync', `--target=${TEST_DIR}`])
assert(result.status === 0, 'sync succeeds with reviewloop installed')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
