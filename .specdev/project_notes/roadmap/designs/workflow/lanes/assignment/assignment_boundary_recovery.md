# Assignment Boundary Recovery

Parent design: `./assignment_lane.md`

A Git boundary separates approved Assignment work from later repository changes.
An intervening commit must not silently become part of that authority. Explicit
recovery lets a standalone Assignment continue after an accepted change to its base
without replacing its identity or discarding implementation work.

Recovery applies to an unfinished standalone Assignment with an established boundary
at a quiescent implementation or review position. Terminal Assignments retain their
existing continuation rules. Mission children remain under parent authority. Live
or ambiguous worker, reviewer, or controller activity prevents confirmation.

The target interface is `specdev assignment revalidate-boundary <id>` for inspection
and the same command with `--confirm=<plan-digest>` for acceptance. A changed-HEAD
diagnostic names this supported recovery path. Inspection does not advance the
effective boundary or grant implementation authority.

The preview identifies the original and effective boundaries, current branch and
HEAD, intervening commits and changed paths, approved and current contract hashes,
implementation owner and mode, and exact candidate identity. It distinguishes owned
and unrelated staged, unstaged, and untracked changes. It identifies affected
evidence and review results and explains the proposed authority and state changes.
The commit range must descend from the effective boundary; divergent history needs
explicit resolution outside this operation.

Confirmation binds to the exact preview. Changed HEAD, contract, candidate, ownership,
activity, or applicable workflow state invalidates it. Acceptance authorizes only
the named intervening range. It does not adopt unrelated dirt, change files, rewrite
Git history, transfer implementation ownership, or skip a lifecycle obligation.
The owning semantic command advances the effective boundary and preserves the
original boundary, approval provenance, and each accepted range in durable history.

Design publication is not proof of compatibility with the contract. Recovery records
an explicit assessment of the intervening changes against approved scope and
acceptance criteria. File extensions cannot establish harmlessness. Uncertain
authority blocks continuation. Material scope changes require a revised contract
and normal reapproval before implementation resumes. Compatible changes retain the
existing approval together with the recovery authorization; recovery does not
rewrite the original approval as if it had covered a different base.

Evidence is reusable only when its relevant inputs and acceptance obligations remain
unchanged. Recovery records that assessment and requires replacement evidence where
applicability cannot be established. Affected candidate-bound review results lose
authority. Required review remains required, and normal candidate qualification,
review, repair, and delivery resume through their owning commands. Final delivery
includes only owned changes and retains the accepted-range provenance.

Interrupted confirmation is recoverable from durable preparation and completion
records. A retry completes the same accepted operation without duplicating history
or accepting newer changes. Partial recovery cannot authorize ordinary advancement.
Recovery preserves working files, unrelated workflow artifacts, and the frozen
execution mode. It does not require reset, rebase, or manual graph edits.

## Source Targets

- `src/commands/assignment.js` — maximum 550 lines — semantic recovery routing.
- `src/commands/assignment-boundary.js` — maximum 500 lines — preview, exact confirmation, and recoverable boundary acceptance.
- `src/utils/assignment-delivery.js` — maximum 1200 lines — effective boundary validation and delivery provenance.
- `src/commands/implement.js` — maximum 800 lines — normal continuation and approval enforcement.
- `templates/.specdev/_guides/assignment_guide.md` — maximum 140 lines — supported recovery guidance.
