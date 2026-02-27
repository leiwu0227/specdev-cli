import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-skills-install-output')

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
runCmd(['init', `--target=${TEST_DIR}`])

// Create .claude dir (simulating agent installed)
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })

// Non-interactive install with --skills and --agents flags
console.log('\nskills install (non-interactive):')
let result = runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=fireperp', '--agents=claude-code'])
assert(result.status === 0, 'install succeeds')

// Wrapper created
assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md')), 'wrapper created for claude-code')
const wrapper = readFileSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md'), 'utf-8')
assert(wrapper.includes('name: fireperp'), 'wrapper has name')
assert(wrapper.includes('.specdev/skills/tools/fireperp/SKILL.md'), 'wrapper points to source')

// active-tools.json updated
const activeToolsPath = join(TEST_DIR, '.specdev', 'skills', 'active-tools.json')
assert(existsSync(activeToolsPath), 'active-tools.json created')
const activeTools = JSON.parse(readFileSync(activeToolsPath, 'utf-8'))
assert(activeTools.tools.fireperp !== undefined, 'fireperp in active tools')
assert(activeTools.tools.fireperp.wrappers.length > 0, 'wrappers tracked')
assert(activeTools.agents.includes('claude-code'), 'agents recorded')

// Install unknown skill fails
console.log('\nskills install (unknown skill):')
result = runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=nonexistent', '--agents=claude-code'])
assert(result.status === 1, 'install fails for unknown skill')

// Install with multiple agents
console.log('\nskills install (multiple agents):')
mkdirSync(join(TEST_DIR, '.codex', 'skills'), { recursive: true })
result = runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=fireperp', '--agents=claude-code,codex'])
assert(result.status === 0, 'install with multiple agents succeeds')
assert(existsSync(join(TEST_DIR, '.codex', 'skills', 'fireperp', 'SKILL.md')), 'codex wrapper created')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
