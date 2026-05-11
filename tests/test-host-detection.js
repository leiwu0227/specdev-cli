import { detectHostAgent } from '../src/utils/host-detection.js'

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

function assertThrows(fn, pattern, msg) {
  try {
    fn()
    assert(false, msg)
  } catch (error) {
    assert(pattern.test(error.message), msg)
  }
}

console.log('\nhost detection:')
assert(detectHostAgent({ flagOverride: 'codex' }, { CLAUDECODE: '1' }) === 'codex', 'flag override wins')
assert(detectHostAgent({}, { SPECDEV_HOST_AGENT: 'claude' }) === 'claude', 'SPECDEV_HOST_AGENT claude works')
assert(detectHostAgent({}, { CLAUDECODE: '1' }) === 'claude', 'CLAUDECODE detects claude')
assert(detectHostAgent({}, { CODEX_HOME: '/tmp/codex' }) === 'codex', 'CODEX_HOME detects codex')
assert(detectHostAgent({}, { CURSOR_TRACE_ID: 'abc' }) === 'cursor', 'cursor marker detects cursor')
assertThrows(() => detectHostAgent({}, { SPECDEV_HOST_AGENT: 'bad' }), /Invalid host agent/, 'invalid SPECDEV_HOST_AGENT is rejected')
assertThrows(() => detectHostAgent({}, { CLAUDECODE: '1', CODEX_HOME: '/tmp/codex' }), /Ambiguous host agent/, 'ambiguous markers are rejected')
assertThrows(() => detectHostAgent({}, {}), /Could not detect host agent/, 'missing markers require explicit platform')

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures > 0 ? 1 : 0)
