import { readFileSync } from 'node:fs'

let failures = 0
let passes = 0

function assert(condition, msg) {
  if (!condition) {
    console.error(`  FAIL ${msg}`)
    failures++
  } else {
    console.log(`  PASS ${msg}`)
    passes++
  }
}

const runner = readFileSync('src/utils/agent-runner.js', 'utf-8')

console.log('\nagent runner subsumption pins:')
assert(runner.includes('markActivity'), 'agent-runner supports heartbeat activity')
assert(runner.includes('SIGTERM') && runner.includes('SIGKILL'), 'agent-runner supports process-group termination grace')
assert(runner.includes('stdoutBufferLimit') || runner.includes('appendCapped'), 'agent-runner supports capped stdout capture')
assert(runner.includes('stream_json'), 'agent-runner supports stream-json sidecar behavior')
assert(runner.includes('runners') && runner.includes('platform'), 'agent-runner selects per-platform runner config')
assert(!runner.includes('## Round'), 'agent-runner does not bake in reviewloop salvage')
assert(runner.includes('maxRetries'), 'agent-runner supports retry rounds')

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
