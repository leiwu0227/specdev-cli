# SpecDev workflow

The tracked `.specdev/` directory stores portable workflow state.
The current coding CLI works with the user. Run the Node.js CLI directly as
`specdev <command>`. Never install or run it with Python tools.

Resolve the launcher once per shell or session. Use the executable workspace
wrapper when present. Otherwise, use the command on PATH. The following code
does not try to run a missing wrapper:

```sh
if [ -x .specdev/cache/bin/specdev ]; then
  SPECDEV_LAUNCHER=.specdev/cache/bin/specdev
else
  SPECDEV_LAUNCHER="$(command -v specdev)"
fi
[ -n "$SPECDEV_LAUNCHER" ] || { echo "specdev launcher not found" >&2; exit 127; }
"$SPECDEV_LAUNCHER" <command>
```

## Prose style

Use ASD-STE100 Simplified Technical English as the default style guide for all
coding-agent prose in every lane. This includes questions, progress updates,
explanations, final responses, plans, reviews, and prose in written artifacts.
Write short, direct sentences with one main idea each. Prefer active voice.
Use technical terms consistently. Allow natural wording and established software
terms when strict STE would reduce clarity or precision.

The 80% aim describes flexibility, not a score or acceptance threshold.
Formal dictionary compliance is not required. Preserve meaning and required detail.
Keep exact quotations, paths, commands, identifiers, code, and required output
formats unchanged. Existing document structure and word limits still apply.
Apply this style when writing or editing prose; do not rewrite unrelated text.

SpecDev's own prose follows the same rule. This includes guides, skills, prompts,
template instructions, CLI help and errors, design notes, and user documentation.
Update actively used guidance first. Update other prose when its files change.
Keep historical contracts, receipts, and review records unchanged.
Check that the text is clear, direct, consistent, and complete. Do not add a
compliance score or approval gate for this style.

## Start here

1. Read repository instructions. Always read
   `.specdev/project_notes/big_picture.md` before a new Assignment or Mission.
   For other lanes, read it only when the project's overall intent matters.
   Resume from the existing contract and artifacts first. Read wider context
   if that information is missing, stale, or changed. A command that inspects
   or edits `big_picture.md` still reads that file.
2. Classify the user's request before creating anything: Direct, Roadmap,
   Adhoc, Discussion, Assignment, or Mission. Recommend a lane when useful, but
   let the user select it. Never silently turn every request into an Assignment.
3. Run `specdev next --json` only when resuming a focused RippleGraph workflow.
4. For explicit identities use `specdev mission status M00001` or `specdev
discussion D00001`.
5. Announce meaningful phase transitions with `Specdev: <action>`. Announce
   plan changes, failed verification, and blockers immediately; repeated
   read-only probes within an announced phase need no additional message.

Questions, explanations, status checks, read-only inspection, and small
user-requested documentation artifacts are **Direct** when they do not change
product, runtime, public-contract, or governed workflow behavior. Handle them
without a graph, receipt, or automatic commit. A Markdown extension alone does
not make an artifact Direct. A user instruction such as “directly”, “just do
it”, “skip SpecDev”, or “no assignment” rules out an Assignment unless the user
later chooses one.

For a Direct documentation write, announce the write once, read destination
instructions and only the facts needed for the artifact, write first, and
verify narrowly. Do not require `big_picture.md`, broad source inspection, or a
nearby example unless the requested document or an uncertain fact needs them.
For example, writing an HTTP usage manual under `project_notes/manual/` is
Direct when it only records existing behavior. “Use SpecDev Adhoc to update the
public API manual and commit it” explicitly selects governed Adhoc work.

An explicit request to write a bounded coordination or handoff note into another
repository is an auxiliary write, not an implicit Adhoc selection or a reason to
create SpecDev state in the active repository. Write only that note, honor the
destination repository's instructions, and report the write normally. If the
request changes the destination repository's product, runtime, or workflow
state, or explicitly requests SpecDev governance there, re-anchor in that
repository and classify the work there before editing.

Do not edit `.ripplegraph/` manually. RippleGraph owns lifecycle state and
approval events until work reaches a terminal state. Git stores revisions and
diffs. Contracts, outcomes, and receipts form the durable record for people.
Successful Mission and standalone Assignment completion preserves a compact
activity summary. It then removes the terminal run and its owned Attempt records.
Attempt execution records use IDs such as `Attempt-00001`; they are temporary
worker, reviewer, or controller invocations, not Assignment identities. Legacy
`ATT-*` records may remain while older in-flight work resumes.
Successful Assignment, Discussion, and Mission completion also removes owned
raw logs and scratch results. Discussion completion preserves compact durable
completion/activity metadata for listing and promotion. Explicit abandonment
cleans owned temporary cache after its terminal record is preserved. Active,
interrupted, failed/recoverable, and shelved work retains diagnostic cache.
Use `specdev cleanup` to preview eligible leftovers and reclaimable bytes;
`specdev cleanup --apply` revalidates ownership before removing them. Both accept
`--json`. Unknown ownership, live/uncertain Attempts, symlinks, and unsafe paths
are retained and reported. Shared caches and durable evidence are preserved.
Assignment and Mission transitions are owned by their semantic commands;
generic `specdev step`, `decide`, and `action` cannot advance those graphs.

For project reviews, start with `missions/` and `assignments/`. They hold the
approved authority, delivery evidence, and outcomes. Keep installed workflow
packages and skills as durable infrastructure. RippleGraph checkpoints and
process records support recovery until work reaches a terminal state.
In summaries for people, count or group these records rather than list every file.

When an unfamiliar repository-specific failure or recurring hazard appears,
search living knowledge with `specdev knowledge search "<keyword bag>"`.
Search matches all terms or quoted phrases by default. Narrow partial or noisy
results. Use `--mode=broad` only when you want matches for any term. Use
`--include-stale` only to recover older guidance and verify it before relying on
it. Assignment planning searches with objective terms and carries useful paths
into its plan. Mission planning searches once, gives relevant paths to children,
and lets children search again only for child-specific unknowns. Adhoc searches
only when behavior or conventions are unfamiliar. Unexpected symptoms trigger a
second symptom-focused search. Treat results as historical leads, inspect
current code for relevant hard-coded or closed-world assumptions, and route a
reusable missing constraint through approved evidence-bound curation. Never
bulk-load knowledge or product source directories.

`specdev knowledge curate` is the bounded publication workflow: scan, draft,
validate, exact user approval, journaled Markdown publication, durable receipt,
and automatic index rebuild. Big-picture proposals require a separate exact
approval. `specdev knowledge distill` remains a compatibility-only read-only
brief; it never launches an agent or rewrites knowledge.
Bounded `--repo-evidence=path#Lstart-Lend` can bind clean tracked current-code
bytes and their Git revision to a proposal, but does not replace durable source,
verification, ownership, destination approval, or rebuild requirements.

## Work types

- **Direct:** questions, explanations, status, read-only inspection, and small
  non-behavioral user-requested documentation artifacts. No workflow, durable
  receipt, or automatic commit.
- **Roadmap:** explicitly user-selected, stateless collaboration on
  `project_notes/roadmap/forecast.md`, `project_notes/roadmap/todo.md`, and
  direct Markdown files under `project_notes/roadmap/designs/`. Run
  `specdev roadmap`; show the exact
  proposed edit and obtain user approval before writing. Every design file must
  contain fewer than 800 words (maximum 799). Besides `core_concepts.md` and
  `source_code_folder_structure.md`, each note covers one independent feature
  or module with minimal overlap. Except for
  `source_code_folder_structure.md`, each design note begins with general
  descriptions and moves toward more specific detail without requiring fixed
  sections or a particular Markdown format. Except for `core_concepts.md` and
  `source_code_folder_structure.md`, each note ends by identifying every
  targeted source file and giving the maximum total line count for the completed
  file, and may include a small relevant folder tree or pseudocode when helpful
  for clarifying the design. Neither illustration is required. Only when the
  user explicitly requests a separate public-function design note, suggest
  concise typed signatures aligned with the implementation or approved target.
  Classes use CapCase; named instances and returned values use `snake_case`.
  Show the return type and briefly describe the returned value. This is optional
  guidance, not a standard filename, scaffold, fixed format, or validation rule.
  `forecast.md` is
  a future-work roadmap of
  approved design requirements absent or incomplete in current code. Treat the
  designs as the target state: identify code gaps versus designs, never design
  gaps versus code. Code may be a superset; code-only features create neither
  forecast items nor automatic design updates. The user separately initiates
  Roadmap collaboration to incorporate those features into the designs. Quickly
  inspect current code read-only and list code gaps in dependency order, one
  numbered Markdown section per gap. Every forecast section must identify the
  Roadmap design note or notes it is based on and contain fewer than 200 words
  (maximum 199). `todo.md` records user-selected non-architecture future work,
  not design-derived gaps. It uses the same dependency order followed by user
  priority, numbered-section format, and fewer-than-200-word limit, but omits
  provenance metadata and `Based on:` references. For design notes, report the
  intended final destination and
  concise scope, then write an approved `*_draft.md` draft and report only the
  draft path. After user approval, promote it to the final `.md` path and
  automatically commit the published design-note change. Report only the final
  path and commit. Do not echo full content or diffs unless asked. Product code
  and every other path are read-only. Roadmap creates no ID, workflow state,
  receipt, or snapshot. Draft writes are not committed automatically; published
  design-note changes are committed after user approval. Roadmap grants no
  authority to implement Forecast or Todo items. It has no active lifecycle and
  applies only during
  explicit roadmap collaboration. Selecting another lane immediately supersedes
  Roadmap without an exit command or state transition.
- **Adhoc:** one explicitly user-selected bounded repository change with no graph,
  scheduler, subagent, worktree, or approval gate. It records one concise
  receipt and one final Git commit. Start with `specdev adhoc start "<scope>"`.
- **Assignment:** one readable contract, one user approval, then automatic
  Design + Implementation + evidence + review.
- **Mission:** a foreground controller in the existing checkout. Immediately
  after approval, explicitly choose inline (main session) or spawned workers.
  Both execute sequential children with independent review and local checkpoints.
  Mission is user-selected and does not imply multiple children.
- **Discussion:** a concurrent code-read-only RippleGraph callable with required
  proposal/design entry points plus safe supporting artifacts and nested folders;
  it may later be promoted to fresh work.
- **Test Audit:** a concurrent code-read-only callable that proposes exact test
  pruning and a ready Assignment contract; it never removes tests itself.

Only one focused Assignment or Mission scheduler exists. Discussion and Test
Audit callables may coexist because their checkpoints are isolated. Adhoc is not
a scheduler, but only one may be active in a worktree.

## Hard rules

- The foreground coding CLI authors Brainstorm with the user; do not spawn a
  separate Brainstorm author for standalone work.
- Assignment Brainstorm review defaults to optional and implementation review
  defaults to required. The user may freeze another supported policy at
  contract approval. A review waiver never waives acceptance evidence.
- Mission Brainstorm review is optional and never approves the contract.
  Multi-child Mission contracts receive review; a deterministic full-scope
  single child reuses the approved parent authority without another Brainstorm
  author or reviewer.
- Mission approval stops at an explicit no-default implementation choice. Inline
  assigns every child implementation, repair, and resolver to the current main
  coding session; the Mission skill fulfills each returned obligation and reruns
  the controller without routine user interaction. Spawned retains automatic
  workers executing children sequentially. Reviewers remain independent in both modes.
- Mission abandonment is a reasoned two-step terminal command. Its first pass is
  read-only; exact confirmation preserves branch and worktree identities, records
  no delivery, compacts only owned runtime, and never lands or deletes partial work.
- Approval binds the exact final contract hash. A contract edit invalidates approval.
- Before requesting Assignment or Mission contract approval, show the exact
  contract path and hash plus a concise 2-4 bullet preview covering objective,
  scope, and key acceptance criteria. The preview never replaces the contract.
- Adhoc classifies dirty product paths separately from independent Discussion
  and Test Audit state. Concurrent callable state is preserved outside Adhoc
  ownership; dirty product paths still require inspection, a separate
  checkpoint, or explicit adoption. Assignment enforces the same product-tree
  decision immediately before implementation.
- Adhoc may temporarily coexist with a focused standalone Assignment or Mission
  while its contract is forming or awaiting approval, and with an Assignment at
  a later quiescent pre-implementation boundary. The focused identity, run,
  contracts, approvals, children, artifacts, and Attempts stay outside Adhoc
  ownership; established execution or Git boundaries, unsupported positions,
  live or ambiguous Attempts, dirty product paths, pending revalidation, and
  uncertain ownership block before mutation. Focused advancement remains
  blocked throughout the detour. Finish or cancel creates a durable obligation
  to recheck affected assumptions and run `specdev adhoc revalidate
--contract=unchanged --outcome="<summary>"` before the next approval,
  execution, or Git boundary. Shelving and abandonment remain explicit terminal
  user choices, never implicit Adhoc prerequisites.
- SpecDev-owned delivery commits carry `SpecDev-*` trailers. Adhoc and
  standalone Assignment create one final delivery commit; Mission checkpoints,
  child deliveries, integrations, and completion identify their commit type.
- Reviewers inspect and report; they never repair tracked code.
- Only a review launched through `specdev reviewloop` can authorize a workflow
  transition. A coding CLI's native review command is advisory because it does
  not receive or validate the strict SpecDev result envelope.
- Never run a full suite when narrower evidence answers the current question.
  Repository confirmation rules always take precedence.
- Use the existing checkout for Assignments, Mission children, and Discussions.
- Raw provider output, PID state, SQLite, and scratch data belong in ignored
  `cache/`; ordinary interrupted source can be inspected and repaired.
- A reviewed Mission child that only exceeds automatic authority pauses at an
  exact user-reapproval identity. Repeated `mission run` and `mission status`
  calls are provider-free until the user runs the displayed
  `mission approve-divergence` or `mission reject-divergence` command.
- Assignment implementation mode freezes at its Git boundary. Inline work and
  repairs return resumable foreground obligations; spawned work preserves its
  worker result and returns a blocked outcome. Finish the owned artifacts and
  rerun to resume. Use `specdev implement --retry-worker` only for a frozen
  spawned implementation that needs a replacement Attempt.

See `_index.md` for paths and `_guides/workflow.md` for the concise lifecycle.
