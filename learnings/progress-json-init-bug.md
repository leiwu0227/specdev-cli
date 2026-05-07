# Bug: `implementation/progress.json` init writes `{}`, breaking `track-progress.sh`

**Observed:** 4 assignments in a row in `oceanlive-cli` (00007, 00008, 00009, 00010)
**Last confirmed:** 2026-04-25 on `specdev-cli` installed via `npm install -g specdev-cli`
**Severity:** Low — every user can work around it in ~60 seconds once they know what's happening; first-time users hit a confusing error.

## Symptom

After `specdev implement` prints its setup message, the first call to the track-progress helper crashes:

```
$ specdev implement
🚀 Implementation ready: 00010_refactor_daily-execution-fsm-aligned
   ✓ 00010_refactor_daily-execution-fsm-aligned/implementation/ created
   ✓ 00010_refactor_daily-execution-fsm-aligned/implementation/progress.json initialized
...

$ bash .specdev/skills/core/implementing/scripts/track-progress.sh breakdown/plan.md 1 started
[eval]:7
      const task = data.tasks.find(t => t.number === taskNum);
                              ^
TypeError: Cannot read properties of undefined (reading 'find')
```

Same TypeError hits `specdev checkpoint implementation` (via `progress.json has no tasks array`) if the user inline-implements and forgets to populate the array.

## Root cause

Two files both try to own the initialization of `progress.json` and they disagree on the shape.

**`src/commands/implement.js:32-35`** writes an empty object `{}` eagerly:

```javascript
const progressPath = join(implDir, 'progress.json')
if (!await fse.pathExists(progressPath)) {
  await fse.writeJson(progressPath, {}, { spaces: 2 })
}
```

**`templates/.specdev/skills/core/implementing/scripts/track-progress.sh:37-52`** has a lazy init that runs ONLY if the file doesn't exist:

```bash
if [ ! -f "$PROGRESS_FILE" ]; then
  TASK_COUNT=$(grep -c '^### Task [0-9]' "$PLAN_FILE" || true)
  node -e "...tasks.push({number: i, status: 'pending', ...});..."
fi
```

`implement.js` wins the race — it writes `{}` first. `track-progress.sh` then sees the file already exists, skips its init block, and immediately tries to read `data.tasks.find(...)` on an empty object → TypeError.

## Suggested fix (one-line)

Remove the eager empty-object write in `implement.js` and let `track-progress.sh` lazy-init on first call:

```javascript
// src/commands/implement.js:32-35  — DELETE this block
const progressPath = join(implDir, 'progress.json')
if (!await fse.pathExists(progressPath)) {
  await fse.writeJson(progressPath, {}, { spaces: 2 })
}
```

Keep the "`progress.json` initialized" log line out of `implement.js` since the file now gets created on the first `track-progress.sh` call (which extracts the task count from the plan and seeds the `tasks` array correctly).

**Alternative fix (equivalent):** in `implement.js`, call the same init logic that `track-progress.sh` uses (grep for `^### Task N:`, build the `tasks` array, write the full structure). Either approach eliminates the race.

**Don't fix by making `track-progress.sh` tolerate empty-object.** That hides the underlying double-ownership and will resurface when someone adds another init site.

## Why it matters

Agents following the specdev-implementing skill are told to run `track-progress.sh <N> started` as step 2a of every task. When it errors on the first task of every new assignment, the agent either:

1. Thinks the workflow is broken and stops, asking the user to investigate, OR
2. Works around by seeding `progress.json` manually at the end (what I did four times in a row), which bypasses the intermediate-progress tracking the skill was designed to provide.

In neither case does the track-progress helper run as designed during the assignment. Four recurring workarounds in one project is signal.

## Related observations from the same project

- **`extract-tasks.sh` header level is undocumented.** The script parses `^### Task [0-9]` (H3). `breakdown/SKILL.md` shows `### Task N: [Name]` inside a code block but doesn't flag that the `###` prefix is load-bearing. First plan I wrote used `## Task N:` (H2); `extract-tasks.sh` silently returned `[]`. Low friction to fix in the skill doc.

- **Reviewloop subagent shell-redirection race with `run_in_background: true`.** Intermittent (hit maybe 2 out of 8 times): `specdev reviewloop <phase> --reviewer=codex &>output` exits 0 but writes only `---\n` (4 bytes) to the output file. Re-running synchronously works. Looks like the codex subprocess stdout/stderr redirect races against the bash heredoc appender that dispatched it. Not reproducible on demand and may be shell-specific.

## Context

All four occurrences were in `oceanlive-cli` (`/mnt/h/oceanwave/lib/cli/oceanlive-cli`), which has `specdev-cli` installed globally via npm. `specdev --version` at observation time was whichever ships with the `4d826dc`-era project. Bug is present in both the globally installed `specdev` binary and the `templates/.specdev/skills/core/implementing/` copy inside the repo.
