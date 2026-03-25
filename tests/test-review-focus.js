import { existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveRoundFocus } from '../src/utils/review-focus.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TEST_DIR = join(__dirname, 'test-review-focus-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true }) }

cleanup()

// Setup: create a test review-focus.json
const reviewloopDir = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop')
mkdirSync(reviewloopDir, { recursive: true })

const focusConfig = {
  round_focus: {
    '1': 'Architecture focus',
    '2': 'Efficiency focus',
    '3': 'Domain focus',
    'default': 'General focus'
  }
}
writeFileSync(join(reviewloopDir, 'review-focus.json'), JSON.stringify(focusConfig))

console.log('\nresolveRoundFocus — with config:')
const specdevPath = join(TEST_DIR, '.specdev')

let result = await resolveRoundFocus(specdevPath, 1)
assert(result === 'Architecture focus', 'round 1 returns architecture focus')

result = await resolveRoundFocus(specdevPath, 2)
assert(result === 'Efficiency focus', 'round 2 returns efficiency focus')

result = await resolveRoundFocus(specdevPath, 3)
assert(result === 'Domain focus', 'round 3 returns domain focus')

result = await resolveRoundFocus(specdevPath, 4)
assert(result === 'General focus', 'round 4 falls back to default')

result = await resolveRoundFocus(specdevPath, 5)
assert(result === 'General focus', 'round 5 falls back to default')

// Test missing file
console.log('\nresolveRoundFocus — missing file:')
const emptyDir = join(TEST_DIR, 'empty', '.specdev')
mkdirSync(emptyDir, { recursive: true })
result = await resolveRoundFocus(emptyDir, 1)
assert(result === '', 'missing file returns empty string')

// Test malformed JSON
console.log('\nresolveRoundFocus — malformed JSON:')
const badDir = join(TEST_DIR, 'bad', '.specdev', 'skills', 'core', 'reviewloop')
mkdirSync(badDir, { recursive: true })
writeFileSync(join(badDir, 'review-focus.json'), '{invalid json}')
result = await resolveRoundFocus(join(TEST_DIR, 'bad', '.specdev'), 1)
assert(result === '', 'malformed JSON returns empty string')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
