# Friction: plan task headers `## Task N` (H2) vs `### Task N` (H3)

**Observed:** recurring across 4 assignments in `oceanlive-cli` (00007, 00011, 00012, 00014)
**Last confirmed:** 2026-04-25
**Severity:** Low — workaround is one `sed` command once you know — but the failure mode is silent until the next track-progress call crashes, which wastes a confusing minute every time.

## Symptom

`extract-tasks.sh` parses `^### Task [0-9]` (H3). `track-progress.sh` does the same when initializing `progress.json`.

If a plan uses `## Task N:` (H2) — natural if the author treats tasks as top-level sections — both scripts return zero tasks silently. Then:

- `progress.json` gets created with `total_tasks: 0` and `tasks: []`.
- The first `track-progress.sh <plan> 1 started` crashes with `TypeError: Cannot read properties of undefined (reading 'find')` because `tasks.find(...)` runs on an empty array and matches nothing — but the script doesn't check.
- After fixing the headers (`sed -i 's/^## Task /### Task /g' plan.md`) you have to delete `progress.json` and re-run `track-progress.sh ... started` to get a non-empty initial state.

This same pattern (or a cousin) hit at least four assignments in a row. It's not a one-off.

## Root cause

`breakdown/SKILL.md` shows the task structure in an indented code block with `### Task N: [Name]`, but the `###` is not called out as load-bearing. Someone reading the skill will reasonably write `## Task N:` if it visually fits the rest of their plan structure (where the plan title is `# Implementation Plan`, top-level sections are `##`, and tasks naturally sit beneath that as `###` only if the author thinks about it).

Three of the four occurrences explicitly noted "had to sed to fix headers" in the assignment_progress.md row.

## Suggested fixes (any one is enough)

### Option A — make the skill explicit (cheapest)

In `templates/.specdev/skills/core/breakdown/SKILL.md`, change:

> Every task MUST follow this structure (compact form shown):
>
>     ### Task N: [Name]

to:

> Every task MUST be an H3 heading (`### Task N: …`). The breakdown scripts grep for `^### Task [0-9]` — H2 (`##`) silently produces zero tasks.

### Option B — make scripts tolerant

`extract-tasks.sh` and `track-progress.sh` could grep `^#{2,3}\s+Task [0-9]`. That covers both depths. Risk: if a future plan uses `## Step 1` as a non-task heading, it would be picked up. Mitigation: require the literal string "Task" + integer, which is already the convention.

### Option C — fail loudly when the count is zero

`track-progress.sh`'s init block could check `TASK_COUNT == 0` and abort with `Error: no '### Task N:' headings found in <plan>. (Did you use '## Task N:' (H2) by mistake?)`. This wouldn't fix the problem but would turn the silent failure into a one-line diagnostic.

## My preference

Option C as a quick win + Option A for permanence. Option B has subtle downsides if anyone uses `## Task` for a non-task purpose, but the fail-loud check eliminates the silent-zero-tasks failure mode regardless of which depth lands in the plan.

## Related

- `progress-json-init-bug.md` — overlapping symptom; the `progress.json` race + this header-depth issue both surface as the same TypeError.
