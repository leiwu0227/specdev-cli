import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT = join(__dirname, '..', 'templates', '.specdev', 'skills', 'core', 'reviewloop', 'scripts', 'reviewloop.sh')
const CLI = join(__dirname, '..', 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-reviewloop-output')

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL ${msg}`); failures++ }
  else { console.log(`  PASS ${msg}`); passes++ }
}

function cleanup() { if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true }) }

function setupReviewerConfig(name, config) {
  const dir = join(TEST_DIR, 'reviewers')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(config), 'utf-8')
}

function setupGitRepo() {
  spawnSync('git', ['init'], { cwd: TEST_DIR })
  spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: TEST_DIR })
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: TEST_DIR })
  writeFileSync(join(TEST_DIR, 'file.js'), 'const x = 1\n')
  spawnSync('git', ['add', '.'], { cwd: TEST_DIR })
  spawnSync('git', ['commit', '-m', 'init'], { cwd: TEST_DIR })
  writeFileSync(join(TEST_DIR, 'file.js'), 'const x = 2\n')
}

function runScript(args) {
  return spawnSync('bash', [SCRIPT, ...args], {
    encoding: 'utf-8',
    cwd: TEST_DIR,
    env: { ...process.env, REVIEWLOOP_REVIEWERS_DIR: join(TEST_DIR, 'reviewers') },
  })
}

function runCmd(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf-8' })
}

// =====================================================================
// Reviewloop Script Tests
// =====================================================================

cleanup()
mkdirSync(TEST_DIR, { recursive: true })

console.log('\nreviewloop.sh (missing reviewer):')
let result = runScript([])
assert(result.status === 1, 'exits 1 without --reviewer')

console.log('\nreviewloop.sh (missing reviewer value):')
result = runScript(['--reviewer'])
assert(result.status === 1, 'exits 1 when --reviewer value is missing')
assert(result.stderr.includes('--reviewer requires a value'), 'error mentions missing reviewer value')

console.log('\nreviewloop.sh (missing round value):')
result = runScript(['--reviewer', 'nonexistent', '--round'])
assert(result.status === 1, 'exits 1 when --round value is missing')
assert(result.stderr.includes('--round requires a value'), 'error mentions missing round value')

console.log('\nreviewloop.sh (unknown reviewer):')
result = runScript(['--reviewer', 'nonexistent', '--round', '1'])
assert(result.status === 1, 'exits 1 for unknown reviewer')
assert(result.stderr.includes('not found'), 'error mentions config not found')

console.log('\nreviewloop.sh (invalid round):')
result = runScript(['--reviewer', 'nonexistent', '--round', 'abc'])
assert(result.status === 1, 'exits 1 for non-numeric round')
assert(result.stderr.includes('positive integer'), 'error mentions positive integer round')

console.log('\nreviewloop.sh (pass verdict):')
setupGitRepo()
setupReviewerConfig('echo-pass', {
  name: 'echo-pass',
  command: "echo 'LGTM, code looks good'",

  max_rounds: 3,
})
result = runScript(['--reviewer', 'echo-pass', '--round', '1'])
assert(result.status === 0, 'exits 0')
let json = JSON.parse(result.stdout)
assert(json.verdict === 'pass', 'verdict is pass')
assert(json.round === 1, 'round is 1')
assert(json.escalate === false, 'escalate is false')

console.log('\nreviewloop.sh (fail verdict):')
setupReviewerConfig('echo-fail', {
  name: 'echo-fail',
  command: "echo 'needs changes: missing error handling'",

  max_rounds: 3,
})
result = runScript(['--reviewer', 'echo-fail', '--round', '1'])
assert(result.status === 0, 'exits 0')
json = JSON.parse(result.stdout)
assert(json.verdict === 'fail', 'verdict is fail')
assert(json.escalate === false, 'escalate is false on round 1')
assert(json.findings.includes('missing error handling'), 'findings contain reviewer output')

console.log('\nreviewloop.sh (escalation):')
result = runScript(['--reviewer', 'echo-fail', '--round', '3'])
assert(result.status === 0, 'exits 0')
json = JSON.parse(result.stdout)
assert(json.verdict === 'fail', 'verdict is fail')
assert(json.escalate === true, 'escalate is true at max rounds')

console.log('\nreviewloop.sh (ambiguous output):')
setupReviewerConfig('echo-ambiguous', {
  name: 'echo-ambiguous',
  command: "echo 'I have some thoughts about this code'",

  max_rounds: 3,
})
result = runScript(['--reviewer', 'echo-ambiguous', '--round', '1'])
assert(result.status === 0, 'exits 0')
json = JSON.parse(result.stdout)
assert(json.verdict === 'fail', 'ambiguous defaults to fail')

console.log('\nreviewloop.sh (command failure):')
setupReviewerConfig('bad-cmd', {
  name: 'bad-cmd',
  command: 'nonexistent-binary-xyz',

  max_rounds: 3,
})
result = runScript(['--reviewer', 'bad-cmd', '--round', '1'])
assert(result.status === 1, 'exits 1 when reviewer command fails')

console.log('\nreviewloop.sh (multi-line output):')
setupReviewerConfig('multiline', {
  name: 'multiline',
  command: "printf 'line1\\nneeds changes:\\n- fix error handling\\n- add tests'",

  max_rounds: 3,
})
result = runScript(['--reviewer', 'multiline', '--round', '1'])
assert(result.status === 0, 'exits 0')
json = JSON.parse(result.stdout)
assert(json.verdict === 'fail', 'verdict is fail for multi-line output')
assert(json.findings.includes('fix error handling'), 'findings preserve multi-line content')
assert(json.findings.includes('add tests'), 'findings preserve all lines')

console.log('\nreviewloop.sh (special JSON chars):')
setupReviewerConfig('json-chars', {
  name: 'json-chars',
  command: "echo \"needs changes: use \\\"const\\\" instead of \\\"var\\\"\"",

  max_rounds: 3,
})
result = runScript(['--reviewer', 'json-chars', '--round', '1'])
assert(result.status === 0, 'exits 0')
json = JSON.parse(result.stdout)
assert(json.verdict === 'fail', 'verdict is fail')
assert(json.findings.includes('const'), 'findings preserve content with quotes')

console.log('\nreviewloop.sh (missing command field):')
setupReviewerConfig('missing-command', {
  name: 'missing-command',

  max_rounds: 3,
})
result = runScript(['--reviewer', 'missing-command', '--round', '1'])
assert(result.status === 1, 'exits 1 when command field is missing')
assert(result.stderr.includes("missing required field 'command'"), 'error mentions missing command field')

// =====================================================================
// Reviewloop Install Tests
// =====================================================================

cleanup()
runCmd(['init', `--target=${TEST_DIR}`])

console.log('\nreviewloop as core skill:')
const skillMd = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'SKILL.md')
assert(existsSync(skillMd), 'SKILL.md exists at core/ path')

const scriptPath = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'scripts', 'reviewloop.sh')
assert(existsSync(scriptPath), 'reviewloop.sh script exists')

const defaultConfig = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers', 'codex.json')
assert(existsSync(defaultConfig), 'codex.json reviewer config exists')

const skillContent = readFileSync(skillMd, 'utf-8')
assert(skillContent.includes('type: core'), 'SKILL.md has type: core')
assert(skillContent.includes('name: reviewloop'), 'SKILL.md has name: reviewloop')

const activeToolsPath = join(TEST_DIR, '.specdev', 'skills', 'active-tools.json')
if (existsSync(activeToolsPath)) {
  const activeTools = JSON.parse(readFileSync(activeToolsPath, 'utf-8'))
  assert(activeTools.tools['reviewloop'] === undefined, 'reviewloop not in active-tools.json')
} else {
  assert(true, 'reviewloop not in active-tools.json (no active-tools.json)')
}

const wrapperPath = join(TEST_DIR, '.claude', 'skills', 'reviewloop', 'SKILL.md')
assert(!existsSync(wrapperPath), 'no .claude/skills/reviewloop/ wrapper')

const oldPath = join(TEST_DIR, '.specdev', 'skills', 'tools', 'reviewloop')
assert(!existsSync(oldPath), 'not present at old tools/ path')

cleanup()
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
