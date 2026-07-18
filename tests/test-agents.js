import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectCodingAgents, AGENT_CONFIGS } from '../src/utils/agents.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TEST_DIR = join(__dirname, 'test-agents-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

// No agents
cleanup()
mkdirSync(TEST_DIR, { recursive: true })
console.log('\ndetectCodingAgents:')
let agents = detectCodingAgents(TEST_DIR)
assert(agents.length === 0, 'no agents detected in empty dir')

// Claude Code only
mkdirSync(join(TEST_DIR, '.claude'), { recursive: true })
agents = detectCodingAgents(TEST_DIR)
assert(agents.length === 1, 'detects one agent')
assert(agents[0] === 'claude-code', 'detects claude-code')

// Claude Code + Codex
mkdirSync(join(TEST_DIR, '.codex'), { recursive: true })
agents = detectCodingAgents(TEST_DIR)
assert(agents.length === 2, 'detects two agents')
assert(agents.includes('codex'), 'detects codex')

// All three
mkdirSync(join(TEST_DIR, '.opencode'), { recursive: true })
agents = detectCodingAgents(TEST_DIR)
assert(agents.length === 3, 'detects three agents')
assert(agents.includes('opencode'), 'detects opencode')

// AGENT_CONFIGS has wrapper paths
console.log('\nAGENT_CONFIGS:')
assert(AGENT_CONFIGS['claude-code'].wrapperDir === join('.claude', 'skills'), 'claude-code wrapper dir')
assert(AGENT_CONFIGS['codex'].wrapperDir === join('.codex', 'skills'), 'codex wrapper dir')
assert(AGENT_CONFIGS['opencode'].wrapperDir === join('.claude', 'skills'), 'opencode shares claude wrapper dir')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
