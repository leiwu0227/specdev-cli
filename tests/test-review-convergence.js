import assert from 'node:assert/strict'
import {
  initialAutomaticReviewState,
  missionReplanDisposition,
  normalizedFindingsDigest,
  recordArbitration,
  recordPrimaryReview,
  recordResolver,
  reviewExecutionMode,
} from '../src/utils/review-convergence.js'

assert.equal(reviewExecutionMode({ phase: 'brainstorm' }), 'interactive')
assert.equal(reviewExecutionMode({ phase: 'mission' }), 'interactive')
assert.equal(reviewExecutionMode({ phase: 'discussion' }), 'interactive')
assert.equal(reviewExecutionMode({ phase: 'brainstorm', missionChild: true }), 'automatic')
assert.equal(reviewExecutionMode({ phase: 'implementation' }), 'automatic')
assert.equal(reviewExecutionMode({ phase: 'mission-convergence' }), 'automatic')

const repeatedA = normalizedFindingsDigest('## Findings\n\n  SAME   finding ')
const repeatedB = normalizedFindingsDigest('## Findings\nsame finding')
assert.equal(repeatedA, repeatedB, 'findings digest ignores headings, case, and whitespace')

const first = recordPrimaryReview(initialAutomaticReviewState(), {
  verdict: 'needs_changes',
  candidateDigest: 'candidate-a',
  findings: '## Findings\nfirst',
  attempt: 'Attempt-1',
})
assert.equal(first.disposition, 'repair')
assert.equal(first.state.primary_round, 1)

const progressing = recordPrimaryReview(first.state, {
  verdict: 'needs_changes',
  candidateDigest: 'candidate-b',
  findings: '## Findings\nsecond',
  attempt: 'Attempt-2',
})
assert.equal(progressing.disposition, 'conditional-primary')
assert.equal(progressing.state.primary_round, 2)

const third = recordPrimaryReview(progressing.state, {
  verdict: 'blocked',
  candidateDigest: 'candidate-c',
  findings: '## Findings\nobjective issue',
  attempt: 'Attempt-3',
})
assert.equal(third.disposition, 'resolver', 'third primary always hands off to the resolver')
assert.equal(third.state.stage, 'resolver')

const repeated = recordPrimaryReview(first.state, {
  verdict: 'needs_changes',
  candidateDigest: 'candidate-b',
  findings: '## Findings\nfirst',
  attempt: 'Attempt-2b',
})
assert.equal(repeated.disposition, 'resolver', 'unchanged findings skip the conditional primary')

const stalled = recordPrimaryReview(first.state, {
  verdict: 'needs_changes',
  candidateDigest: 'candidate-a',
  findings: '## Findings\nnew wording',
  attempt: 'Attempt-2c',
})
assert.equal(stalled.disposition, 'resolver', 'unchanged candidate skips the conditional primary')

const restarted = initialAutomaticReviewState(JSON.parse(JSON.stringify(progressing.state)))
assert.equal(restarted.primary_round, 2)
assert.equal(restarted.history.length, 2)

const resolved = recordResolver(third.state, {
  attempt: 'Attempt-resolver',
  status: 'blocked',
})
assert.equal(resolved.stage, 'arbiter', 'a blocked resolver still receives final arbitration')

for (const [verdict, disposition] of [
  ['approved', 'approved'],
  ['needs_changes', 'nonblocking-disagreement'],
  ['blocked', 'objective-failure'],
]) {
  assert.equal(
    recordArbitration(resolved, {
      verdict,
      attempt: `Attempt-${verdict}`,
      candidateDigest: 'candidate-final',
      findings: `## Findings\n${verdict}`,
    }).disposition,
    disposition
  )
}

assert.equal(missionReplanDisposition({ reason: 'mission_review', previousAttempts: 2 }), 'replan')
assert.equal(
  missionReplanDisposition({ reason: 'mission_review', previousAttempts: 3 }),
  'objective-failure'
)
assert.equal(
  missionReplanDisposition({ reason: 'final_verification', previousAttempts: 0 }),
  'replan'
)
assert.equal(
  missionReplanDisposition({ reason: 'final_verification', previousAttempts: 1 }),
  'objective-failure'
)

console.log('Review convergence tests passed.')
