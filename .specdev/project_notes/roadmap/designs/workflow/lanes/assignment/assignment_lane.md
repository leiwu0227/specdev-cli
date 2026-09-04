# Assignment Lane

Parent design: `../workflow_lanes.md`

Assignment delivers one product change under an exact readable contract. Its defining
boundary is approved authority, not code size. A standalone Assignment receives user
approval; a Mission child receives a bounded delegation from the approved parent.

The contract records objective, scope and behavior, constraints, decision boundaries,
acceptance criteria, verification commands, and review policy. Creation requires
filled project context, reserves an ID atomically, establishes focus, and may preserve
completed Discussion, Test Audit, prior Assignment, or Mission provenance. Approval
binds the exact contract hash and Git base. Material edits invalidate approval.

The RippleGraph lifecycle moves through Brainstorm, optional Brainstorm review, exact
approval, design and implementation, candidate qualification, required review or
approved waiver, repair or divergence handling, evidence capture, and delivery.
Generic graph commands cannot advance its semantic boundaries.

Execution freezes an implementation owner and Git boundary before product mutation.
Inline and spawned modes share the same contract, artifacts, evidence, candidate
identity, review policy, and delivery rules. Plans translate authority into work but
cannot redefine it.

Acceptance evidence addresses every criterion and remains bound to the current
candidate. Candidate preflight keeps predictable artifact repair with the
implementation owner before reviewer resources are used. Review findings return to
that owner; material divergence requires explicit user reapproval rather than silent
scope expansion.

Standalone success creates one verified delivery commit, durable outcome, and compact
activity history. Mission children hand reviewed results to the parent controller
instead of independently landing the integrated objective. Shelving and unsupported
closure preserve explicit terminal meaning and never discard user work by implication.
Historical abandoned state remains compatibility data rather than a current close mode.

Discussion and Test Audit may coexist because they are product-read-only. Adhoc may
detour only at supported quiescent pre-execution boundaries and must be revalidated
before the Assignment advances.

Child designs own execution modes, selective context, candidate preflight, reviewer
continuation, and terminal operations.

## Source Targets

- `src/commands/assignment.js` — maximum 550 lines — creation, promotion, recovery, and command routing.
- `src/commands/approve.js` — maximum 220 lines — exact contract approval and review policy binding.
- `src/commands/checkpoint.js` — maximum 160 lines — Brainstorm contract validation.
- `src/commands/focus.js` — maximum 130 lines — explicit focused identity selection.
- `src/utils/assignment.js` — maximum 180 lines — assignment path and selector resolution.
- `src/utils/assignment-lifecycle.js` — maximum 80 lines — lifecycle status mapping.
- `templates/.specdev/workflows/assignment-lifecycle/graph.json` — maximum 360 lines — recoverable Assignment graph.
