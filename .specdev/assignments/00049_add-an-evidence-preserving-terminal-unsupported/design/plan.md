# Implementation plan

**Implementation Guides:** [api-security]
**Review Guides:** []

## Tasks

### T-1 — Add fail-closed unsupported closure and exact terminal publication

Acceptance: AC-1, AC-2

- Add an explicit standalone Assignment close command for `unsupported` with required reason and attributable repository evidence references.
- Build a semantic pre-mutation plan containing the confirmed HEAD, approved contract identity, exact Assignment-owned manifest, evidence sources, excluded paths with owners and next actions, and an internal digest guarded by `--snapshot=owned`.
- Revalidate lifecycle/run identity, Attempt liveness, HEAD, evidence digests, and the exact path manifest immediately before mutation.
- Prepare an ignored transaction journal, write canonical closure/status state, terminalize and compact only the owned runtime, clear matching focus, and publish the resulting tree through one compare-and-swap exact commit.
- Make retries distinguish prepared and published boundaries, converge on the same terminal state, and fail with precise recovery guidance on any mismatch.

### T-2 — Integrate immutable unsupported history, dirt reporting, and successors

Acceptance: AC-2, AC-3

- Teach lifecycle, runtime-residue recovery, status/history, and immutable-focus consumers about `unsupported` without changing shelf, cancellation, delivery, or Mission-child semantics.
- Report remaining dirty paths by owner and give safe fresh-lane actions after closure.
- Extend `--from-assignment` to accept a verified unsupported closure as historical comparison context while preserving a fresh ID, contract, approval, evidence, and delivery boundary.
- Update CLI help and installed workflow guidance for the new terminal command and successor behavior.

### T-3 — Add focused regression coverage and delivery receipts

Acceptance: AC-1, AC-2, AC-3

- Add command-level coverage for missing or invalid evidence, ineligible/live/stale plans, exact one-commit closure, excluded concurrent/unrelated dirt, runtime/focus compaction, idempotent retry, status/history consistency, source immutability, and fresh-successor provenance.
- Run only the focused tests authorized under repository instructions, record command/revision/scope receipts, and finish the required progress and outcome artifacts without claiming unsupported findings as delivered product acceptance.
