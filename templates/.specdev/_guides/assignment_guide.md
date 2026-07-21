# Assignment guide

```text
interactive Brainstorm
  -> optional configured review
  -> one hash-bound user approval
  -> one normal worker Attempt for Design + Implementation
  -> focused evidence
  -> required reviewer or evidence-safe policy waiver
  -> one repair continuation and same-reviewer verification when needed
  -> complete
```

The single `brainstorm/contract.md` records objective, scope/non-goals,
behavior, decisions, constraints, authority, risks, verification authority, and
inline acceptance IDs. Do not create a parallel YAML projection.

Keep the contract proportional to the change. Reference existing project notes
and repository rules instead of restating them, and state only decisions or
constraints specific to this work. Use the fewest independent observable
acceptance criteria: normally 1-3 for a small change and rarely more than 5.
Implementation tasks, file lists, generic quality expectations, and repeated
project conventions belong in the plan or existing guidance, not acceptance
criteria. A required section may say that no change-specific item exists.

`design/plan.md` uses ordered Task IDs and acceptance references. Tasks run
inline by default; they do not imply subagents, worktrees, commits, reviews, or
full suites. `implementation/progress.json` owns compact Task state, selected
guide IDs and versions, verification receipts, structured `deviations`, and
`follow_up`. `outcome.md` maps every acceptance ID to evidence and a final
result. A waived implementation review completes only when every acceptance
criterion is Passed, all receipts passed, deviations are empty, and follow-up
is `none`.

When the worker returns blocked, its partial code and artifacts remain in
place. A normal rerun reports the same blocker instead of launching another
provider call. Once the current coding session has completed the artifacts and
changed `worker-result.md` to `status: completed`, rerun `specdev implement` to
reuse them. Use `specdev implement --retry-worker` only when a fresh automatic
Attempt is intended.

Review policy is separate from behavior authority:

```yaml
brainstorm: optional      # optional | required
implementation: required # required | waived
```

Set it at Assignment creation with `--brainstorm-review` and
`--implementation-review`, or on `specdev approve brainstorm`. Approval freezes
it with the contract hash.

Standalone Brainstorm review is optional by default. Multi-child Mission
contracts receive it because the Mission supplies child approval. A single
full-scope Mission child is derived from the approved parent and skips duplicate
contract author/reviewer calls, while its implementation review remains
required.
