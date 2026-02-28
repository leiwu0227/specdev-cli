import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMockToolSkill } from './helpers.js'

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
createMockToolSkill(TEST_DIR, 'mock-tool')

// Create .claude dir (simulating agent installed)
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })

// Install with --skills flag
console.log('\nskills install (with --skills):')
let result = runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=mock-tool', '--agents=claude-code'])
assert(result.status === 0, 'install succeeds')

// Wrapper created
assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md')), 'wrapper created for claude-code')
const wrapper = readFileSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md'), 'utf-8')
assert(wrapper.includes('name: mock-tool'), 'wrapper has name')
assert(wrapper.includes('Mock Tool') || wrapper.includes('mock-tool'), 'wrapper embeds skill content')

// active-tools.json updated
const activeToolsPath = join(TEST_DIR, '.specdev', 'skills', 'active-tools.json')
assert(existsSync(activeToolsPath), 'active-tools.json created')
const activeTools = JSON.parse(readFileSync(activeToolsPath, 'utf-8'))
assert(activeTools.tools['mock-tool'] !== undefined, 'mock-tool in active tools')
assert(activeTools.tools['mock-tool'].wrappers.length > 0, 'wrappers tracked')
assert(activeTools.agents.includes('claude-code'), 'agents recorded')

// Install unknown skill fails
console.log('\nskills install (unknown skill):')
result = runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=nonexistent', '--agents=claude-code'])
assert(result.status === 1, 'install fails for unknown skill')

// Install with multiple agents
console.log('\nskills install (multiple agents):')
mkdirSync(join(TEST_DIR, '.codex', 'skills'), { recursive: true })
result = runCmd(['skills', 'install', `--target=${TEST_DIR}`, '--skills=mock-tool', '--agents=claude-code,codex'])
assert(result.status === 0, 'install with multiple agents succeeds')
assert(existsSync(join(TEST_DIR, '.codex', 'skills', 'mock-tool', 'SKILL.md')), 'codex wrapper created')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
