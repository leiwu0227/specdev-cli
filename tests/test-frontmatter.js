import { parseFrontmatter } from '../src/utils/skills.js'

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

// Existing flat key: value still works
console.log('\nparseFrontmatter — flat values:')
const flat = parseFrontmatter('---\nname: fireperp\ndescription: Web search\ntype: tool\n---\n# Body')
assert(flat.name === 'fireperp', 'parses name')
assert(flat.description === 'Web search', 'parses description')
assert(flat.type === 'tool', 'parses type')

// Inline arrays
console.log('\nparseFrontmatter — inline arrays:')
const withArrays = parseFrontmatter(`---
name: fireperp
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

assert(withArrays.name === 'fireperp', 'still parses flat name')
assert(typeof withArrays.triggers === 'object', 'triggers is an object')
assert(Array.isArray(withArrays.triggers.keywords), 'triggers.keywords is array')
assert(withArrays.triggers.keywords.length === 3, 'triggers.keywords has 3 items')
assert(withArrays.triggers.keywords[0] === 'web search', 'first keyword correct')
assert(Array.isArray(withArrays.triggers.paths), 'triggers.paths is array')
assert(withArrays.triggers.paths.length === 0, 'triggers.paths is empty')
assert(Array.isArray(withArrays.triggers.operations), 'triggers.operations is array')
assert(withArrays.triggers.operations.length === 2, 'triggers.operations has 2 items')

// Nested validation
console.log('\nparseFrontmatter — nested validation:')
assert(typeof withArrays.validation === 'object', 'validation is an object')
assert(Array.isArray(withArrays.validation.env), 'validation.env is array')
assert(withArrays.validation.env[0] === 'PERPLEXITY_API_KEY', 'validation.env value correct')
assert(withArrays.validation.basic === 'which fire', 'validation.basic is string')
assert(withArrays.validation.smoke === "fire perplexity 'test' --max-tokens 10", 'validation.smoke is string')

// No frontmatter
console.log('\nparseFrontmatter — edge cases:')
const none = parseFrontmatter('# No frontmatter here')
assert(Object.keys(none).length === 0, 'returns empty object when no frontmatter')

// Frontmatter with only flat keys (no nested)
const onlyFlat = parseFrontmatter('---\nname: test\nphase: build\n---\n')
assert(onlyFlat.name === 'test', 'flat-only still works')
assert(onlyFlat.phase === 'build', 'flat-only second key')

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
