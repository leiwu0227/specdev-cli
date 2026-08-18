# Small documentation write workflow drag

Date: 2026-08-18

Context: live testing in `dataportal`. The user asked for one Markdown usage
note under `.specdev/project_notes/manual` explaining the Bloomberg HTTP API for
coding agents.

## What happened

The request was a small, explicit file write. I initially selected the
`specdev-adhoc` skill because the task looked like a bounded repository change.
After reading that skill, I found its stricter rule:

> A bounded file write has not thereby selected Adhoc.

I then corrected the lane to a direct requested artifact write and did not
create Adhoc state or a delivery commit. Before writing, however, I had already:

1. announced an Adhoc workflow;
2. read the Adhoc skill and the main workflow;
3. read `big_picture.md`;
4. inspected the repository's Bloomberg routes, schemas, cache behavior,
   authentication, configuration, sidecar boundary, and frontend adapters;
5. drafted a much broader guide than the user wanted.

The user interrupted with: "u just need to write it, what are you inspecting?"
After I wrote the broad guide, the user clarified again that only the HTTP API
endpoint documentation was needed.

The final result was easy. The path to it was not.

## Drag attributable to the workflow

### 1. Lane selection is circular for small writes

The top-level task description makes Adhoc look like the natural lane for one
bounded change, while the Adhoc skill says the user must explicitly select it
and that a bounded file write is insufficient. An agent must select and fully
read the skill to discover that it should not have selected the skill.

This is particularly awkward when the host's skill trigger says to use a skill
whenever the task clearly matches its description. The description says
"Make one bounded change," but the body says not to use it unless the user
selects Adhoc.

Suggested fix:

- Change the skill description to: "Run a user-explicitly-selected Adhoc
  change without a RippleGraph workflow."
- Put the explicit-selection requirement in the first sentence of the global
  dispatcher/work-type table, not only inside the skill.
- Add a deterministic example: "Write a Markdown file in project notes" is a
  direct artifact write unless the user says `adhoc` or requests a receipt and
  delivery commit.

### 2. There is no clearly named lane for a direct, user-requested file write

`Direct` is described as questions, explanations, status, and read-only
inspection. `Adhoc` requires explicit selection and produces workflow state and
a commit. A tiny requested write falls between those definitions.

The auxiliary-artifact exception covers a note written into another repository,
but it does not clearly cover a manual or thought note written into the current
repository. Agents are left to infer that a direct write is allowed even though
the `Direct` definition sounds read-only.

Suggested fix:

- Expand `Direct` to include "small user-requested artifacts that do not change
  product/runtime/workflow behavior and do not require a durable delivery
  receipt."
- Alternatively introduce a lightweight `Direct Write` classification. It
  should create no graph, no receipt, no automatic commit, and no dirty-tree
  ownership ceremony.
- State that files under `project_notes/manual`, `project_notes/thoughts`, and
  explicit handoff-note destinations normally qualify, unless the request also
  changes product behavior.

### 3. Full orientation has poor proportionality for tiny documentation tasks

Reading the entire main workflow, the selected skill, and `big_picture.md` can
be appropriate for product changes. For a single usage note, it adds latency
and encourages the agent to widen the task. In this case, the requirement to
ground the note in the implementation led to a broad architectural audit when
the user only wanted endpoint usage.

Suggested fix:

- Define an orientation budget for direct artifact writes: read destination
  instructions, inspect one nearby example if needed, and inspect only the
  source needed to answer uncertain facts.
- Do not require `big_picture.md` for a direct documentation artifact unless
  the requested document is architectural or repository conventions are
  unknown.
- Add a "write first, verify narrowly" rule for low-risk documentation.

### 4. Announcement rules can become visible ceremony

The repository instruction says to announce before every subtask. The current
DataPortal main workflow says to announce meaningful phases and not repeated
read-only probes. Other installed copies say "announce every subtask." This
variation makes the agent conservative and chatty.

For a task that should take one edit, multiple `Specdev:` announcements make
the workflow feel larger than the work. They also expose internal process at
the exact moment the user wants a quick result.

Suggested fix:

- Standardize on "announce meaningful phase transitions," not every internal
  probe.
- Define reads supporting one announced phase as part of that phase.
- For a direct artifact write, one initial announcement and one final result
  should be sufficient unless there is a blocker or scope change.

### 5. Adhoc's mandatory delivery commit is too heavy for notes

If this task had been classified as Adhoc, the workflow would have required a
receipt, verification evidence, exact staging, and a delivery commit. That is a
poor default for a manual note, particularly in a dirty repository with an
unrelated live Mission.

Suggested fix:

- Keep Adhoc's strong commit semantics for product changes.
- Route documentation-only notes to Direct/Direct Write by default.
- Let the user opt into Adhoc when they specifically want ownership,
  verification evidence, and a delivery commit.

### 6. The useful auxiliary-write exception is too deeply buried

The exception correctly says that an explicit note in another repository
should be written there without creating SpecDev state in the active
repository. That rule is excellent, but an agent currently finds it only after
loading workflow details.

Suggested fix:

- Put this exception in the top-level classifier summary and skill catalog.
- Add a dispatcher example for: "Write workflow feedback to the SpecDev CLI
  thoughts directory."

## Drag attributable to agent judgment, not SpecDev

Not all of the delay was caused by the workflow.

- I interpreted "for coding agent consumption" as requiring a comprehensive,
  source-audited integration guide.
- I searched too broadly and produced truncated output instead of starting with
  the four route definitions.
- I included internal architecture, frontend guidance, testing rules, and
  troubleshooting before confirming that the user only wanted the HTTP API.
- After the user said "just write it," the first draft was still too long.

The agent should have made the smallest reasonable interpretation: document
the base URL, API key header, health route, and `/bdp`, `/bdh`, `/bdhi`, and
`/bref` payloads. Uncertain details could have been checked with a few targeted
reads while drafting.

SpecDev should not try to solve all over-analysis with more workflow. The
instructions should instead make proportionality and the direct-write fast path
obvious.

## Proposed minimal change set

I would prioritize these changes:

1. Rename/reword the Adhoc skill description so explicit user selection is
   visible before skill activation.
2. Expand `Direct` to include small, non-product artifact writes, or add a
   `Direct Write` lane.
3. Add three classifier examples: current-repo manual, cross-repo handoff note,
   and user-explicit Adhoc documentation change.
4. Replace "announce every subtask" with one consistent "meaningful phases"
   rule across templates and installed workflow files.
5. Add proportional orientation guidance for low-risk documentation.

## Suggested acceptance scenarios

### Scenario A: small manual

User: "Write an HTTP usage Markdown under project notes."

Expected behavior: classify as Direct/Direct Write, announce once, inspect only
the relevant route contract, write the file, run a narrow Markdown/diff check,
and report the path. No workflow state and no automatic commit.

### Scenario B: explicit Adhoc documentation

User: "Use SpecDev Adhoc to update the public API manual and commit it."

Expected behavior: start Adhoc, classify dirty paths, update and verify the
manual, finish with a delivery receipt and commit.

### Scenario C: note in another repository

User: "Write this workflow feedback into the SpecDev CLI thoughts directory."

Expected behavior: honor the destination repository instructions, write only
the note, and do not create workflow state in the source repository.

## What worked well

- The explicit-selection rule prevented accidental Adhoc state and an unwanted
  commit.
- The auxiliary-write exception protects unrelated active workflow state.
- The lane taxonomy is useful once the edge case is resolved.
- Narrow `git diff --check` verification was appropriate for the final note.

The main improvement is not to weaken SpecDev's governed flows. It is to make
the escape hatch for genuinely small artifacts immediate, explicit, and
consistent.
