# Outcome

## Delivered behavior

Added an adapter-owned reviewer-session capability and demonstrated exact Claude
session capture and resume while retaining the frozen read-only profile. The
first standalone Assignment primary review remains fresh; one eligible repair
successor may claim a versioned, ignored, 24-hour lease bound to the complete
review identity.

Continued reviews receive durable prior findings plus bounded hash-only
candidate and evidence deltas, create a distinct linked Attempt, and consume the
lease before launch. Missing, expired, malformed, unsupported, mismatched, or
failed continuation produces an observable fresh fallback, with at most one
failed resume Attempt and one fresh retry. Mission, resolver, arbiter,
format-correction, other-role, and other-provider paths remain fresh-only.

Claude provider-local transcript persistence is enabled only for session-aware
primary reviews because exact resume requires it. SpecDev stores the raw session
identity only in ignored operational state and does not retain the transcript as
durable evidence.

## Deviations

None.

## Unresolved risks

Provider CLI session formats may change. Adapter-owned structured decoding and
strict identity confirmation fail closed to a fresh review, so such drift costs
orientation rather than authority or recoverability.

| Acceptance | Evidence                                                                                                                                                                                                                                                                | Result |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC-1       | `test-vnext-foundations` proves a fresh Claude capture uses structured output without resume, keeps read-only Attempt policy, and creates a fully bound versioned ignored lease only with a valid session identity.                                                     | Passed |
| AC-2       | `test-implement-recovery` proves the repaired standalone candidate resumes the exact Claude session, creates a distinct linked Attempt, consumes the lease, records continued state, and completes with a new verdict.                                                  | Passed |
| AC-3       | `test-vnext-foundations` covers every lease binding, expiry, missing state, unsupported provider, malformed identity, unrelated path expansion, single-use consumption, failed resume, and one linked fresh fallback; host coverage keeps Mission/resolver paths fresh. | Passed |
