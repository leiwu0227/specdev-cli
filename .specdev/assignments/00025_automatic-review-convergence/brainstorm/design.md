# Design: Interactive and automatic review convergence

## Overview

Review behavior is selected by execution mode rather than by phase name.
Top-level Assignment Brainstorm, top-level Mission Brainstorm, and Discussion
review are interactive: each explicit invocation runs one reviewer and returns
the verdict to the user. Assignment implementation and all review work owned by
an approved Mission controller are automatic, including Mission-child
Brainstorm, child implementation, Mission convergence, and recovery after final
verification failure.

This preserves one user authority gate before automatic work begins. It also
keeps the Assignment workflow reusable: the Mission controller supplies
automatic execution policy and child approval without making the Assignment
graph understand Mission semantics.

## Goals

- Prevent unattended work from stopping only because a reviewer used two
  rounds.
- Prevent infinite repair/review loops and serial one-finding-at-a-time review.
- Permit autonomous completion when remaining review disagreement is
  nonblocking and objective delivery evidence is clean.
- Preserve strict contract authority, crash recovery, minimal artifacts, and
  immutable graph-package upgrades.

## Non-Goals

- No permanent resolver or arbiter persona and no per-execution model picker.
- No user-facing numeric review-budget setting.
- No unlimited retries, silent review bypass, or override of failed acceptance
  criteria, failed/skipped receipts, deviations, or required follow-up.
- No automatic amendment of a top-level approved contract.

## Execution Modes

Interactive review has no automatic loop and no hard historic-round lockout.
The user may edit, rerun, override, or approve after seeing the verdict, contract
preview, and exact hash.

Automatic review uses a controller-owned state machine. The mode is internal:
CLI callers cannot turn a top-level interactive review into an automatic one
with a public flag. Mission-child callers pass automatic policy through the
existing internal controller boundary; implementation review is automatic after
contract approval.

## Automatic Convergence

The primary reviewer receives two guaranteed semantic reviews. A successful
repair records the new candidate digest and normalized Findings digest. After
round two, the controller permits one more repair and a third primary review
only when the verdict is `needs_changes`, the candidate changed, and the
findings are not an exact normalized repetition. A `blocked` verdict, stalled
candidate, repeated findings, or failed third round escalates immediately.

Escalation launches one fresh resolver worker with the approved contract,
current candidate, receipts, and consolidated findings. It may rethink or
rewrite the implementation within existing authority. One final arbitration
review then returns exactly one disposition:

- `approved`
- `nonblocking_disagreement`
- `objective_failure`

The primary reviewer prompt requires all currently known blocking findings in
one response. Format-only correction remains limited to one Attempt per
semantic invocation and does not consume a semantic round.

## Final Disposition

Approval advances normally. For implementation, nonblocking disagreement may
advance only when the existing strict review-waiver evidence gate succeeds:
every acceptance criterion is Passed, every verification receipt passed, there
are no deviations, and follow-up is `none`. The controller records the arbiter,
evidence decision, and override reason.

For Mission-child Brainstorm, a nonblocking arbitration result permits the
Mission controller to approve the exact child hash only after structural
contract validation and confirmation that the approved parent hash is still
current. Mission convergence may proceed to the exact final verification when
arbitration says the remaining disagreement is nonblocking.

Objective failure never masquerades as approval. A Mission may append one
bounded repair Assignment within existing authority; exhausting that route
produces a terminal failed outcome. A standalone Assignment produces a terminal
failed outcome. Final verification failure follows the same bounded replan
principle and is never overridden by reviewer judgment.

## Durable State and Recovery

A shared convergence utility owns pure policy decisions. Existing review-state
files move to a version that records mode, stage, primary round, candidate and
findings digests, resolver/arbiter Attempts, and final disposition. Version-one
state is normalized in memory; no manual migration is required.

Only the latest primary verdict and final arbitration result are durable
project artifacts. Intermediate provider output and format corrections remain
in cache. Restarting at any stage reuses valid artifacts and Attempt outcomes
instead of replaying completed work.

## Workflow Graphs

The current `implementation-review → repair → implementation-review` cycle
already supports repeated repair and remains intact. The Assignment graph gains
only the disposition needed for an honest terminal failure. The Mission graph
routes a failed child or convergence result through bounded replan and then to a
terminal failure if objective evidence still fails.

Publish new immutable Assignment and Mission graph versions. `specdev update`
installs them alongside older packages so in-flight runs continue using their
pinned graph versions.

## Success Criteria

- Interactive reviews can be explicitly invoked beyond two historic rounds
  without automatic repair or arbitration.
- Automatic review performs two primary rounds, conditionally performs a third
  only while progressing, and otherwise escalates exactly once.
- Automatic review never emits “user direction required” merely because the
  round count was exhausted.
- Evidence-safe override cannot advance a candidate with failed acceptance,
  receipts, deviations, or follow-up.
- Objective failure is finite and explicit; no review, replan, or verification
  path can loop indefinitely.
- Interrupted convergence resumes from durable state.

## Testing Approach

Add pure policy tests for each state transition and focused command/graph tests
for interactive round reuse, progress and stall detection, immediate blocked
escalation, conditional third review, resolver/arbitration, safe override
rejection, objective failure, graph version pinning, and restart at every
automatic stage. Full-suite and lint execution remain subject to explicit user
approval.
