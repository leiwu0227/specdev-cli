# Workflow reference

## Direct and Adhoc

Direct work answers or inspects without creating state. Use Adhoc only when the
user chooses a concrete bounded edit but the Assignment contract/review cycle
would be ceremony. Adhoc has no RippleGraph run. `adhoc start` requires an
existing Git HEAD and a clean worktree unless `--adopt-dirty` explicitly adopts
all existing changes. `adhoc finish` requires an unchanged HEAD, writes one
small receipt, and creates one delivery commit. `adhoc cancel` removes only the
ignored active marker and leaves source changes untouched. Receipts are not
knowledge-index sources; `knowledge/workflow/adhoc-history.md` explains the
explicit receipt and Git search path.

## Assignment

Use `_guides/assignment_guide.md`. Approval is the only routine user gate;
successful evidence and implementation review complete automatically.
The Git boundary is established immediately before implementation. Existing
product changes require an explicit inspect/checkpoint/adopt decision. A
standalone Assignment ends in one host-owned delivery commit; Mission children
remain owned by the Mission controller.

## Mission

A Mission is a static foreground workflow with a simple static-wave
`design/assignments.yaml` queue. The contract defaults to `Initial child plan:
single`; use `planned` only for a worker context limit, an information
dependency, an intermediate decision, or independent verification/rollback.
File count and multiple Tasks are not split reasons. A full-scope single child
is derived from the approved Mission contract and its exact implementation
review may satisfy Mission convergence when the candidate digest still matches.
The Mission contract follows the same proportionality rule as an Assignment:
reference project context, avoid plan details, and keep only independent
observable acceptance criteria. Multi-child contracts are concise deltas that
inherit parent authority rather than reproducing the Mission brainstorm.
Replanning occurs only for blocking review/evidence or an explicit required
follow-up. Children that do not depend on one another may share a wave. The
foreground controller automatically runs up to three children in validated
ignored worktrees and integrates reviewed deliveries in declared order. Users
do not tune concurrency, and parallel speed is not a reason to split work.

## Discussion

A Discussion is a RippleGraph callable and never becomes the focused scheduler.
It may inspect changing repository state but treats product code as read-only.
Completion records start/end revisions and an artifact hash. Promotion creates a
fresh Assignment or Mission and revalidates assumptions. Artifacts edited after
completion must be restored or copied into a new Discussion before promotion.

## Test Audit

`specdev test-audit "<scope>"` is another isolated callable. It reads product
code and tests but writes only `audit.md` and `assignment-contract.md` in its own
folder. Each removal needs rationale, retained protection, cost impact, and
confidence. `--complete` freezes the artifacts; `specdev assignment
--from-test-audit=TA00001` copies the exact contract into the normal approval
workflow before any test is changed.

## Profiles and guides

`.specdev/agents.yaml` chooses worker/reviewer provider, model, effort, and
timeout. Ignored `cache/agents.local.yaml` overrides it on one machine. Prompts
and up to three selected guides define temporary work; there are no permanent
reviewer personas.

## Knowledge

Markdown under `knowledge/` is durable; `cache/knowledge.sqlite` is generated.
Use default OR search for unfamiliar repository behavior. FAQ entries past
`review_after` require explicit `--include-stale` and revalidation; entries with
`status: superseded` are outside default scope. `specdev knowledge distill`
prepares a bounded, read-only source brief for the current coding CLI and never
spawns another agent.

## Verification

Focused evidence first. Reuse the same command on the same revision. A
standalone Assignment may run a full suite at most once only when approved scope
requires it. Mission children never run the full suite; the Mission may run one
exact final integrated command per final candidate. Repository instructions can
require an additional explicit user confirmation.

When work adds or upgrades an external dependency, resolve its version from the
package manager or registry during the Attempt and inspect available lockfile
and audit evidence. Direct high/critical advisories block review unless the
approved contract explicitly accepts them. Lockfile-only resolution is not
install or launch evidence.

## Commit identity

Authoritative SpecDev commits use trailers: `SpecDev-Adhoc`,
`SpecDev-Assignment`, and/or `SpecDev-Mission`, plus `SpecDev-Commit-Type`.
Commit hashes are derived from Git when needed. Do not put an ending commit hash
inside an artifact that is part of that same commit.
