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
5. Read only the selected lane guidance listed below. Use the linked section of
   the workflow reference; do not read every lane at startup. Read recovery and
   supporting references only when the current action needs them. Reuse guidance
   already read in this session unless it changes.
6. Announce meaningful phase transitions with `Specdev: <action>`. Announce
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

## Lane guidance

Use the matching installed SpecDev skill for a governed lane. The references
below own its detailed rules. Read only the sections needed for the current action.

| Lane | Purpose | Reference |
| --- | --- | --- |
| Direct | Answer, inspect, or write a small non-behavioral document | Instructions above |
| Roadmap | Collaborate on user-approved designs, Forecast, and Todo; no implementation authority | [_guides/workflow.md#roadmap](_guides/workflow.md#roadmap) |
| Adhoc | Make one explicitly selected bounded change, with a receipt and delivery commit | [_guides/workflow.md#direct-and-adhoc](_guides/workflow.md#direct-and-adhoc) |
| Assignment | Deliver one approved contract | [_guides/workflow.md#assignment](_guides/workflow.md#assignment) |
| Mission | Deliver a parent objective through owned Assignment children | [_guides/workflow.md#mission](_guides/workflow.md#mission) |
| Discussion | Explore with product code read-only | [_guides/workflow.md#discussion](_guides/workflow.md#discussion) |
| Test Audit | Inspect tests and propose an exact Assignment; do not change tests | [_guides/workflow.md#test-audit](_guides/workflow.md#test-audit) |

## Shared authority

- Do not edit `.ripplegraph/` manually. RippleGraph owns lifecycle state and
  approval events until work reaches a terminal state. Git stores revisions and
  diffs. Contracts, outcomes, and receipts form the durable record for people.
- Assignment and Mission transitions belong to their semantic commands.
  Generic `specdev step`, `decide`, and `action` cannot advance those graphs.
- Only one focused Assignment or Mission scheduler exists. Discussion and Test
  Audit may coexist through isolated ownership. Only one Adhoc may be active.
  Preserve unrelated work and dirty-path ownership. Before an Adhoc detour,
  read its coexistence and revalidation rules in the linked reference.
- The foreground coding CLI authors Brainstorm with the user. Do not spawn a
  separate Brainstorm author for standalone work. Use
  [skills/core/brainstorming/SKILL.md](skills/core/brainstorming/SKILL.md)
  when forming a contract or Discussion design.
- Approval binds the exact final contract hash. A contract edit invalidates
  approval. Before requesting Assignment or Mission approval, show the exact
  contract path and hash plus a concise 2-4 bullet preview of the objective,
  scope, and key acceptance criteria. The preview never replaces the contract.
- Reviewers inspect and report; they never repair tracked code. Only a review
  launched through `specdev reviewloop` can authorize a workflow transition.
  Native coding CLI review is advisory. Use [guides/review.md](guides/review.md)
  when reviewing.
- Run only authorized verification. Repository confirmation rules take precedence.
  Reuse valid evidence. Never run a full suite when narrower evidence answers the
  question. Read [_guides/workflow.md#verification](_guides/workflow.md#verification)
  before selecting verification, including dependency changes.
- Use the existing checkout for Assignments, Mission children, and Discussions.
  Raw provider output, PID state, SQLite, and scratch data belong in ignored
  `cache/`. Ordinary interrupted source can be inspected and repaired.

## References when needed

- Before Assignment or Mission planning, or when unfamiliar behavior or an
  unexpected failure needs investigation, read
  [_guides/workflow.md#knowledge](_guides/workflow.md#knowledge).
  It owns search, freshness, and knowledge publication rules. Never bulk-load
  knowledge or product source directories.
- For execution profiles, read
  [_guides/workflow.md#profiles-and-guides](_guides/workflow.md#profiles-and-guides).
- Before a delivery commit, read
  [_guides/workflow.md#commit-identity](_guides/workflow.md#commit-identity).
- For runtime ownership, cleanup, or artifact counts, read
  [_guides/runtime.md](_guides/runtime.md).
- Use [_index.md](_index.md) for command and path lookup. Read
  [_guides/update_guide.md](_guides/update_guide.md) for updates and
  [_guides/migration_guide.md](_guides/migration_guide.md) for layout migrations.
