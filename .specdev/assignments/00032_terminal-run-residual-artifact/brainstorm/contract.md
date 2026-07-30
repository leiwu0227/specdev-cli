# Assignment contract

Kind: bugfix

<!-- Keep this proportional: reference existing project context, state only change-specific decisions, and use the fewest independent observable acceptance criteria (normally 1-5). -->

## Objective and context

Recover terminal checkpoint-less RippleGraph run residue without blocking new Assignments

## Scope and non-goals

- In scope: make Assignment terminal-runtime cleanup recover safely when a Git-restored run directory lacks `checkpoint.json`; prevent such historical residue from blocking fresh Assignment discovery; add focused regressions.
- Non-goals: change DataPortal code, recover or alter non-terminal runs automatically, or redesign RippleGraph's runtime format.

## Expected behavior

For a completed, abandoned, or shelved Assignment whose durable record proves terminal ownership, a residual run directory without `checkpoint.json` is treated as removable terminal residue only after focused-run and live-Attempt safety checks. Idempotent shelf cleanup then succeeds and a new Assignment can be created. Checkpoint-less residue that cannot be proven terminal, or has live Attempt ownership, fails precisely without deletion.

## Important decisions

- Durable Assignment lifecycle authority and checkpoint presence jointly determine cleanup: retain existing checkpoint status validation when present; use verified terminal ownership for checkpoint-less residue.
- Keep the safeguard conservative: never silently remove a checkpoint-less run for a non-terminal Assignment or one with a live/unverified Attempt.
- Add an Assignment-creation preflight before any RippleGraph state/discovery call: it scans durable terminal Assignment records for their matching checkpoint-less run residue and invokes the same safe cleanup path. This is necessary because `listRuns()` fails while constructing summaries for every run directory.
- Centralize the checkpoint-less branch in terminal compaction. Callers must supply durable terminal-owner authority; the branch rejects a focused run and any running Attempt, whereas a normal checkpoint continues through its existing allowed-status validation and focus-clearing behavior.
- Cover the failure through the existing Assignment-shelf command-level fixture, including subsequent Assignment creation.

## Constraints and invariants

- Do not edit installed `.specdev/` runtime/template state as product source; make behavior changes in `src/` and tests.
- Terminal compaction must clear focused ownership before removal and retain existing Attempt-record cleanup semantics.
- Focused tests require explicit user approval under repository instructions; a full suite remains separately opt-in.

## Delegated and reserved authority

- Delegated: implementation details for safe terminal-residue classification, error wording, and focused regression fixtures consistent with this contract.
- Reserved for the user: brainstorm-contract approval, test execution approval, and any scope expansion beyond Assignment lifecycle/runtime retention.

## Risks and assumptions

- Assumes a missing checkpoint can be safely classified only where the owning durable Assignment is already terminal; malformed unowned runtime directories remain a diagnostic concern rather than deletion candidates.
- RippleGraph's `listRuns()` assumes every directory has a checkpoint and cannot be made resilient from SpecDev without vendoring or upgrading the dependency; therefore the semantic Assignment command owns its preflight recovery rather than changing the dependency.

## Verification authority

- Focused tests for changed modules: allowed after repository instructions are satisfied
- Full suite: requires explicit user approval unless already authorized here

## Acceptance criteria

- AC-1: Re-running shelf cleanup for a verified terminal Assignment with only a checkpoint-less residual run artifact succeeds, removes the residue, and permits creation of a new Assignment.
- AC-2: Terminal cleanup preserves safety: it refuses to remove checkpoint-less residue for a non-terminal owner or while a live/unverified Attempt is present.
- AC-3: Focused command-level regressions cover the recovered terminal-residue path and retain existing normal shelf/compaction behavior.
