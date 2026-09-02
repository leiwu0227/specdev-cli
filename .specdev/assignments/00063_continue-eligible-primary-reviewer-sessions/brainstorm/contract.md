# Assignment contract

Kind: change

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Reduce repeated reviewer orientation by continuing the same provider session for
one eligible Assignment implementation-repair review. Preserve the approved
`assignment_reviewer_session_continuation.md` model: the first primary reviewer
is fresh and independent, every round remains a distinct Attempt, and durable
artifacts remain sufficient when session state is unavailable.

## Scope and non-goals

- In scope: provider-adapter session capability, exact session-ID capture and
  resume invocation, replaceable Assignment-local continuation leases, eligibility
  and invalidation checks, reviewer prompt deltas, Attempt lineage, bounded fresh
  fallback, and focused configuration/documentation/regression coverage.
- Non-goals: continuing Brainstorm, Discussion, Mission-convergence, resolver,
  arbiter, worker, or implementation-author sessions; sharing a session across
  Assignments or roles; making session state durable authority; transcript
  persistence as evidence; changing review convergence limits or verdict gates.

## Expected behavior

- The first primary implementation review always starts a fresh independent
  provider session. When the result requires ordinary repair, SpecDev may retain
  a one-use local lease for the immediately following primary repair-verification
  round.
- A lease binds the Assignment, primary-reviewer role, provider session identity,
  complete frozen profile and permissions, approved contract hash, canonical
  working directory, reviewed candidate identity, findings identity, source
  Attempt, and review round. Eligibility requires every binding to match and a
  complete repaired candidate; ambiguity forces a fresh review.
- An eligible continuation receives the prior findings, the reviewed-to-repaired
  candidate delta, and changed verification evidence. It resumes the exact
  provider session but creates a new linked Attempt and produces a new governed
  verdict for the repaired candidate.
- Missing, expired, consumed, unsupported, mismatched, or failed continuation
  falls back once to a fresh primary reviewer without blocking recovery. Resolver
  and arbiter transitions always discard continuation state and remain fresh.

## Important decisions

- Continuation is an adapter capability, not a generic command assumption. The
  initial delivery must demonstrate capture and resume end to end for at least
  one supported provider; Claude, the default reviewer, is the required baseline.
  Other adapters remain explicitly fresh-only until they can prove equivalent
  semantics.
- Raw provider session IDs and leases live only in ignored operational state.
  Durable review state and Attempts record provider-neutral continuity facts such
  as fresh, continued, invalidated, or fallback plus source-Attempt lineage; no
  workflow decision depends solely on a private transcript.
- A lease is single-successor and single-use. A failed resume may create one
  recorded continuation Attempt followed by one recorded fresh fallback Attempt;
  it never retries or switches sessions silently in a loop.

## Constraints and invariants

- Continued reviewers retain the frozen repository-read-only filesystem policy,
  network policy, provider, model, effort, timeout, working directory, and role.
- The approved contract and candidate receipt remain authoritative. Session
  memory cannot supply missing findings, evidence, acceptance results, or gates.
- Contract/profile/permission/role/Assignment/cwd mismatch, unrelated candidate
  change, missing baseline identity, or stale review state invalidates the lease
  before launch and records or exposes the fresh-fallback reason.
- First reviewers, resolvers, arbiters, unrelated reviewers, and all non-reviewer
  roles remain fresh. Format-correction Attempts do not acquire or extend leases.
- Operational-state loss costs only orientation; it cannot block review recovery,
  erase findings, or change convergence disposition.

## Delegated and reserved authority

- Delegated: edit product source, managed templates, documentation, and focused
  tests; define a versioned local lease schema, conservative material-change
  classifier, provider capability interface, bounded candidate/evidence delta,
  and provider-neutral Attempt continuity fields within the constraints above.
- Reserved for the user: approval of this contract; authorization to run tests;
  retention of full provider transcripts; weakening reviewer permissions or
  independence; supporting a provider without demonstrated capture/resume
  semantics; expanding continuation to other roles, lanes, or Assignments.

## Risks and assumptions

- Provider session formats and resume flags can evolve. Exact parsing and command
  construction stay adapter-owned and fail fresh when capability proof is absent.
- A provider may return a valid verdict but fail to expose a reusable session ID;
  that verdict remains valid and only the optimization is unavailable.
- Semantic materiality cannot always be inferred from path changes. The host must
  use conservative deterministic signals and choose a fresh review when scope or
  authority continuity is uncertain.
- Continuation can retain irrelevant or mistaken conversational context. The
  repaired-candidate delta, changed evidence, and explicit regression prompt are
  required even when the provider remembers the earlier review.

## Verification authority

- No test command is authorized by this contract alone. Ask the user explicitly
  before running focused provider capture/resume, lease binding/invalidation,
  Attempt lineage, fresh-role, and fallback regressions.
- Full suite: requires separate explicit user approval.

## Acceptance criteria

- AC-1: The first primary Assignment implementation review is demonstrably fresh;
  at least the Claude adapter captures an exact reusable session identity without
  changing its strict result or read-only policy, and a repair disposition creates
  only a versioned, ignored, one-use lease bound to the complete review identity.
- AC-2: The immediately following eligible primary repair-verification resumes the
  exact leased provider session, receives prior findings plus bounded candidate and
  evidence deltas, creates a distinct Attempt linked to its source Attempt, consumes
  the lease once, and cannot reuse the earlier verdict for the repaired candidate.
- AC-3: Focused regressions prove every binding and role invalidation, operational
  loss, unsupported capability, malformed capture, and resume failure degrades to
  a fresh read-only review with an observable reason and at most one fallback;
  resolvers, arbiters, other roles, and other Assignments never continue the lease.
