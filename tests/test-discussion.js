import { existsSync, rmSync, mkdirSync } from 'fs'
import { join } from 'path'
import { assertTest } from './helpers.js'

const TEST_DIR = join('/tmp', 'specdev-test-discussion')

function setup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'discussions', 'D0001_auth-ideas', 'brainstorm'), { recursive: true })
  mkdirSync(join(TEST_DIR, '.specdev', 'discussions', 'D0002_perf-tuning', 'brainstorm'), { recursive: true })
}

function cleanup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true })
}

async function main() {
  console.log('test-discussion.js')
  const { parseDiscussionId, resolveDiscussionSelector, getNextDiscussionId } = await import('../src/utils/discussion.js')

  setup()
  let ok = true

  let parsed = parseDiscussionId('D0001_auth-ideas')
  ok = assertTest(parsed.id === 'D0001' && parsed.slug === 'auth-ideas', 'parseDiscussionId parses D0001_auth-ideas') && ok

  parsed = parseDiscussionId('foo')
  ok = assertTest(parsed.id === null, 'parseDiscussionId returns null id for invalid') && ok

  let resolved = await resolveDiscussionSelector(join(TEST_DIR, '.specdev'), 'D0001_auth-ideas')
  ok = assertTest(resolved !== null && resolved.name === 'D0001_auth-ideas', 'resolveDiscussionSelector by full name') && ok

  resolved = await resolveDiscussionSelector(join(TEST_DIR, '.specdev'), 'D0001')
  ok = assertTest(resolved !== null && resolved.name === 'D0001_auth-ideas', 'resolveDiscussionSelector by ID') && ok

  resolved = await resolveDiscussionSelector(join(TEST_DIR, '.specdev'), 'D9999')
  ok = assertTest(resolved === null, 'resolveDiscussionSelector returns null for unknown') && ok

  resolved = await resolveDiscussionSelector(join(TEST_DIR, '.specdev'), 'foo')
  ok = assertTest(resolved !== null && resolved.error === 'malformed', 'resolveDiscussionSelector returns malformed for bad ID') && ok

  const nextId = await getNextDiscussionId(join(TEST_DIR, '.specdev'))
  ok = assertTest(nextId === 'D0003', 'getNextDiscussionId returns D0003') && ok

  const emptyDir = join('/tmp', 'specdev-test-discussion-empty')
  mkdirSync(join(emptyDir, '.specdev'), { recursive: true })
  const firstId = await getNextDiscussionId(join(emptyDir, '.specdev'))
  ok = assertTest(firstId === 'D0001', 'getNextDiscussionId returns D0001 when empty') && ok
  rmSync(emptyDir, { recursive: true, force: true })

  cleanup()
  if (!ok) process.exit(1)
}

main()
