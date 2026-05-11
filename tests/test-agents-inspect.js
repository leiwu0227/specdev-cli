import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const CLI = join(ROOT, 'bin', 'specdev.js')
const TEST_DIR = join(__dirname, 'test-agents-inspect-output')

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

function runSpecdev(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf-8',
    cwd: options.cwd || ROOT,
  })
}

function cleanup() {
  rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(TEST_DIR, { recursive: true })
}

function writeAgent(dir, content = null) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'output-schema.json'), JSON.stringify({
    type: 'object',
    required: ['status'],
    properties: { status: { enum: ['ok'] } },
  }, null, 2))
  writeFileSync(join(dir, 'agent.md'), content || `---
name: inspectable
description: Inspectable agent
input:
  topic: { type: string, required: true }
output:
  schema: ./output-schema.json
  format: Markdown plus JSON
runners:
  codex:
    command: codex
    args: [exec, "-"]
    prompt: { mode: stdin }
    timeout_ms: 300000
---

Prompt body
`)
  return join(dir, 'agent.md')
}

cleanup()

console.log('\nagents inspect human output:')
{
  const agentPath = writeAgent(join(TEST_DIR, 'valid'))
  const result = runSpecdev(['agents', 'inspect', agentPath])
  assert(result.status === 0, 'inspect valid agent exits 0', result.stderr || result.stdout)
  assert(result.stdout.includes('inspectable'), 'human output includes name')
  assert(result.stdout.includes('Inspectable agent'), 'human output includes description')
  assert(result.stdout.includes('output-schema.json'), 'human output includes schema path')
}

console.log('\nagents inspect json output:')
{
  const agentPath = writeAgent(join(TEST_DIR, 'json'))
  const result = runSpecdev(['agents', 'inspect', agentPath, '--json'])
  assert(result.status === 0, 'inspect --json exits 0', result.stderr || result.stdout)
  const payload = JSON.parse(result.stdout)
  assert(payload.command === 'agents inspect', 'json command identifies agents inspect')
  assert(payload.name === 'inspectable', 'json includes name')
  assert(payload.description === 'Inspectable agent', 'json includes description')
  assert(payload.runners.codex.command === 'codex', 'json includes runners')
}

console.log('\nagents inspect malformed and missing:')
{
  const badPath = writeAgent(join(TEST_DIR, 'bad'), `---
description: Bad agent
output:
  schema: ./output-schema.json
---

Bad
`)
  let result = runSpecdev(['agents', 'inspect', badPath])
  assert(result.status !== 0, 'malformed agent exits non-zero')
  assert(/Invalid agent spec|metadata/i.test(`${result.stdout}\n${result.stderr}`), 'malformed output mentions validation')

  result = runSpecdev(['agents', 'inspect', join(TEST_DIR, 'missing.md')])
  assert(result.status !== 0, 'missing path exits non-zero')
  assert(/not found|no such/i.test(`${result.stdout}\n${result.stderr}`), 'missing path output is clear')
}

console.log('\nagents inspect template researcher:')
{
  const result = runSpecdev(['agents', 'inspect', 'templates/.specdev/agents/researcher/agent.md', '--json'])
  assert(result.status === 0, 'template researcher validates', result.stderr || result.stdout)
  const payload = JSON.parse(result.stdout)
  assert(payload.name === 'researcher', 'template json includes researcher name')
  assert(existsSync(payload.schema_path), 'template schema path exists')
}

console.log(`\n${passes} passed, ${failures} failed`)
cleanup()
process.exit(failures > 0 ? 1 : 0)
