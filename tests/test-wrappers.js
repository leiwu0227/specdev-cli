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

// generateWrapperContent — fallback (no body)
console.log('\ngenerateWrapperContent (fallback):')
const fallback = generateWrapperContent({
  name: 'mock-tool',
  description: 'A mock tool for testing',
  summary: 'A mock tool skill used for testing.',
})
assert(fallback.includes('name: mock-tool'), 'wrapper has name in frontmatter')
assert(fallback.includes('A mock tool for testing'), 'wrapper has description')
assert(fallback.includes('.specdev/skills/tools/mock-tool/SKILL.md'), 'fallback points to source')
assert(fallback.includes('researching topics'), 'wrapper has summary')

// generateWrapperContent — with body
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

// writeWrappers — claude-code uses folder/SKILL.md, codex uses folder/SKILL.md
console.log('\nwriteWrappers:')
const wrapperPaths = writeWrappers(TEST_DIR, 'mock-tool', fallback, ['claude-code', 'codex'])
assert(wrapperPaths.length === 2, 'returns 2 wrapper paths')
assert(existsSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md')), 'claude wrapper exists')
assert(existsSync(join(TEST_DIR, '.codex', 'skills', 'mock-tool', 'SKILL.md')), 'codex wrapper exists')

const claudeWrapper = readFileSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md'), 'utf-8')
assert(claudeWrapper.includes('name: mock-tool'), 'claude wrapper has correct content')

// writeWrappers deduplicates shared paths (claude-code and opencode)
console.log('\nwriteWrappers — deduplication:')
const dedupPaths = writeWrappers(TEST_DIR, 'mock-tool', fallback, ['claude-code', 'opencode'])
assert(dedupPaths.length === 1, 'deduplicates shared wrapper path')

// removeWrappers
console.log('\nremoveWrappers:')
removeWrappers(TEST_DIR, wrapperPaths)
assert(!existsSync(join(TEST_DIR, '.claude', 'skills', 'mock-tool', 'SKILL.md')), 'claude wrapper removed')
assert(!existsSync(join(TEST_DIR, '.codex', 'skills', 'mock-tool', 'SKILL.md')), 'codex wrapper removed')

// removeWrappers handles missing files gracefully
removeWrappers(TEST_DIR, ['.claude/skills/nonexistent.md'])
assert(true, 'removeWrappers handles missing files without error')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
