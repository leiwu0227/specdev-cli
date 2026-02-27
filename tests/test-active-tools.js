import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readActiveTools, writeActiveTools, addTool, removeTool } from '../src/utils/active-tools.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TEST_DIR = join(__dirname, 'test-active-tools-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

cleanup()
mkdirSync(join(TEST_DIR, '.specdev', 'skills'), { recursive: true })
const specdevPath = join(TEST_DIR, '.specdev')

// readActiveTools returns default when file doesn't exist
console.log('\nreadActiveTools:')
const empty = await readActiveTools(specdevPath)
assert(typeof empty.tools === 'object', 'default has tools object')
assert(Array.isArray(empty.agents), 'default has agents array')
assert(Object.keys(empty.tools).length === 0, 'default tools is empty')

// writeActiveTools and readActiveTools roundtrip
console.log('\nwriteActiveTools:')
const data = { tools: { fireperp: { installed: '2026-02-27', validation: 'smoke', wrappers: ['.claude/skills/fireperp.md'] } }, agents: ['claude-code'] }
await writeActiveTools(specdevPath, data)
const jsonPath = join(specdevPath, 'skills', 'active-tools.json')
assert(existsSync(jsonPath), 'creates active-tools.json')
const roundtrip = await readActiveTools(specdevPath)
assert(roundtrip.tools.fireperp.installed === '2026-02-27', 'roundtrip preserves data')
assert(roundtrip.agents[0] === 'claude-code', 'roundtrip preserves agents')

// addTool
console.log('\naddTool:')
await addTool(specdevPath, 'newtool', { installed: '2026-02-27', validation: 'basic', wrappers: [] })
const afterAdd = await readActiveTools(specdevPath)
assert(afterAdd.tools.newtool !== undefined, 'addTool adds entry')
assert(afterAdd.tools.fireperp !== undefined, 'addTool preserves existing')

// removeTool
console.log('\nremoveTool:')
await removeTool(specdevPath, 'newtool')
const afterRemove = await readActiveTools(specdevPath)
assert(afterRemove.tools.newtool === undefined, 'removeTool removes entry')
assert(afterRemove.tools.fireperp !== undefined, 'removeTool preserves others')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
