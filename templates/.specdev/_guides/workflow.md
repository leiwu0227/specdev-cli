# Workflow reference

## Direct and Adhoc

Direct work answers or inspects without creating state. Use Adhoc only when the
user chooses a concrete bounded edit but the Assignment contract/review cycle
would be ceremony. Adhoc has no RippleGraph run. `adhoc start` requires an
existing Git HEAD and a clean worktree unless `--adopt-dirty` explicitly adopts
the exact expanded eligible path manifest for all existing changes.

Selecting a bounded file write does not itself select Adhoc. An explicitly
requested coordination or handoff note in another repository is an auxiliary
artifact: write only the note, follow destination instructions, and create no
SpecDev state in the active repository. Re-anchor and classify in the
destination repository when the request changes its product, runtime, or
workflow state, or explicitly requests SpecDev governance there.

Callable-owned paths refuse the whole adoption rather than being filtered.
`adhoc finish` requires an unchanged HEAD, verifies the manifest, writes one
small commit-derived receipt, and creates one delivery commit. `adhoc cancel` removes only the
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

An approved standalone Assignment may instead reach a successful negative
conclusion with `specdev assignment close <id> --outcome=unsupported`. The user
must provide a reason and written evidence, inspect the exact HEAD/ownership
plan, and confirm it with `--snapshot=owned`. SpecDev then records
`unsupported.md` and terminal status, compacts only owned runtime, clears focus,
and publishes those effects as one exact commit. Concurrent or unattributed
dirt remains unstaged and is reported by owner. Unsupported history is
immutable; `specdev assignment --from-assignment=<id>` creates a fresh contract,
approval, evidence, and delivery boundary.

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
After approval, blocking review/evidence and explicit required follow-up open
stable durable gaps. Each gap receives a focused resolution Assignment and,
when it remains unresolved, advances automatically through resolver and
arbiter stages without sharing another child's recovery allowance. Repair
descendants retain their parent gap identity, restarts deduplicate the same
signal, and terminal semantic, authority, and infrastructure failures remain
distinct. Children that do not depend on one another may share a wave. The
foreground controller automatically runs up to three children in validated
ignored worktrees and integrates reviewed deliveries in declared order. Users
do not tune concurrency, and parallel speed is not a reason to split work.

A planned child may use `execution: evidence-only` only with an exact
`observation_command` equal to the Mission final-verification command. A
negative observation remains failed evidence but returns as
completed-with-follow-up so the Mission can open a repair gap. Ordinary
implementation children cannot use that disposition.

`specdev mission adopt-successor M00001 --assignment=00042` is exceptional
recovery for an active Mission blocked inside its owned child. The first call is
read-only and prints a content-addressed plan; `--confirm=<snapshot>` applies
only that unchanged plan. Candidate ancestry, contract/review/evidence hashes,
the exact command and environment policy, cleanup identity, predecessor
authority, and excluded dirt all fail closed. Adoption links superseding
evidence and returns the nested graph without rerunning a provider or command.

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
Only `specdev reviewloop` produces a transition-authorizing result envelope.
Native Codex, Claude, or Cursor review sessions remain advisory and their plain
Markdown must not be treated as a SpecDev verdict.

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
