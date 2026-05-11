import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runAgent } from '../src/utils/agent-runner.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TEST_DIR = join(__dirname, 'test-agent-runner-output')

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
  rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(TEST_DIR, { recursive: true })
}

function writeAgent({ name = 'agent', prompt = '{ mode: stdin }', stream = '' } = {}) {
  const dir = join(TEST_DIR, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'output-schema.json'), JSON.stringify({
    type: 'object',
    required: ['topic', 'scope_used', 'sources', 'findings_word_count', 'confidence', 'status'],
    properties: {
      topic: { type: 'string' },
      scope_used: { type: 'array', items: { enum: ['repo', 'knowledge', 'web'] } },
      sources: { type: 'array' },
      findings_word_count: { type: 'integer' },
      confidence: { enum: ['high', 'medium', 'low'] },
      status: { enum: ['ok', 'partial', 'failed'] },
    },
    additionalProperties: false,
  }, null, 2))
  writeFileSync(join(dir, 'agent.md'), `---
description: Test agent
input:
  topic: { type: string, required: true }
output:
  schema: ./output-schema.json
  format: Markdown plus final JSON
runners:
  test:
    command: ${process.execPath}
    args: [${JSON.stringify(join(TEST_DIR, 'stub.js'))}]
    prompt: ${prompt}
${stream}
    timeout_ms: 5000
---
Topic: {{topic}}
Scope: {{scope}}
Context: {{context}}
`)
  return join(dir, 'agent.md')
}

function writeStub() {
  writeFileSync(join(TEST_DIR, 'stub.js'), `
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
const stdin = readFileSync(0, 'utf-8')
const path = process.env.INVOCATION_PATH
const previous = path && process.env.INVOCATION_APPEND === '1' && existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : []
previous.push({ argv: process.argv.slice(2), cwd: process.cwd(), stdin })
if (path) writeFileSync(path, JSON.stringify(previous, null, 2))
if (process.env.RETRY_ONCE === '1' && previous.length === 1) {
  console.log('## Topic\\n\\nBad output without JSON')
  process.exit(0)
}
const markdown = '## Topic\\n\\nAgent Runner\\n\\n## Scope Used\\n\\nrepo\\n\\n## Findings\\n\\nWorks.\\n\\n## Sources\\n\\n- repo: stub\\n\\n## Limitations\\n\\nNone.\\n\\n' +
  '\`\`\`json\\n{"topic":"Agent Runner","scope_used":["repo"],"sources":[],"findings_word_count":1,"confidence":"high","status":"ok"}\\n\`\`\`\\n'
if (process.env.STREAM_JSON === '1') {
  process.stdout.write(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: markdown }] } }) + '\\n')
} else {
  process.stdout.write(markdown)
}
`)
}

async function runWith(prompt, env = {}) {
  const specPath = writeAgent(prompt)
  const artifactPath = join(TEST_DIR, `${prompt.name || 'agent'}.md`)
  const result = await runAgent(specPath, {
    topic: 'Agent Runner',
    scope: 'repo',
    context: 'local context',
  }, {
    artifactPath,
    platform: 'test',
    cwd: TEST_DIR,
    env: { ...process.env, ...env },
    maxRetries: 1,
  })
  return { result, artifactPath }
}

cleanup()
writeStub()

console.log('\nagent runner parses and validates spec:')
{
  const invocationPath = join(TEST_DIR, 'parse-invocation.json')
  const { result, artifactPath } = await runWith({ name: 'parse', prompt: '{ mode: stdin }' }, { INVOCATION_PATH: invocationPath })
  assert(result.exitCode === 0, 'valid spec exits 0')
  assert(result.parsedOutput.status === 'ok', 'parsed JSON output is returned')
  assert(readFileSync(artifactPath, 'utf-8').includes('## Topic'), 'artifact contains rendered markdown')
}

console.log('\nagent runner prompt transports:')
{
  let invocationPath = join(TEST_DIR, 'append-invocation.json')
  await runWith({ name: 'append', prompt: '{ mode: append_arg }' }, { INVOCATION_PATH: invocationPath })
  let calls = JSON.parse(readFileSync(invocationPath, 'utf-8'))
  assert(calls[0].argv.some(value => value.includes('Topic: Agent Runner')), 'append_arg passes rendered prompt in argv')
  assert(calls[0].stdin === '', 'append_arg does not write stdin')

  invocationPath = join(TEST_DIR, 'flag-invocation.json')
  await runWith({ name: 'flag', prompt: '{ mode: flag_arg, flag: "-p" }' }, { INVOCATION_PATH: invocationPath })
  calls = JSON.parse(readFileSync(invocationPath, 'utf-8'))
  const flagIndex = calls[0].argv.indexOf('-p')
  assert(flagIndex >= 0 && calls[0].argv[flagIndex + 1].includes('Topic: Agent Runner'), 'flag_arg passes rendered prompt after flag')

  invocationPath = join(TEST_DIR, 'stdin-invocation.json')
  await runWith({ name: 'stdin', prompt: '{ mode: stdin }' }, { INVOCATION_PATH: invocationPath })
  calls = JSON.parse(readFileSync(invocationPath, 'utf-8'))
  assert(calls[0].stdin.includes('Topic: Agent Runner'), 'stdin writes rendered prompt to stdin')
  assert(!calls[0].argv.some(value => value.includes('Topic: Agent Runner')), 'stdin does not put prompt in argv')
  assert(calls[0].cwd === TEST_DIR, 'spawn cwd is passed through')
}

console.log('\nagent runner validation and retry:')
{
  const invocationPath = join(TEST_DIR, 'retry-invocation.json')
  const { result } = await runWith({ name: 'retry', prompt: '{ mode: stdin }' }, {
    INVOCATION_PATH: invocationPath,
    INVOCATION_APPEND: '1',
    RETRY_ONCE: '1',
  })
  const calls = JSON.parse(readFileSync(invocationPath, 'utf-8'))
  assert(result.exitCode === 0, 'retry recovers after malformed output')
  assert(calls.length === 2, 'runner invoked child twice')
  assert(calls[1].stdin.includes('Previous response was rejected'), 'retry prompt includes validation error')
}

console.log('\nagent runner stream-json artifact:')
{
  const invocationPath = join(TEST_DIR, 'stream-invocation.json')
  const specPath = writeAgent({ name: 'stream', prompt: '{ mode: stdin }', stream: '    stream_json: true' })
  const artifactPath = join(TEST_DIR, 'stream.md')
  await runAgent(specPath, { topic: 'Agent Runner', scope: 'repo', context: '' }, {
    artifactPath,
    platform: 'test',
    cwd: TEST_DIR,
    env: { ...process.env, INVOCATION_PATH: invocationPath, STREAM_JSON: '1' },
  })
  assert(readFileSync(artifactPath, 'utf-8').includes('## Topic'), 'stream-json artifact contains rendered markdown')
  assert(readFileSync(`${artifactPath}.jsonl`, 'utf-8').includes('"type":"assistant"'), 'stream-json sidecar contains raw events')
}

console.log(`\n${passes} passed, ${failures} failed`)
cleanup()
process.exit(failures > 0 ? 1 : 0)
