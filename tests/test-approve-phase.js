// tests/test-approve-phase.js
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { approvePhase } from '../src/utils/approve-phase.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const TEST_DIR = join(__dirname, 'test-approve-phase-output')

function makeAssignment() {
  const assignmentPath = join(TEST_DIR, '.specdev', 'assignments', '001_feature_test')
  mkdirSync(assignmentPath, { recursive: true })
  return assignmentPath
}

function cleanup() {
  try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
}

// =====================================================================
// Brainstorm phase
// =====================================================================

describe('approvePhase — brainstorm', () => {
  let assignmentPath

  beforeEach(() => {
    cleanup()
    assignmentPath = makeAssignment()
  })

  afterEach(() => cleanup())

  it('fails when proposal.md is missing', async () => {
    mkdirSync(join(assignmentPath, 'brainstorm'), { recursive: true })
    writeFileSync(join(assignmentPath, 'brainstorm', 'design.md'), 'A sufficiently long design document content here.')

    const result = await approvePhase(assignmentPath, 'brainstorm')
    assert.equal(result.approved, false)
    assert.ok(result.errors.length > 0)
    assert.ok(result.errors.some(e => e.includes('proposal.md')))
  })

  it('fails when design.md is missing', async () => {
    mkdirSync(join(assignmentPath, 'brainstorm'), { recursive: true })
    writeFileSync(join(assignmentPath, 'brainstorm', 'proposal.md'), 'A sufficiently long proposal document content here.')

    const result = await approvePhase(assignmentPath, 'brainstorm')
    assert.equal(result.approved, false)
    assert.ok(result.errors.length > 0)
    assert.ok(result.errors.some(e => e.includes('design.md')))
  })

  it('fails when proposal.md is too short', async () => {
    mkdirSync(join(assignmentPath, 'brainstorm'), { recursive: true })
    writeFileSync(join(assignmentPath, 'brainstorm', 'proposal.md'), 'short')
    writeFileSync(join(assignmentPath, 'brainstorm', 'design.md'), 'A sufficiently long design document content here.')

    const result = await approvePhase(assignmentPath, 'brainstorm')
    assert.equal(result.approved, false)
    assert.ok(result.errors.some(e => e.includes('proposal.md') && e.includes('too short')))
  })

  it('fails when design.md is too short', async () => {
    mkdirSync(join(assignmentPath, 'brainstorm'), { recursive: true })
    writeFileSync(join(assignmentPath, 'brainstorm', 'proposal.md'), 'A sufficiently long proposal document content here.')
    writeFileSync(join(assignmentPath, 'brainstorm', 'design.md'), 'short')

    const result = await approvePhase(assignmentPath, 'brainstorm')
    assert.equal(result.approved, false)
    assert.ok(result.errors.some(e => e.includes('design.md') && e.includes('too short')))
  })

  it('succeeds and sets brainstorm_approved in status.json', async () => {
    const { readFileSync } = await import('node:fs')
    mkdirSync(join(assignmentPath, 'brainstorm'), { recursive: true })
    writeFileSync(join(assignmentPath, 'brainstorm', 'proposal.md'), 'A sufficiently long proposal document content here.')
    writeFileSync(join(assignmentPath, 'brainstorm', 'design.md'), 'A sufficiently long design document content here.')

    const result = await approvePhase(assignmentPath, 'brainstorm')
    assert.equal(result.approved, true)
    assert.equal(result.errors.length, 0)

    const status = JSON.parse(readFileSync(join(assignmentPath, 'status.json'), 'utf-8'))
    assert.equal(status.brainstorm_approved, true)
  })

  it('preserves existing status.json fields', async () => {
    const { readFileSync } = await import('node:fs')
    mkdirSync(join(assignmentPath, 'brainstorm'), { recursive: true })
    writeFileSync(join(assignmentPath, 'status.json'), JSON.stringify({ some_field: 'value' }))
    writeFileSync(join(assignmentPath, 'brainstorm', 'proposal.md'), 'A sufficiently long proposal document content here.')
    writeFileSync(join(assignmentPath, 'brainstorm', 'design.md'), 'A sufficiently long design document content here.')

    const result = await approvePhase(assignmentPath, 'brainstorm')
    assert.equal(result.approved, true)

    const status = JSON.parse(readFileSync(join(assignmentPath, 'status.json'), 'utf-8'))
    assert.equal(status.some_field, 'value')
    assert.equal(status.brainstorm_approved, true)
  })
})

// =====================================================================
// Implementation phase
// =====================================================================

describe('approvePhase — implementation', () => {
  let assignmentPath

  beforeEach(() => {
    cleanup()
    assignmentPath = makeAssignment()
  })

  afterEach(() => cleanup())

  it('fails when progress.json is missing', async () => {
    mkdirSync(join(assignmentPath, 'implementation'), { recursive: true })

    const result = await approvePhase(assignmentPath, 'implementation')
    assert.equal(result.approved, false)
    assert.ok(result.errors.length > 0)
    assert.ok(result.errors.some(e => e.includes('progress.json')))
  })

  it('fails when progress.json has no tasks array', async () => {
    mkdirSync(join(assignmentPath, 'implementation'), { recursive: true })
    writeFileSync(
      join(assignmentPath, 'implementation', 'progress.json'),
      JSON.stringify({ version: 1 })
    )

    const result = await approvePhase(assignmentPath, 'implementation')
    assert.equal(result.approved, false)
    assert.ok(result.errors.some(e => e.includes('no tasks')))
  })

  it('fails when progress.json has empty tasks array', async () => {
    mkdirSync(join(assignmentPath, 'implementation'), { recursive: true })
    writeFileSync(
      join(assignmentPath, 'implementation', 'progress.json'),
      JSON.stringify({ tasks: [] })
    )

    const result = await approvePhase(assignmentPath, 'implementation')
    assert.equal(result.approved, false)
    assert.ok(result.errors.some(e => e.includes('no tasks')))
  })

  it('fails when some tasks are not completed', async () => {
    mkdirSync(join(assignmentPath, 'implementation'), { recursive: true })
    writeFileSync(
      join(assignmentPath, 'implementation', 'progress.json'),
      JSON.stringify({
        tasks: [
          { id: 1, status: 'completed' },
          { id: 2, status: 'in-progress' },
        ],
      })
    )

    const result = await approvePhase(assignmentPath, 'implementation')
    assert.equal(result.approved, false)
    assert.ok(result.errors.some(e => e.includes('not completed')))
  })

  it('fails when progress.json is invalid JSON', async () => {
    mkdirSync(join(assignmentPath, 'implementation'), { recursive: true })
    writeFileSync(
      join(assignmentPath, 'implementation', 'progress.json'),
      'not valid json {'
    )

    const result = await approvePhase(assignmentPath, 'implementation')
    assert.equal(result.approved, false)
    assert.ok(result.errors.some(e => e.includes('invalid')))
  })

  it('succeeds when all tasks are completed', async () => {
    const { readFileSync } = await import('node:fs')
    mkdirSync(join(assignmentPath, 'implementation'), { recursive: true })
    writeFileSync(
      join(assignmentPath, 'implementation', 'progress.json'),
      JSON.stringify({
        tasks: [
          { id: 1, status: 'completed' },
          { id: 2, status: 'completed' },
        ],
      })
    )

    const result = await approvePhase(assignmentPath, 'implementation')
    assert.equal(result.approved, true)
    assert.equal(result.errors.length, 0)

    const status = JSON.parse(readFileSync(join(assignmentPath, 'status.json'), 'utf-8'))
    assert.equal(status.implementation_approved, true)
  })

  it('preserves existing status.json fields', async () => {
    const { readFileSync } = await import('node:fs')
    mkdirSync(join(assignmentPath, 'implementation'), { recursive: true })
    writeFileSync(join(assignmentPath, 'status.json'), JSON.stringify({ brainstorm_approved: true }))
    writeFileSync(
      join(assignmentPath, 'implementation', 'progress.json'),
      JSON.stringify({
        tasks: [{ id: 1, status: 'completed' }],
      })
    )

    const result = await approvePhase(assignmentPath, 'implementation')
    assert.equal(result.approved, true)

    const status = JSON.parse(readFileSync(join(assignmentPath, 'status.json'), 'utf-8'))
    assert.equal(status.brainstorm_approved, true)
    assert.equal(status.implementation_approved, true)
  })
})
