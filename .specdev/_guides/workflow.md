# Workflow reference

## Direct and Adhoc

Direct work answers, inspects, or writes a small user-requested documentation
artifact without creating workflow state, a receipt, or an automatic commit.
The write qualifies only when it does not change product, runtime,
public-contract, or governed workflow behavior. For low-risk Direct
documentation, announce once, read destination instructions and only the facts
needed, write first, and verify narrowly; broad project orientation is not a
prerequisite.

Use Adhoc only when the user explicitly chooses it for a concrete bounded edit
but the Assignment contract/review cycle would be ceremony. Adhoc has no
RippleGraph run. `adhoc start` requires an existing Git HEAD and a clean
worktree unless `--adopt-dirty` explicitly adopts the exact expanded eligible
path manifest for all existing changes.

“Does not want an Assignment” means the bounded detour should not become a new
Assignment; it does not terminate unrelated focused work. A standalone
Assignment or Mission may be preserved while its contract is forming or awaiting
approval, and an Assignment may also coexist at a quiescent approved
pre-implementation boundary. Its identity, focus, run, contracts, approvals,
children, artifacts, and Attempts remain outside Adhoc ownership. Established
execution/Git boundaries, unsupported positions, live or ambiguous Attempts,
dirty product work, pending revalidation, or uncertain ownership block before
state creation, and `--adopt-dirty` cannot absorb the conflict.

Focused advancement remains blocked during the detour. Finish and cancel retain
the same focused owner and record a post-detour obligation. Recheck affected
contract assumptions, then run `specdev adhoc revalidate --contract=unchanged
--outcome="<summary>"` before the next approval, execution, or Git boundary.
Reporting `--contract=changed` keeps that gate closed. Shelving and abandonment
remain explicit terminal user choices.

Selecting a bounded file write does not itself select Adhoc. An explicitly
requested coordination or handoff note in another repository is an auxiliary
artifact: write only the note, follow destination instructions, and create no
SpecDev state in the active repository. Re-anchor and classify in the
destination repository when the request changes its product, runtime, or
workflow state, or explicitly requests SpecDev governance there.

Examples make the routing boundary concrete:

- “Write an HTTP usage manual under `project_notes/manual/`” is Direct when it
  documents existing behavior.
- “Write this workflow handoff note into the SpecDev CLI thoughts directory” is
  a Direct auxiliary write governed by that destination's instructions.
- “Use SpecDev Adhoc to update the public API manual and commit it” is Adhoc and
  retains the receipt and final delivery commit.

Callable-owned paths refuse the whole adoption rather than being filtered.
`adhoc finish` requires an unchanged HEAD, verifies the manifest, writes one
small commit-derived receipt, and creates one delivery commit. `adhoc cancel`
removes only the ignored active marker and leaves source changes untouched;
when focused work coexists, both terminal paths leave its revalidation record.
Receipts are not
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

## Roadmap

`specdev roadmap` is an explicitly user-selected, stateless collaboration lane.
It reports the standard files and the writable recursive
`roadmap/designs/**/*.md` plus
`roadmap/forecast.md` boundary without creating or changing state. Every design
Markdown file must contain fewer than 800 words (maximum 799). Besides
`core_concepts.md` and `source_code_folder_structure.md`, each design note must
cover one independent feature or module and minimize overlap with the standard
notes and its peers. The standard notes remain at the designs root; other notes
may use folders that mirror their conceptual parent-child hierarchy. Designs
retain high-level stable abstractions, general concepts, reusable conceptual
templates, deliberate design choices, and their tradeoffs. Examples may clarify
the intended design, but implementation details must not be reproduced.
Except for `source_code_folder_structure.md`, each design note begins with
general descriptions and moves toward more specific detail, while remaining
free to use whatever headings, sections, or other Markdown organization fits
the subject. At the end, every design note except `core_concepts.md` and
`source_code_folder_structure.md` identifies each source file it targets and
gives the maximum total line count for the completed file; no particular format
is required for that ending information. Design notes other than the two
standard cross-cutting notes may include a small relevant folder tree and a
pseudocode section when either helps clarify the design; neither is required.
Outside those permitted illustrations and the deliberate source targets and line
caps, conceptual design notes exclude runtime mechanics, verification history,
code reproduction, and incidental source-code references rather than duplicating
the code.
`forecast.md` is a future-work roadmap of approved design
requirements absent or incomplete in current code. The designs are the target
state: forecast identifies code gaps versus designs, never design gaps versus
code. Code may be a superset; code-only features create neither forecast items
nor automatic design updates. The user separately initiates Roadmap
collaboration to incorporate those features into the designs. When creating or
revising the forecast, the coding agent quickly inspects current code read-only
and lists code gaps in dependency order. Each gap is its own numbered Markdown
section containing fewer than 200 words (maximum 199) and identifies the
Roadmap design note or notes it is based on. For design notes, the coding agent
reports the intended final destination and a concise scope, then writes only
after explicit user approval. Approval authorizes a `*_draft.md` draft within
that agreed direction. After writing the draft, the agent reports only the
draft Markdown path for user inspection. After user approval, the draft is
promoted to the final `.md` path and the agent automatically commits the
published design-note change. The agent reports only that final path and commit.
The agent does not echo the full document or diff unless asked. Product code and
all other paths remain read-only. Roadmap creates no identity, graph, receipt, or
snapshot. Draft writes are not committed automatically; published design-note
changes are committed after user approval. Roadmap does not authorize
implementation of a forecast item. It has no active lifecycle and applies only during explicit
roadmap collaboration. Selecting another lane immediately supersedes Roadmap;
no exit command or state transition is required.

## Discussion

A Discussion is a RippleGraph callable and never becomes the focused scheduler.
It may inspect changing repository state but treats product code as read-only.
Its `brainstorm/proposal.md` and `brainstorm/design.md` remain required, while
useful supporting regular files and nested directories may also live beneath
`brainstorm/`. Completion records start/end revisions and a deterministic
recursive artifact manifest. Promotion creates a fresh Assignment or Mission,
revalidates that exact manifest, and preserves it as provenance. Artifacts
edited after completion must be restored or copied into a new Discussion before
promotion.

## Test Audit

`specdev test-audit "<scope>"` is another isolated callable. It reads product
code and tests but writes only `audit.md` and `assignment-contract.md` in its own
folder. Each removal needs rationale, retained protection, cost impact, and
confidence. `--complete` freezes the artifacts; `specdev assignment
--from-test-audit=TA00001` copies the exact contract into the normal approval
workflow before any test is changed.

## Profiles and guides

`.specdev/agents.yaml` chooses `implementation.mode: auto | inline | spawned`
and the worker/reviewer provider, model, effort, and timeout. Omission defaults
to `auto`, which freezes to inline for an ordinary standalone Assignment;
Mission-controlled execution remains spawned. Ignored
`cache/agents.local.yaml` overrides repository configuration on one machine.
Prompts and up to three selected guides define temporary work; there are no
permanent reviewer personas.
Only `specdev reviewloop` produces a transition-authorizing result envelope.
Native Codex, Claude, or Cursor review sessions remain advisory and their plain
Markdown must not be treated as a SpecDev verdict.

An unwanted nonterminal Mission ends with `specdev mission abandon M00001
--reason="..."`. The first pass is read-only and displays a content-addressed
plan. Only the matching `--confirm=<plan-digest>` may publish the distinct
`abandoned` terminal state. Abandonment preserves Mission/base/child branches,
registered child worktrees, queue, evidence, and partial artifacts; it records
no delivery, performs no landing or deletion, and makes every mutating Mission
command refuse the terminal record.

The first standalone Assignment primary implementation review is fresh. The
Claude adapter may retain one ignored, 24-hour, single-use lease to resume that
exact provider session for the immediately following repair-verification round.
Every binding must match, the repaired candidate must be complete and remain
within the reviewed product-path scope, and the resumed review creates a new
linked Attempt and verdict. Missing, expired, malformed, unsupported, or
mismatched state degrades to a fresh read-only Attempt; a failed resume permits
only one fresh fallback. Resolver, arbiter, Mission, format correction, other
roles, and other providers remain fresh-only. Provider-local transcript
persistence is an operational prerequisite for Claude resume, not a durable
SpecDev artifact or source of evidence.

## Knowledge

Markdown under `knowledge/` is durable; `cache/knowledge.sqlite` is generated.
Read `project_notes/big_picture.md` unconditionally when starting a new
Assignment or Mission. In every other lane, read it only when project-wide
intent is materially relevant; resumed work relies first on its durable
contract and artifacts unless that context is missing, stale, or changed. Use
default precise all-term or quoted-phrase search at the planning or uncertainty
boundary instead of reading every note; reserve `--mode=broad` for explicit
any-term discovery. Narrow noisy
partial matches with distinguishing terms or phrases. Assignment records useful
paths in its plan; Mission searches once and passes relevant paths to children;
Adhoc searches only for unfamiliar behavior or conventions. Search unexpected
symptoms again. Treat matches as historical leads and verify relevant current
code, including hard-coded counts, enumerated families, or other closed-world
assumptions. Reusable constraints missing from living knowledge go through an
evidence-bound, user-approved curation proposal; source is not bulk-indexed or
promoted by search. FAQ entries past `review_after` require explicit
`--include-stale` and revalidation; `status: superseded` stays outside default
scope.

`specdev knowledge curate` scans without authoritative mutation, validates an
exact content-addressed proposal, separates big-picture approval, publishes only
approved Markdown, writes one idempotent receipt, and automatically rebuilds the
disposable index. Resume with `--status`. A failed rebuild leaves published truth
in place and reports `specdev knowledge rebuild`. The legacy `knowledge distill`
brief remains read-only compatibility and is not a publication workflow.
Bounded `--repo-evidence=path#Lstart-Lend` attaches clean tracked current-code
bytes and their Git boundary to a proposal, but never replaces durable-source,
verification, owner, destination-approval, receipt, or rebuild requirements.

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
