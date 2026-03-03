import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from '../src/utils/skills.js'
import { readActiveTools, writeActiveTools, addTool, removeTool } from '../src/utils/active-tools.js'
import { detectCodingAgents, AGENT_CONFIGS } from '../src/utils/agents.js'
import { generateWrapperContent, writeWrappers, removeWrappers } from '../src/utils/wrappers.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TEST_DIR = join(__dirname, 'test-utils-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

// =====================================================================
// Frontmatter Tests
// =====================================================================

console.log('\nparseFrontmatter — flat values:')
const flat = parseFrontmatter('---\nname: mock-tool\ndescription: A mock tool\ntype: tool\n---\n# Body')
assert(flat.name === 'mock-tool', 'parses name')
assert(flat.description === 'A mock tool', 'parses description')
assert(flat.type === 'tool', 'parses type')

console.log('\nparseFrontmatter — inline arrays:')
const withArrays = parseFrontmatter(`---
name: mock-tool
triggers:
  keywords: ["web search", "research", "look up"]
  paths: []
  operations: ["brainstorm", "fact-check"]
validation:
  env: ["PERPLEXITY_API_KEY"]
  basic: "which fire"
  smoke: "fire perplexity 'test' --max-tokens 10"
---
# Body`)

assert(withArrays.name === 'mock-tool', 'still parses flat name')
assert(typeof withArrays.triggers === 'object', 'triggers is an object')
assert(Array.isArray(withArrays.triggers.keywords), 'triggers.keywords is array')
assert(withArrays.triggers.keywords.length === 3, 'triggers.keywords has 3 items')
assert(withArrays.triggers.keywords[0] === 'web search', 'first keyword correct')
assert(Array.isArray(withArrays.triggers.paths), 'triggers.paths is array')
assert(withArrays.triggers.paths.length === 0, 'triggers.paths is empty')
assert(Array.isArray(withArrays.triggers.operations), 'triggers.operations is array')
assert(withArrays.triggers.operations.length === 2, 'triggers.operations has 2 items')

console.log('\nparseFrontmatter — nested validation:')
assert(typeof withArrays.validation === 'object', 'validation is an object')
assert(Array.isArray(withArrays.validation.env), 'validation.env is array')
assert(withArrays.validation.env[0] === 'PERPLEXITY_API_KEY', 'validation.env value correct')
assert(withArrays.validation.basic === 'which fire', 'validation.basic is string')
assert(withArrays.validation.smoke === "fire perplexity 'test' --max-tokens 10", 'validation.smoke is string')

console.log('\nparseFrontmatter — edge cases:')
const none = parseFrontmatter('# No frontmatter here')
assert(Object.keys(none).length === 0, 'returns empty object when no frontmatter')

const onlyFlat = parseFrontmatter('---\nname: test\nphase: build\n---\n')
assert(onlyFlat.name === 'test', 'flat-only still works')
assert(onlyFlat.phase === 'build', 'flat-only second key')

// =====================================================================
// Active Tools Tests
// =====================================================================

cleanup()
mkdirSync(join(TEST_DIR, '.specdev', 'skills'), { recursive: true })
const specdevPath = join(TEST_DIR, '.specdev')

console.log('\nreadActiveTools:')
const empty = await readActiveTools(specdevPath)
assert(typeof empty.tools === 'object', 'default has tools object')
assert(Array.isArray(empty.agents), 'default has agents array')
assert(Object.keys(empty.tools).length === 0, 'default tools is empty')

console.log('\nwriteActiveTools:')
const data = { tools: { 'mock-tool': { installed: '2026-02-27', validation: 'smoke', wrappers: ['.claude/skills/mock-tool.md'] } }, agents: ['claude-code'] }
await writeActiveTools(specdevPath, data)
const jsonPath = join(specdevPath, 'skills', 'active-tools.json')
assert(existsSync(jsonPath), 'creates active-tools.json')
const roundtrip = await readActiveTools(specdevPath)
assert(roundtrip.tools['mock-tool'].installed === '2026-02-27', 'roundtrip preserves data')
assert(roundtrip.agents[0] === 'claude-code', 'roundtrip preserves agents')

console.log('\naddTool:')
await addTool(specdevPath, 'newtool', { installed: '2026-02-27', validation: 'basic', wrappers: [] })
const afterAdd = await readActiveTools(specdevPath)
assert(afterAdd.tools.newtool !== undefined, 'addTool adds entry')
assert(afterAdd.tools['mock-tool'] !== undefined, 'addTool preserves existing')

console.log('\nremoveTool:')
await removeTool(specdevPath, 'newtool')
const afterRemove = await readActiveTools(specdevPath)
assert(afterRemove.tools.newtool === undefined, 'removeTool removes entry')
assert(afterRemove.tools['mock-tool'] !== undefined, 'removeTool preserves others')

// =====================================================================
// Agents Tests
// =====================================================================

cleanup()
mkdirSync(TEST_DIR, { recursive: true })

console.log('\ndetectCodingAgents:')
let agents = detectCodingAgents(TEST_DIR)
assert(agents.length === 0, 'no agents detected in empty dir')

mkdirSync(join(TEST_DIR, '.claude'), { recursive: true })
agents = detectCodingAgents(TEST_DIR)
assert(agents.length === 1, 'detects one agent')
assert(agents[0] === 'claude-code', 'detects claude-code')

mkdirSync(join(TEST_DIR, '.codex'), { recursive: true })
agents = detectCodingAgents(TEST_DIR)
assert(agents.length === 2, 'detects two agents')
assert(agents.includes('codex'), 'detects codex')

mkdirSync(join(TEST_DIR, '.opencode'), { recursive: true })
agents = detectCodingAgents(TEST_DIR)
assert(agents.length === 3, 'detects three agents')
assert(agents.includes('opencode'), 'detects opencode')

console.log('\nAGENT_CONFIGS:')
assert(AGENT_CONFIGS['claude-code'].wrapperDir === join('.claude', 'skills'), 'claude-code wrapper dir')
assert(AGENT_CONFIGS['codex'].wrapperDir === join('.codex', 'skills'), 'codex wrapper dir')
assert(AGENT_CONFIGS['opencode'].wrapperDir === join('.claude', 'skills'), 'opencode shares claude wrapper dir')

// =====================================================================
// Wrappers Tests
// =====================================================================

cleanup()
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })
mkdirSync(join(TEST_DIR, '.codex', 'skills'), { recursive: true })

console.log('\ngenerateWrapperContent (fallback):')
const fallback = generateWrapperContent({
  name: 'mock-tool',
  description: 'A mock tool for testing',
  summary: 'A mock tool skill used for testing.',
})
assert(fallback.includes('name: mock-tool'), 'wrapper has name in frontmatter')
assert(fallback.includes('A mock tool for testing'), 'wrapper has description')
assert(fallback.includes('.specdev/skills/tools/mock-tool/SKILL.md'), 'fallback points to source')
assert(fallback.includes('mock tool skill used for testing'), 'wrapper has summary')

console.log('\ngenerateWrapperContent (with body):')
const withBody = generateWrapperContent({
  name: 'mock-tool',
  description: 'A mock tool for testing',
  summary: '',
  body: '# Mock Tool\n\nFull skill content here.',
})
assert(withBody.includes('name: mock-tool'), 'body wrapper has name in frontmatter')
assert(withBody.includes('Full skill content here'), 'body wrapper embeds skill content')
assert(!withBody.includes('Source of truth'), 'body wrapper does not use fallback pointer')

console.log('\nwriteWrappers:')
const wrapperPaths = writeWrappers(TEST_DIR, 'mock-tool', fallback, ['claude-code', 'codex'])
assert(wrapperPaths.length === 2, 'returns 2 wrapper paths')
assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md')), 'claude wrapper exists')
assert(existsSync(join(TEST_DIR, '.codex', 'skills', 'mock-tool', 'SKILL.md')), 'codex wrapper exists')

const claudeWrapper = readFileSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md'), 'utf-8')
assert(claudeWrapper.includes('name: mock-tool'), 'claude wrapper has correct content')

console.log('\nwriteWrappers — deduplication:')
const dedupPaths = writeWrappers(TEST_DIR, 'mock-tool', fallback, ['claude-code', 'opencode'])
assert(dedupPaths.length === 1, 'deduplicates shared wrapper path')

console.log('\nremoveWrappers:')
removeWrappers(TEST_DIR, wrapperPaths)
assert(!existsSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md')), 'claude wrapper removed')
assert(!existsSync(join(TEST_DIR, '.codex', 'skills', 'mock-tool', 'SKILL.md')), 'codex wrapper removed')

removeWrappers(TEST_DIR, ['.claude/skills/nonexistent.md'])
assert(true, 'removeWrappers handles missing files without error')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
