import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  attemptMilestonePrompt,
  attemptProgressPaths,
  buildAttemptProgress,
  formatAttemptProgress,
  readAttemptMilestone,
  validateMilestone,
  writeAttemptProgress,
} from '../src/utils/attempt-progress.js'

const root = mkdtempSync(join(tmpdir(), 'specdev-attempt-progress-'))
const specdevPath = join(root, '.specdev')
const paths = attemptProgressPaths(specdevPath, 'Attempt-00001')
const now = Date.parse('2026-08-04T08:00:00.000Z')

try {
  assert.deepEqual(await readAttemptMilestone(paths.milestone, { now }), {
    milestone: null,
    diagnostic: null,
  })

  const valid = validateMilestone(
    {
      version: 1,
      phase: 'verification',
      summary: 'Checking focused progress fixtures',
      updated_at: '2026-08-04T07:59:55.000Z',
    },
    now
  )
  mkdirSync(join(specdevPath, 'cache', 'attempts'), { recursive: true })
  writeFileSync(paths.milestone, JSON.stringify(valid))
  assert.deepEqual(await readAttemptMilestone(paths.milestone, { now }), {
    milestone: valid,
    diagnostic: null,
  })

  writeFileSync(paths.milestone, '{not-json')
  assert.deepEqual(
    await readAttemptMilestone(paths.milestone, { now, lastValidMilestone: valid }),
    {
      milestone: valid,
      diagnostic: 'milestone_malformed',
    }
  )

  writeFileSync(paths.milestone, 'x'.repeat(4 * 1024 + 1))
  assert.deepEqual(
    await readAttemptMilestone(paths.milestone, { now, lastValidMilestone: valid }),
    {
      milestone: valid,
      diagnostic: 'milestone_oversized',
    }
  )

  writeFileSync(
    paths.milestone,
    JSON.stringify({
      version: 1,
      phase: 'delivery',
      summary: 'api_key=sk-example-secret-value',
      updated_at: '2026-08-04T08:00:00.000Z',
    })
  )
  assert.deepEqual(
    await readAttemptMilestone(paths.milestone, { now, lastValidMilestone: valid }),
    {
      milestone: valid,
      diagnostic: 'milestone_sensitive_text',
    }
  )

  const base = {
    attemptId: 'Attempt-00001',
    role: 'worker',
    processLiveness: 'live_local',
    startedAt: now - 180_000,
    milestone: null,
  }
  const fresh = buildAttemptProgress({ ...base, now, logActivityAt: now - 1_000 })
  const quiet = buildAttemptProgress({ ...base, now, logActivityAt: now - 60_000 })
  const stale = buildAttemptProgress({ ...base, now, logActivityAt: now - 150_000 })
  assert.equal(fresh.classification, 'fresh')
  assert.equal(fresh.log_liveness, 'active')
  assert.equal(quiet.classification, 'quiet')
  assert.equal(quiet.log_liveness, 'quiet')
  assert.equal(stale.classification, 'stale')
  assert.equal(stale.log_liveness, 'stale')
  assert.equal(
    buildAttemptProgress({ ...base, now, processLiveness: 'unknown' }).classification,
    'stale'
  )
  assert.equal(buildAttemptProgress({ ...base, now }).log_liveness, 'stale')
  const staleMilestone = buildAttemptProgress({
    ...base,
    now,
    milestone: { ...valid, updated_at: '2026-08-04T07:57:00.000Z' },
  })
  assert.equal(staleMilestone.classification, 'stale')
  assert.equal(staleMilestone.diagnostic, 'milestone_stale')

  const withMilestone = buildAttemptProgress({
    ...base,
    now,
    milestone: valid,
    diagnostic: 'milestone_malformed',
  })
  assert.equal(withMilestone.phase, 'verification')
  assert.equal(withMilestone.milestone.summary, 'Checking focused progress fixtures')
  assert.equal(withMilestone.diagnostic, 'milestone_malformed')

  const human = formatAttemptProgress(withMilestone)
  const structured = formatAttemptProgress(withMilestone, 'structured')
  assert.match(human, /Attempt-00001 progress: worker/)
  assert.match(human, /milestone verification: Checking focused progress fixtures/)
  assert.deepEqual(JSON.parse(structured).progress, withMilestone)
  assert.ok(Buffer.byteLength(human) < 1024)
  assert.ok(Buffer.byteLength(structured) < 2048)

  await writeAttemptProgress(paths.progress, withMilestone)
  assert.deepEqual(JSON.parse(readFileSync(paths.progress, 'utf-8')), withMilestone)
  assert.match(attemptMilestonePrompt(root, paths.milestone), /ignored runtime telemetry/)
  assert.match(attemptMilestonePrompt(root, paths.milestone), /Never include reasoning/)
  assert.throws(() => attemptProgressPaths(specdevPath, '../../escape'), /invalid Attempt ID/)

  console.log('attempt progress tests passed')
} finally {
  rmSync(root, { recursive: true, force: true })
}
