import { createHash } from 'node:crypto'

export const REVIEW_MODES = Object.freeze({
  interactive: 'interactive',
  automatic: 'automatic',
})

export function reviewExecutionMode({ phase, missionChild = false }) {
  if (phase === 'implementation' || phase === 'mission-convergence') {
    return REVIEW_MODES.automatic
  }
  if (phase === 'brainstorm' && missionChild) return REVIEW_MODES.automatic
  return REVIEW_MODES.interactive
}

export function initialAutomaticReviewState(existing = {}) {
  const primaryRound = positiveInteger(existing.primary_round, positiveInteger(existing.round, 0))
  return {
    ...existing,
    version: 2,
    mode: REVIEW_MODES.automatic,
    stage: automaticStage(existing.stage),
    primary_round: primaryRound,
    round: positiveInteger(existing.round, primaryRound),
    history: Array.isArray(existing.history) ? existing.history.slice(-3) : [],
  }
}

export function recordPrimaryReview(
  existing,
  { verdict, candidateDigest, findings, attempt, updatedAt = new Date().toISOString() }
) {
  const state = initialAutomaticReviewState(existing)
  const primaryRound = state.primary_round + 1
  const findingsDigest = normalizedFindingsDigest(findings)
  const previous = state.history.at(-1) || null
  const history = [
    ...state.history,
    {
      round: primaryRound,
      candidate_digest: candidateDigest,
      findings_digest: findingsDigest,
    },
  ].slice(-3)

  let disposition
  if (verdict === 'approved') disposition = 'approved'
  else if (primaryRound < 2) disposition = 'repair'
  else if (
    primaryRound === 2 &&
    previous?.candidate_digest &&
    previous.candidate_digest !== candidateDigest &&
    previous.findings_digest !== findingsDigest
  ) {
    disposition = 'conditional-primary'
  } else {
    disposition = 'resolver'
  }

  return {
    state: {
      ...state,
      stage:
        disposition === 'approved'
          ? 'complete'
          : disposition === 'resolver'
            ? 'resolver'
            : 'primary',
      primary_round: primaryRound,
      round: state.round + 1,
      status: disposition === 'approved' ? 'approved' : 'converging',
      history,
      candidate_digest: candidateDigest,
      findings_digest: findingsDigest,
      attempt,
      updated_at: updatedAt,
    },
    disposition,
  }
}

export function recordResolver(
  existing,
  { attempt, status, updatedAt = new Date().toISOString() }
) {
  const state = initialAutomaticReviewState(existing)
  return {
    ...state,
    stage: 'arbiter',
    status: 'converging',
    resolver_attempt: attempt,
    resolver_status: status,
    updated_at: updatedAt,
  }
}

export function recordArbitration(
  existing,
  { verdict, attempt, candidateDigest, findings, updatedAt = new Date().toISOString() }
) {
  const state = initialAutomaticReviewState(existing)
  const disposition =
    verdict === 'approved'
      ? 'approved'
      : verdict === 'needs_changes'
        ? 'nonblocking-disagreement'
        : 'objective-failure'
  return {
    state: {
      ...state,
      stage: disposition === 'objective-failure' ? 'failed' : 'complete',
      status:
        disposition === 'approved'
          ? 'approved'
          : disposition === 'nonblocking-disagreement'
            ? 'disagreement'
            : 'failed',
      round: state.round + 1,
      attempt,
      arbiter_attempt: attempt,
      candidate_digest: candidateDigest,
      findings_digest: normalizedFindingsDigest(findings),
      disposition,
      updated_at: updatedAt,
    },
    disposition,
  }
}

export function normalizedFindingsDigest(markdown) {
  const normalized = String(markdown || '')
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    .replace(/^#+\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  return createHash('sha256').update(normalized).digest('hex')
}

export function missionReplanDisposition({ reason, previousAttempts = 0 }) {
  const limit = reason === 'final_verification' ? 1 : reason === 'mission_review' ? 3 : 1
  return previousAttempts < limit ? 'replan' : 'objective-failure'
}

function automaticStage(stage) {
  return ['primary', 'resolver', 'arbiter', 'complete', 'failed'].includes(stage)
    ? stage
    : 'primary'
}

function positiveInteger(value, fallback) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback
}
