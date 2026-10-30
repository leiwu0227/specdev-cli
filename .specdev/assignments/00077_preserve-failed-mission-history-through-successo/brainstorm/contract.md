# Assignment contract

Kind: change

## Objective and context

Preserve failed Mission history through successor handoff and delivery so the original Mission can later close with accepted limitations. Make focus conflicts and ownership evidence clear to users and reviewers.

Implement the relevant designs published in commit d6d14b6:
- `.specdev/project_notes/roadmap/designs/workflow/lanes/mission/mission_recovery_and_delivery.md`
- `.specdev/project_notes/roadmap/designs/foundations/delivery_and_retention.md`
- `.specdev/project_notes/roadmap/designs/workflow/review_system.md`

Reference project_notes/big_picture.md for project context. Assignment 00047 documents the earlier destructive handoff policy; Assignment 00076 added failed Mission closure but did not cover successor handoff.

## Scope and non-goals

- In scope: durable terminal failure publication; preservation and ownership checks across successor handoff, cleanup, and delivery; accepted closure after successor delivery; focus-conflict diagnostics; ownership digest semantics in review handoffs; focused regressions and source documentation.
- Non-goals: repair an external project's already-deleted history, introduce automatic reconstruction from mission.yaml, restart failed execution, change successor evidence scope or approval requirements, or redesign unrelated delivery and review behavior.

## Expected behavior

Entering terminal Mission failure preserves the failure state, checkpoint, and transition history in an exact local commit. Publication is recoverable and idempotent, preserves unrelated changes, and cannot claim successful delivery or verification.

Successor handoff creates a fresh Assignment and releases only owned focus. It preserves the failed Mission's runtime, failure evidence, and records needed for closure or recovery. Successor delivery and shared cleanup respect the durable owner and remaining lifecycle obligations. They must not remove those predecessor records or absorb their deletions merely because they exist in the working tree. Ambiguous ownership blocks cleanup with an actionable explanation.

After successor delivery, the original failed Mission can preview and confirm accepted-with-limitations closure through the existing acceptance-note and exact-plan flow. Original failure evidence and terminal execution history remain intact. Missing or inconsistent runtime requires explicit recovery rather than a status-only fallback.

Focus diagnostics distinguish foreground work-item selection from runtime execution ownership, identify the conflicting owner or missing focus, and state a safe next action. Selecting foreground focus does not silently activate execution or displace another workflow.

Primary review, repair verification, and arbitration handoffs that inspect Mission owned_paths state the exact SHA-256 convention: literal file: plus file bytes; executable: plus executable file bytes; symlink: plus link-target text; null for deleted paths. They do not substitute plain file hashes.

## Important decisions

Correct retention at handoff and cleanup rather than weakening closure checks. Keep failure publication distinct from successful completion. Reuse existing exact-delivery, confirmation, and recovery mechanisms. Retain source guidance in templates rather than editing installed workflow instructions.

## Constraints and invariants

Preserve failure provenance, contracts, verification records, product bytes, unrelated work, and other workflows' focus. Preserve existing completed and abandoned Mission policies. Respect the published design source targets and line caps. Do not manually edit RippleGraph state in this repository or affected user projects.

## Delegated and reserved authority

- Delegated: bounded implementation choices, regression coverage, source guidance updates, independent implementation review, and normal Assignment delivery.
- Reserved for the user: contract approval, test execution approval, real Mission closure acceptance, and any repair of historical state outside this checkout.

## Risks and assumptions

A failed Mission can have a completed runtime at the failed node. Runtime status alone is insufficient cleanup authority. Failure publication can be interrupted before or after Git effects; recovery must preserve the failed state without duplicate commits. Existing cleanup deletions and the untracked thought note in this checkout predate this Assignment and must not be silently adopted or committed as product work.

## Verification authority

Proposed commands, subject to explicit user approval: `node tests/test-mission-environment.js`, `node tests/test-mission-closure.js`, `node tests/test-mission-abandonment.js`, and `node tests/test-reviewloop-modes.js`. Add the new cases to these existing suites where practical. Authorized reruns after fixes remain within this Assignment. No full suite or additional test command is authorized without confirmation.

## Acceptance criteria

- AC-1: Terminal failure publishes an exact recoverable local commit containing the actual failure state, checkpoint, and transition history; retries do not duplicate publication or absorb unrelated changes.
- AC-2: A failed Mission retains its closure and recovery records through successor handoff, successor delivery, and relevant cleanup. The complete sequence ends in confirmed accepted-with-limitations closure without rewriting original failure history. Ambiguous ownership and unauthorized predecessor deletions are refused.
- AC-3: Focus failures distinguish foreground and runtime ownership and provide safe next actions. Missing or inconsistent runtime remains an explicit recovery error; other workflows' focus is preserved.
- AC-4: Relevant primary, repair-verification, and arbitration handoffs provide the exact owned_paths digest convention for regular files, executable files, symlinks, and deletions.
