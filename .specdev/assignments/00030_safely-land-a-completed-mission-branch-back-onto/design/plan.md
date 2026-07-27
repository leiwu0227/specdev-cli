# Implementation plan

**Implementation Guides:** [api-security]
**Review Guides:** []

## Tasks

### T-1 — Model and execute fast-forward-only Mission landing

Acceptance: AC-1, AC-2, AC-3

- Add a focused Git landing utility that derives landed, already-landed, and
  distinct pending states from the recorded base branch, Mission branch, and
  final revision.
- Revalidate cleanliness, checked-out branch, local ref existence, ancestry,
  and exact revisions immediately before mutations.
- Make the only mutations a safe switch to the base branch followed by an
  explicit fast-forward-only update, with interruption recovery when the switch
  already occurred.

### T-2 — Integrate automatic and explicit landing with Mission UX

Acceptance: AC-1, AC-2, AC-3

- Attempt landing after the durable completion checkpoint and preserve the
  completion outcome even when landing is pending.
- Add `specdev mission land <id>` and expose the derived landing state, reason,
  and structured choices through Mission run/status JSON and concise human
  output.
- Update command help and Mission documentation without changing other delivery
  flows.

### T-3 — Add focused regression coverage and record delivery evidence

Acceptance: AC-1, AC-2, AC-3

- Cover automatic fast-forward, dirty/missing/wrong-branch/diverged refusal,
  explicit retry, already-landed idempotency, and switch-before-fast-forward
  recovery in isolated Git fixtures.
- Run only the focused authorized evidence after repository test confirmation,
  then record the exact receipt and final acceptance results.
