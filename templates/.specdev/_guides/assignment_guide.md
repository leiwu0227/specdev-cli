# Assignment guide

```text
interactive Brainstorm
  -> optional configured review
  -> one hash-bound user approval
  -> one frozen implementation decision (auto | inline | spawned)
  -> foreground inline Design + Implementation by default, or one spawned worker Attempt
  -> focused evidence
  -> required reviewer or evidence-safe policy waiver
  -> owner-preserving repair continuation and same-reviewer verification when needed
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
`follow_up`. `outcome.md` uses the generated canonical structure: `# Outcome`,
followed by `## Delivered behavior`, `## Deviations`, `## Unresolved risks`,
and exactly one three-column `Acceptance | Evidence | Result` table. Each
acceptance ID maps to evidence and a final `Passed`, `Failed`, or `Blocked`
result. Verification receipts classify each command as `qualification` or
`authoritative_acceptance`; classification records evidence and never grants
authority to run a command. A waived implementation review completes only when every acceptance
criterion is Passed, all receipts passed, deviations are empty, and follow-up
is `none`.

Every Assignment handoff receives a replaceable selective context catalog,
ordered as binding authority, current task state, bounded supporting paths, and
permitted same-role history. Entries identify repository-relative durable paths
and purposes; they never copy source contents or replace the owning artifacts.
Missing required authority or task evidence blocks. Optional supporting context
may be absent, but absence never grants permission. Regenerate the projection
on retry or material change. A first independent reviewer receives no author
history, later primary rounds may receive durable prior findings, and fresh
resolver or arbiter roles receive findings as task evidence rather than inherited
reasoning. Mission children may only narrow the parent-selected supporting
envelope and cannot expand parent or child authority.

For a standalone Assignment, the first primary implementation reviewer is
always fresh. A Claude review that requests ordinary repair may create one
ignored, 24-hour, single-use continuation lease for the immediately following
primary repair verification. The lease binds the exact Assignment, role,
provider session, frozen profile and permissions, contract, canonical working
directory, candidate, findings, source Attempt, and round. Any mismatch,
missing or expired state, unrelated candidate path, malformed capture, or resume
failure produces an observable fresh read-only fallback. The continued round is
still a distinct Attempt with a new verdict; durable findings and receipts stay
authoritative. Resolver, arbiter, Mission, format-correction, non-reviewer, and
other-provider paths remain fresh-only. Claude provider-local transcript
persistence enables exact resume, but SpecDev does not retain that transcript or
raw session identity as durable evidence.

Installed configuration uses `implementation.mode: auto | inline | spawned` in
`.specdev/agents.yaml`; omission is `auto`. For an ordinary standalone
Assignment, `auto` freezes to `inline` at the Git boundary and returns a
structured contract for the foreground agent to write the plan, progress,
outcome, result, product changes, and authorized evidence. Rerun
`specdev implement` to validate those artifacts and advance to independent
review. Use fixed `spawned` configuration for unattended automation that relied
on the former mandatory worker launch, or select `--spawned` before the boundary
with a bounded `--execution-reason`. Mission-controlled execution remains
spawned.

When a spawned worker returns blocked, its partial code and artifacts remain in
place. A normal rerun reports the same blocker instead of launching another
provider call. Once the current coding session has completed the artifacts and
changed `worker-result.md` to `status: completed`, rerun `specdev implement` to
reuse them. Use `specdev implement --retry-worker` only when the frozen mode is
spawned and a fresh automatic Attempt is intended. Inline review and artifact
repairs return bounded obligations to the foreground owner; they do not launch
a repair worker.

Review policy is separate from behavior authority:

```yaml
brainstorm: optional # optional | required
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
