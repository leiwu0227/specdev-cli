import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateWrapperContent, writeWrappers, removeWrappers } from '../src/utils/wrappers.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TEST_DIR = join(__dirname, 'test-wrappers-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

cleanup()
mkdirSync(join(TEST_DIR, '.claude', 'skills'), { recursive: true })
mkdirSync(join(TEST_DIR, '.codex', 'skills'), { recursive: true })

// generateWrapperContent
console.log('\ngenerateWrapperContent:')
const content = generateWrapperContent({
  name: 'fireperp',
  description: 'Web search via Perplexity API',
  summary: 'Use for researching topics, looking up API docs, verifying facts.',
})
assert(content.includes('name: fireperp'), 'wrapper has name in frontmatter')
assert(content.includes('Web search via Perplexity API'), 'wrapper has description')
assert(content.includes('.specdev/skills/tools/fireperp/SKILL.md'), 'wrapper points to source')
assert(content.includes('researching topics'), 'wrapper has summary')

// writeWrappers
console.log('\nwriteWrappers:')
const wrapperPaths = writeWrappers(TEST_DIR, 'fireperp', content, ['claude-code', 'codex'])
assert(wrapperPaths.length === 2, 'returns 2 wrapper paths')
assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md')), 'claude wrapper exists')
assert(existsSync(join(TEST_DIR, '.codex', 'skills', 'fireperp', 'SKILL.md')), 'codex wrapper exists')

const claudeWrapper = readFileSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md'), 'utf-8')
assert(claudeWrapper.includes('name: fireperp'), 'claude wrapper has correct content')

// writeWrappers deduplicates shared paths (claude-code and opencode)
console.log('\nwriteWrappers — deduplication:')
const dedupPaths = writeWrappers(TEST_DIR, 'fireperp', content, ['claude-code', 'opencode'])
assert(dedupPaths.length === 1, 'deduplicates shared wrapper path')

// removeWrappers
console.log('\nremoveWrappers:')
removeWrappers(TEST_DIR, wrapperPaths)
assert(!existsSync(join(TEST_DIR, '.claude', 'skills', 'fireperp.md')), 'claude wrapper removed')
assert(!existsSync(join(TEST_DIR, '.codex', 'skills', 'fireperp', 'SKILL.md')), 'codex wrapper removed')

// removeWrappers handles missing files gracefully
removeWrappers(TEST_DIR, ['.claude/skills/nonexistent.md'])
assert(true, 'removeWrappers handles missing files without error')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
