# Assignment contract

Kind: feature

## Objective and context

Allow a user to accept a standalone Assignment delivery with known limitations
and close its execution boundary without claiming verified completion. Normal
implementation preflight correctly returns acceptance_not_passed before review
when acceptance is failed or blocked. That gate must stay intact. Assignment
close currently supports only unsupported; Mission close already supports
accepted-with-limitations.

Source anchors: src/commands/assignment-close.js, src/commands/implement.js,
src/utils/assignment-delivery.js, and src/commands/mission-close.js. Historical
knowledge search identified Assignments 00049 and 00073; current source remains
authoritative.

## Scope and non-goals

- In scope: standalone Assignment accepted-with-limitations closure, explicit
  acceptance and confirmation, terminal state and ownership release, durable
  evidence and delivery records, retry recovery, relevant guards, help, and guides.
- Non-goals: weakening normal delivery or review gates, contract amendments,
  closing Mission children independently, installing or publishing the CLI,
  or applying closure to another repository's Assignment.

## Expected behavior

Support specdev assignment close <id> --outcome=accepted-with-limitations
--evidence=<acceptance-note>, with a preview and explicit confirmation of the
exact plan. The written note records user acceptance and known limitations.
A prior generic approval or failed acceptance check is not closure permission.
The preview identifies the approved contract, current candidate, limitations,
existing failed or missing evidence, review state, owned paths, and terminal effects.

Permit this separate closure path when the active approved standalone Assignment
cannot pass normal preflight, including before independent implementation review.
Record accepted-with-limitations as a distinct terminal outcome, without claiming
acceptance, verification, or review passed. Keep the approved contract, existing
outcome results, failures, missing-evidence facts, review records, implementation,
and history intact. Resolve inactive execution records consistently, release matching
workflow focus and ownership through semantic lifecycle APIs, and permit a subsequent
Adhoc start. Closure produces an exact local terminal commit and does not push it.

## Important decisions

Reuse suitable existing closure and delivery mechanisms. Do not implement a general
acceptance waiver or introduce test-only production paths. Existing unsupported,
shelved, and verified-completed behavior remains distinct. Required independent
review of this CLI change is separate from the user's exceptional closure decision.

## Constraints and invariants

Never hand-edit RippleGraph checkpoints. Refuse stale confirmation, changed contracts
or candidates, wrong ownership, Mission children, and live or ambiguous execution
before authoritative mutation. Preserve unrelated dirty files. Interrupted closure
must be recoverable and exact retries idempotent, including after its terminal commit.
Terminal records cannot be reopened through normal implementation or approval commands.
Update package.json releaseDate to the current date before committing.

## Delegated and reserved authority

- Delegated: confirmation flag spelling, metadata representation, bounded reuse of
  existing helpers, regression fixtures, and normal implementation decisions.
- Reserved for the user: this contract's approval, the listed test commands,
  confirmation of any real accepted-with-limitations closure plan, and material scope changes.

## Risks and assumptions

Terminal status checks and cleanup logic are spread across lifecycle consumers.
Audit relevant callers so the new outcome neither leaks ownership nor becomes a
verified completion. Evidence may be incomplete by definition; closure must preserve
that fact instead of rewriting receipts to satisfy normal delivery validation.

## Verification authority

Proposed focused commands, requiring explicit user authorization:
- node tests/test-assignment-accepted-limitations.js (new isolated regressions)
- npm run test:assignment-unsupported
- npm run test:assignment-shelf

Authorization includes necessary repair reruns of these commands. No full suite or
tests in another repository are requested. Perform the agreed simplification pass
before final verification and record its result in the existing outcome.

## Acceptance criteria

- AC-1: Explicitly confirmed user acceptance closes an eligible standalone Assignment
  as accepted-with-limitations even when normal preflight returns acceptance_not_passed,
  preserving its approved contract, code, evidence, failures, and unperformed-review facts.
- AC-2: Closure resolves execution ownership and focus, creates an exact local terminal
  delivery record, permits a subsequent Adhoc start, and remains immutable and idempotent
  across interruption and retries without touching unrelated work.
- AC-3: Isolated regressions prove stale plans, candidate changes, wrong ownership,
  Mission children, and live or ambiguous Attempts fail safely; normal verified delivery
  and existing unsupported and shelved closure keep their required gates.
