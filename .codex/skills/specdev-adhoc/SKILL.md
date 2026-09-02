---
name: specdev-adhoc
description: Run a user-explicitly-selected Adhoc change without a RippleGraph workflow
---

Use Adhoc only when the user selects a concrete bounded repository change and
does not want that detour to become another Assignment. This does not reject or
terminate an unrelated active Assignment. Start with `specdev adhoc start
"<scope>"`.

Read `.specdev/project_notes/big_picture.md` only when project-wide intent is
materially relevant to the bounded change. When repository behavior,
conventions, or a recurring failure is unfamiliar, run a bounded
`specdev knowledge search "<objective or symptom terms>"` before planning.
Precise all-term and quoted-phrase matching is the default; narrow partial or
noisy results with distinguishing terms or a quoted phrase, and use explicit
`--mode=broad` only for any-term discovery. Do not bulk-read knowledge
directories. Treat matches as historical leads, verify relevant behavior in
current code, and check for hard-coded counts, enumerated families, or other
closed-world assumptions. Use `--include-stale` only to inspect older guidance
and revalidate it before use. Search again with exact terms when implementation
produces an unexpected symptom. If code verification exposes a reusable missing
constraint, send it through an evidence-bound, user-approved `knowledge curate`
proposal; source code is not bulk-indexed or promoted by search alone.

A bounded file write request has not thereby selected Adhoc. In particular, an
explicit coordination or handoff note written into another
repository is an auxiliary artifact: write only that note, honor destination
instructions, and do not create SpecDev state in the active repository. If the
request instead changes the destination repository's product, runtime, or
workflow state, or explicitly requests SpecDev governance there, re-anchor in
that repository and classify the work there before editing.

For example, "write an HTTP usage manual under project notes" is Direct when
the artifact does not change product behavior or public contracts. "Use SpecDev
Adhoc to update the public API manual and commit it" explicitly selects this
governed lane and retains its receipt and final-commit guarantees.

Start classifies every expanded dirty path before creating state. Independent
Discussion and Test Audit paths remain outside Adhoc ownership; requesting
`--adopt-dirty` while any such path is present refuses the whole adoption and
reports every rejected owner and recovery action. An accepted adoption persists
the exact path/status manifest at the starting revision. Use `--title="..."`
when the commit needs a short subject independent of the full receipt scope.

An active standalone Assignment or Mission may coexist while its contract is
being formed or considered for approval, and an Assignment may also coexist at
its quiescent approved pre-implementation boundary. Focus, lifecycle run,
contracts, approvals, Mission children, artifacts, and Attempt records remain
preserved outside Adhoc ownership. An execution or Git boundary, unsupported
position, live or ambiguous worker/reviewer/controller Attempt, dirty product
path, pending revalidation, or uncertain ownership blocks Adhoc before state is
created. `--adopt-dirty` cannot absorb those conflicts. Focused-workflow
commands remain blocked until the detour finishes or is cancelled; shelving and
abandonment remain explicit terminal user authority.

Finish and cancel retain the same focused identity and leave a durable
post-detour obligation. Recheck affected contract assumptions against the
current repository, then run `specdev adhoc revalidate --contract=unchanged
--outcome="<summary>"` before the focused workflow crosses its next approval,
execution, or Git boundary. Use `--contract=changed` to report material change
without clearing the gate; revise unapproved authority or explicitly terminate
and replace approved authority rather than claiming it is still valid.

Make the change directly without a scheduler, worktree, subagent, or approval
gate. Verification execution always requires repository/user authorization.
After authorization, structured evidence may be captured with `specdev adhoc
verify --label="..." -- <command>`; failed attempts and passing reruns remain
in the receipt. Finish with `specdev adhoc finish --outcome="..."` when the
latest evidence for each label passes, or retain the supported manual
`--verification="..."` summary. Finish stages the persisted manifest plus
valid Adhoc-owned paths through an exact temporary-index transaction and clears
active state only after the delivery commit and remaining owned delta verify.
Its requested, committed, rejected, and remaining facts come from Git rather
than outcome prose.
`specdev adhoc cancel` leaves source changes untouched.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
