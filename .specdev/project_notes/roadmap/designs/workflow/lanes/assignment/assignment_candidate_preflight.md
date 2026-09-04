# Assignment Candidate Preflight

Parent design: `./assignment_lane.md`

Candidate preflight determines whether implementation is complete and coherent enough
to consume independent reviewer effort. It runs at the implementation-to-review
boundary using the same artifact and evidence interpretation later used by delivery.

The preflight validates the approved contract, plan, progress record, outcome,
worker result where applicable, acceptance evidence, verification history, review
waiver evidence, Git boundary, and current product digest. It builds a bounded
candidate receipt whose identity includes contract, artifacts, execution mode, and
product state.

A complete candidate may enter review. An incomplete candidate stays with the frozen
implementation owner and receives exact repair obligations. No reviewer Attempt,
round, verdict, continuation lease, or review-repair allowance is created for a
candidate that never qualified.

Evidence history preserves failures and passing reruns. Bounded summaries may display
current obligations, but truncation never determines completeness. Later evidence
supersedes an earlier failure only when authority, command, candidate, and relevant
conditions still match. Qualification evidence cannot replace acceptance evidence.

Review and final delivery repeat defensive validation because the product or artifacts
may change after preflight. A changed digest, missing artifact, unresolved follow-up,
or stale review returns to the owning phase rather than being patched by the reviewer.

The mechanism is execution-mode neutral. Inline work returns to the foreground;
spawned work preserves the worker boundary or uses explicit replacement recovery.

The current 1,200-line delivery-utility cap is a transitional compatibility ceiling.
New responsibilities should move into focused modules so the cap can decrease.

## Source Targets

- `src/utils/assignment-delivery.js` — maximum 1200 lines — candidate receipt, preflight, and standalone delivery validation.
- `src/utils/delivery-artifacts.js` — maximum 230 lines — acceptance and review artifact checks.
- `src/utils/assignment-vnext.js` — maximum 350 lines — contract, approval, and status validation.
- `src/commands/implement.js` — maximum 800 lines — preflight timing and repair routing.
