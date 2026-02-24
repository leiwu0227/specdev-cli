import { existsSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEMPLATES_DIR = join(__dirname, '..', 'templates', '.specdev', 'skills', 'tools', 'fireperp')
const TEST_DIR = './test-fireperp-skill-output'

let failures = 0
let passes = 0

function assert(condition, msg, detail = '') {
  if (!condition) {
    console.error(`  FAIL ${msg}`)
    if (detail) console.error(`       ${detail}`)
    failures++
  } else {
    console.log(`  PASS ${msg}`)
    passes++
  }
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

// --- Test 1: SKILL.md exists and has valid frontmatter ---

console.log('SKILL.md structure:')
const skillMd = join(TEMPLATES_DIR, 'SKILL.md')
assert(existsSync(skillMd), 'SKILL.md exists')

if (existsSync(skillMd)) {
  const content = readFileSync(skillMd, 'utf-8')
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  assert(fmMatch !== null, 'has YAML frontmatter')
  if (fmMatch) {
    assert(fmMatch[1].includes('name: fireperp'), 'frontmatter has name: fireperp')
    assert(fmMatch[1].includes('type: tool'), 'frontmatter has type: tool')
    assert(fmMatch[1].includes('description:'), 'frontmatter has description')
  }
}

// --- Test 2: search.sh exists and is executable ---

console.log('\nsearch.sh:')
const searchSh = join(TEMPLATES_DIR, 'scripts', 'search.sh')
assert(existsSync(searchSh), 'scripts/search.sh exists')

if (existsSync(searchSh)) {
  const stat = spawnSync('test', ['-x', searchSh])
  assert(stat.status === 0, 'search.sh is executable')
}

// --- Test 3: perplexity-search.mjs exists ---

console.log('\nperplexity-search.mjs:')
const searchMjs = join(TEMPLATES_DIR, 'scripts', 'perplexity-search.mjs')
assert(existsSync(searchMjs), 'scripts/perplexity-search.mjs exists')

// --- Test 4: search.sh fails with clear error when no query ---

console.log('\nno-query error:')
const noQuery = spawnSync('bash', [searchSh], {
  encoding: 'utf-8',
  env: { ...process.env, PERPLEXITY_API_KEY: 'pplx-test' },
})
assert(noQuery.status !== 0, 'exits non-zero without query')
assert(noQuery.stderr.includes('query'), 'stderr mentions query')

// --- Test 5: search.sh fails with clear error when PERPLEXITY_API_KEY not set ---

console.log('\nno-api-key error:')
const envWithoutKey = { ...process.env }
delete envWithoutKey.PERPLEXITY_API_KEY
const noKey = spawnSync('bash', [searchSh, 'test query'], {
  encoding: 'utf-8',
  env: envWithoutKey,
})
assert(noKey.status !== 0, 'exits non-zero without API key')
assert(noKey.stderr.includes('PERPLEXITY_API_KEY'), 'stderr mentions PERPLEXITY_API_KEY')

// --- Test 6: init installs fireperp tool skill ---

console.log('\ninit includes fireperp skill:')
cleanup()
const initResult = spawnSync('node', [CLI, 'init', `--target=${TEST_DIR}`], { encoding: 'utf-8' })
assert(initResult.status === 0, 'init succeeds')

const skillsResult = spawnSync('node', [CLI, 'skills', `--target=${TEST_DIR}`], { encoding: 'utf-8' })
assert(skillsResult.status === 0, 'skills command succeeds')
const fireperpSkillPath = join(TEST_DIR, '.specdev', 'skills', 'tools', 'fireperp', 'SKILL.md')
assert(existsSync(fireperpSkillPath), 'fireperp skill installed in .specdev/skills/tools')

cleanup()

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
