# Workflow Bugs — Design

## Bug #1: `--autocontinue` stops on `needs-changes` and punts to user

### Symptom

User runs `specdev reviewloop brainstorm --reviewer=<X> --autocontinue` expecting the loop to drive itself to completion. Reviewer returns `needs-changes`. The coding agent then tells the user:

> --autocontinue only continues when the review verdict is approved.
> Verdict: needs-changes
> So the loop stopped before specdev approve brainstorm. The next step is to run specdev check-review, revise the design, then rerun the reviewloop.

User's mental model: "autocontinue should drive autonomously until approved or stuck." Actual contract: "autocontinue only skips the post-approval prompt."

### Root Cause

Contract gap in `.claude/skills/specdev-reviewloop/SKILL.md:12` and `.specdev/skills/core/reviewloop/SKILL.md:12`:

> With `--autocontinue`: after approval, continue to the next workflow phase without another user prompt.

The contract says nothing about needs-changes behavior, so the agent reads "autocontinue" narrowly and punts. Reinforced by `src/commands/reviewloop.js:376-387`, which prints the same generic "run specdev check-review" message whether or not `--autocontinue` was set.

### Fix Design

Three reinforcing layers:

**Layer 1 — SKILL.md contract (essential).** Rewrite the `--autocontinue` definition in both `.claude/skills/specdev-reviewloop/SKILL.md` and `.specdev/skills/core/reviewloop/SKILL.md`:

> With `--autocontinue`: drive the loop autonomously.
> - On `approved`: continue to the next workflow phase without prompting.
> - On `needs-changes` (and round < max_rounds): run `specdev check-review <phase>`, revise the artifacts in-session, then re-run `specdev reviewloop <phase> --reviewer=<name> --autocontinue`. Do NOT ask the user.
> - On `needs-changes` (and round >= max_rounds): stop and escalate to the user.

Update step 6 of the Flow section to match.

**Layer 2 — CLI output (self-reinforcing nudge).** In `src/commands/reviewloop.js` at the `latestRound.verdict === 'needs-changes'` branch (currently line 376-387):

- Plumb `flags.autocontinue` from `reviewloopCommand` → `runReviewerChain` → `runSingleReviewer` (extra prop on the existing options object).
- If `flags.autocontinue && round < maxRounds`: print "Autocontinue: run `specdev check-review <phase>`, revise, then re-run `specdev reviewloop <phase> --reviewer=<name> --autocontinue`."
- Else: keep the existing message (current behavior preserved for non-autocontinue users and for max-rounds escalation).

**Layer 3 — Round cap.** Already enforced by `max_rounds` (default 3, per-reviewer JSON). The agent reads "Max rounds reached. Escalating to user." (line 378) and stops — covered by the SKILL.md text above.

### Success Criteria

- Running `specdev reviewloop <phase> --reviewer=<X> --autocontinue` with a `needs-changes` verdict no longer surfaces "next step is specdev check-review" to the user; the agent runs it and revises automatically.
- After ≥ `max_rounds` consecutive needs-changes rounds on the same phase, the loop escalates to the user.
- `.claude/skills/specdev-reviewloop/SKILL.md` and `.specdev/skills/core/reviewloop/SKILL.md` describe the same contract for `--autocontinue` on needs-changes.
- The CLI's `needs-changes` branch prints autocontinue-specific guidance only when `flags.autocontinue && round < maxRounds`.

---

## Bug #2: End-of-phase multiple-choice presentation is inconsistent and incomplete

### Symptom

After the brainstorm phase (and similarly after implementation), the coding agent presents the "what next?" options to the user with inconsistent formatting and sometimes missing choices (e.g. the autocontinue split or the "skip review and approve" option). Format varies every run.

### Root Cause

Two conflicting sources of truth for the option list:

**Source A — CLI** (`src/commands/checkpoint.js:126-132` for brainstorm, `:251-256` for implementation) emits 4 numbered options plus a reviewer sub-list. Deterministic, complete:

1. Automated review, then continue if approved (autocontinue)
2. Automated review only
3. Manual review
4. Skip review and approve

**Source B — SKILL.md** (`.specdev/skills/core/brainstorming/SKILL.md:93-96`) says vaguely "Tell the user their options" and bullets 3 options with different wording — missing the autocontinue/review-only split, missing the multiple-choice instruction, missing any reference to `AskUserQuestion`. Same gap likely in the implement skill.

Agent sees two disagreeing sources and improvises a third version each time.

### Fix Design

Make the CLI the **single source of truth**, mandate `AskUserQuestion` by name, apply to both brainstorm and implementation phases.

**Layer 1 — SKILL.md rewrite.** In both `.specdev/skills/core/brainstorming/SKILL.md` and `.specdev/skills/core/implement/SKILL.md` (plus their `.claude/skills/specdev-*` mirrors), replace the hand-authored option list with:

> 5. Run `specdev checkpoint <phase>`. Its output lists the canonical decision options.
> 6. Present those options via `AskUserQuestion` (multiple-choice), using the **exact labels and order** from the CLI output. Do NOT paraphrase, reorder, or drop options.
> 7. If the user picks an automated-review option, ask reviewer type as a second `AskUserQuestion`, one choice per listed reviewer config.

Remove the bulleted option list from the skill files so there's no stale alternate to copy from.

**Layer 2 — CLI output keyword.** Update the `Ready for user decision. Present these multiple-choice options:` line in both `checkpointBrainstorm` and `checkpointImplementation` to explicitly name the tool: `Present these options via AskUserQuestion (multiple-choice, exact labels and order):`. Same change for the reviewer follow-up line.

**Layer 3 — Both phases.** Apply identically to brainstorm and implementation. `checkpoint.js` already emits matching 4-option lists for both; the skill-side fix is the symmetric half.

### Success Criteria

- `.specdev/skills/core/brainstorming/SKILL.md` and `.specdev/skills/core/implement/SKILL.md` no longer contain hand-authored option lists at end-of-phase; both instruct the agent to read CLI output and call `AskUserQuestion`.
- `.claude/skills/specdev-*` mirrors match the `.specdev/` versions.
- CLI output for both `specdev checkpoint brainstorm` and `specdev checkpoint implementation` names `AskUserQuestion` explicitly.
- Across repeated runs, the four end-of-phase options appear with identical labels and order (verifiable by comparing transcripts or by snapshotting CLI output).

---

## Bug #3: `specdev knowledge search` returns 0 results on natural-language queries; some core paths are also unindexed

### Symptom

Agent runs `specdev knowledge search "agent verify knowledge index runtime command workflow agents"`, gets "No matches found", and falls back to other tools (e.g. `specdev skills`). The skills folder *is* indexed and contains relevant content, so the failure isn't only about coverage — it's also about the query contract.

Verified live:

| Query | Terms | Results |
|---|---|---|
| `workflow` | 1 | many |
| `workflow agent` | 2 | many |
| `agent verify knowledge index runtime command workflow agents` | 7 | **0** |

### Root Cause

Two related defects.

**3a — Query semantics surprise (primary).** `src/utils/knowledge.js:87` passes the raw query straight to SQLite FTS5 `MATCH ?`. FTS5's default operator between bare tokens is **AND**, so a 7-term query requires every term in the same document — almost nothing matches. The CLI help advertises `<query>`, which the agent reads as natural language. Contract gap, not an algorithmic bug.

**3b — Coverage gaps (secondary).** `INDEXED_MARKDOWN_ROOTS` (`src/utils/knowledge.js:7-14`) lists only six folders. Skipped:

- Root-level files: `.specdev/_main.md` (core workflow rules), `.specdev/_index.md` (resource lookup) — never walked because the collector only iterates listed folders.
- Folders: `_templates/`, `migration/`, `project_scaffolding/` — valid `.specdev/` content not on the list. Same bug class will recur as new folders are added (note: `discussions/` was added recently).

### Fix Design

**Defect 3a — make the keyword-only contract explicit and unmissable.** No silent OR-fallback; keep search strict so agents learn the contract.

- **CLI usage text** — rename `<query>` → `<keywords>` in `src/commands/knowledge.js:22` and `src/commands/help.js`. "Missing search query" → "Missing keywords" at `knowledge.js:51`.
- **CLI inline guidance** — extend the search header in every run:
  ```
  Knowledge Search: <user input>
    (keyword-only: 1-3 terms, ANDed. Use quotes for exact phrase. Not natural-language.)
  ```
- **Zero-result hint** — when `No matches found`, append: `Tip: use 1-3 keywords. Long sentences AND every term — try fewer/shorter keywords or run \`specdev knowledge list\`.`
- **SKILL.md / hook reminders** — anywhere SpecDev advertises the command:
  - SessionStart hook output (`.claude/hooks/specdev-session-start.sh`): "Run `specdev knowledge search "<keyword>"` (1-3 keywords)".
  - `.specdev/skills/core/brainstorming/SKILL.md:32`: strengthen `"<topic keywords>"` → `"<1-3 keywords>"` with the AND rationale.
  - `.specdev/_main.md` mention of `specdev knowledge search` similarly.

**Defect 3b — index everything by default with a small denylist.**

- Replace the explicit `INDEXED_MARKDOWN_ROOTS` allowlist with a recursive walk of `.specdev/` plus root-level `.specdev/*.md`.
- Denylist: `cache/`, hidden dirs (already skipped), `node_modules` (defensive).
- Keep `classifyDocument` for known kinds; the existing `kind: 'markdown'` fallback (line 227) handles new paths gracefully.
- Future-proof: new folders auto-index, no code change needed.

### Success Criteria

- Submitting a multi-keyword (1-3) query returns relevant results; long natural-language queries still return 0 but the CLI prints the keyword-only contract and a tip.
- `specdev knowledge search "workflow"` returns hits from `_main.md` and `_index.md`.
- Adding a new top-level folder under `.specdev/` (other than `cache/`) results in its `.md` files appearing in `specdev knowledge list` and search results without any code change.
- CLI usage strings reference `<keywords>` (not `<query>`); session-start hook and SKILL.md mention the 1-3 keyword rule consistently.

---

## Bug #4: `KNOWLEDGE_BRANCHES` constant duplicated and divergent across four files

### Symptom

A project that documents `codestyle/` or `domain/` knowledge sees inconsistent visibility: `specdev knowledge search` and `specdev knowledge list` include those branches, but `specdev memory refresh` (working memory) silently excludes them. Same constant name, different values per file.

### Root Cause

`KNOWLEDGE_BRANCHES` is hand-defined in four locations with three different values:

| File:line | Branches | Status |
|---|---|---|
| `src/commands/knowledge.js:12` | `architecture, codestyle, domain, workflow, workflow_feedback` | Full set |
| `src/commands/context.js:11` | same 5 | Matches |
| `src/commands/distill.js:13` | `codestyle, architecture, domain, workflow` (4) | Omits `workflow_feedback` — intentional; distill handles it separately at `distill.js:75-81` |
| `src/utils/working-memory.js:10` | `architecture, workflow, workflow_feedback` (3) | Omits `codestyle, domain` — likely a curation choice but undocumented |

Beyond current divergence, adding a future branch (e.g. `testing/`) requires editing four files and risks missing one — same bug class will recur.

### Fix Design

**Single source of truth + explicit subsets.**

- Define `KNOWLEDGE_BRANCHES` once, exported from `src/utils/knowledge.js` (already imported by the other sites).
- Replace the duplicated constants in `context.js`, `distill.js`, `working-memory.js` with imports.
- For working memory's narrower subset, define a separate `WORKING_MEMORY_BRANCHES` constant (also exported from `knowledge.js`) so the curation intent is documented in code rather than implicit through divergence.
- For distill's split handling of `workflow_feedback`, derive the iterated list as `KNOWLEDGE_BRANCHES.filter(b => b !== 'workflow_feedback')` so the special-case is explicit and adding new branches stays automatic.

### Success Criteria

- Only one `const KNOWLEDGE_BRANCHES = [...]` definition exists in `src/` (in `knowledge.js`).
- `context.js`, `distill.js`, `working-memory.js` import from `knowledge.js` rather than redefining.
- A new branch added to the canonical constant appears automatically in `knowledge list`, `knowledge search` results, context output, and (where intended) distill output — without further code changes.
- `WORKING_MEMORY_BRANCHES` is explicitly named so its narrower scope is obviously intentional, not a forgotten update.

---

## Bug #5: `--autocontinue` on discussion review silently ignored on `needs-changes`

### Symptom

User runs `specdev reviewloop discussion --discussion=D000XX --reviewer=<X> --autocontinue` expecting autonomous behavior. Reviewer returns `needs-changes`. The flag is silently dropped — no message about autocontinue being unsupported, no autonomous revise loop. User can't tell whether the flag was honored.

### Root Cause

`src/commands/reviewloop.js:557-559` prints "Autocontinue is not supported for discussions; discussions remain standalone." **only when `allApproved` is true**. On the needs-changes path, the flag is ignored without any signal. `.specdev/skills/core/reviewloop/SKILL.md` and `.claude/skills/specdev-reviewloop/SKILL.md` discussion sections never document the rejection at all — neither approval-path nor needs-changes-path.

This compounds with Bug #1's fix: once `--autocontinue` is taught to auto-revise on assignment phases, the agent will assume the same applies to discussions and will not know to stop.

### Fix Design

Define and enforce the contract everywhere:

**Layer 1 — SKILL.md (both `.specdev/` and `.claude/` mirrors).** Add to the discussion section:

> `--autocontinue` has no effect on discussion reviewloop. Discussions are standalone — there is no next phase to continue to, and the autonomous revise loop applies only to assignment phases. On `needs-changes`, run `specdev check-review` and re-run the reviewloop manually.

**Layer 2 — CLI output.** When `phase === 'discussion'` and `flags.autocontinue`:

- On approved (existing line at `reviewloop.js:557-559`): keep the current message.
- On needs-changes (currently silent): print the same "Autocontinue is not supported for discussions" line so the agent gets symmetric feedback regardless of verdict.

**Layer 3 — interaction with Bug #1's fix.** When implementing Bug #1's autonomous-revise behavior on `--autocontinue + needs-changes`, gate the new behavior on `phase !== 'discussion'`.

### Success Criteria

- Running `specdev reviewloop discussion --discussion=<ID> --reviewer=<X> --autocontinue` always prints the autocontinue-not-supported notice, regardless of verdict.
- Both `.specdev/` and `.claude/` reviewloop SKILL.md document the rejection in the discussions section.
- Bug #1's autonomous-revise behavior does not fire for discussion phase.

---

## Bug #6: `state.js` "Invoke X skill" wording misleads agents into looking for a slash-skill

### Symptom

After implementation approval, the agent runs `specdev continue` (or reads `specdev status --json`), sees `next_action: "Invoke knowledge-capture skill to write capture diffs and finalize"`, looks in its session's slash-skill registry for a callable `knowledge-capture` skill, doesn't find one, and reports:

> the assignment is now in summary_in_progress … that specific knowledge-capture skill is not available in this session

The skill file actually exists at `.specdev/skills/core/knowledge-capture/SKILL.md` and is meant to be read with the file system, not invoked through a slash-command registry.

### Root Cause

`src/utils/state.js` uses "Invoke X skill" phrasing for three phase transitions, while the rest of the CLI consistently uses "Read .specdev/skills/core/X/SKILL.md and follow it":

| File:line | Current text | Wording |
|---|---|---|
| `state.js:88` | `Invoke breakdown skill to generate breakdown/plan.md` | "Invoke" |
| `state.js:115` | `Invoke implementing skill to execute the plan` | "Invoke" |
| `state.js:143` | `Invoke knowledge-capture skill to write capture diffs and finalize` | "Invoke" |
| `approve.js:60` | `Read .specdev/skills/core/breakdown/SKILL.md and follow it` | "Read" |
| `approve.js:66` | `Read .specdev/skills/core/knowledge-capture/SKILL.md and follow it` | "Read" |
| `assignment.js:157,182` | `Read .specdev/skills/core/brainstorming/SKILL.md and follow it.` | "Read" |
| `discussion.js:78` | `Read .specdev/skills/core/brainstorming/SKILL.md and follow it.` | "Read" |

Phase skills (`brainstorming`, `breakdown`, `implementing`, `knowledge-capture`) live only in `.specdev/skills/core/` and are not registered as slash-skills under `.claude/skills/specdev-*` (which contains entry-point skills only — `specdev-assignment`, `specdev-continue`, `specdev-review`, etc., 9 in total). The same gap exists for Codex sessions, which use a similar slash-skill registry. "Invoke" semantically points to that registry; the agent has no way to find a skill that isn't there.

This is Pattern A (skill-as-callable phrasing for a file-as-instruction artifact) compounded by Pattern B (state.js diverges from approve.js for the same instruction).

### Fix Design

**Layer 1 — `state.js` wording.** Rewrite the three `next_action` strings to match the rest of the CLI:

```js
// state.js:88
next_action: 'Read .specdev/skills/core/breakdown/SKILL.md and follow it to generate breakdown/plan.md'

// state.js:115
next_action: 'Read .specdev/skills/core/implementing/SKILL.md and follow it to execute the plan'

// state.js:143
next_action: 'Read .specdev/skills/core/knowledge-capture/SKILL.md and follow it to write capture diffs and finalize'
```

**Layer 2 — repo-wide grep gate.** After the fix, `grep -rn "Invoke .* skill" src/` should return zero hits for phase skills. If a future contributor reintroduces "Invoke" phrasing for a phase skill, it stands out.

**Layer 3 — no slash-skill mirrors needed.** Phase skills are intentionally file-based (read-and-follow) rather than slash-invocable. Adding `.claude/skills/specdev-knowledge-capture` would be inconsistent with the rest of the phase-skill pattern (no specdev-brainstorm, no specdev-implement). The fix is wording, not architecture.

### Success Criteria

- `state.js` `next_action` strings for breakdown/implementing/knowledge-capture phases use the same `Read .specdev/skills/core/<name>/SKILL.md and follow it` form as `approve.js`, `assignment.js`, `discussion.js`.
- `grep -rn "Invoke .* skill" src/` returns no hits for phase skills.
- An agent running `specdev continue` at end of implementation gets a clear file path to read, not an ambiguous "invoke" instruction.
- Same fix applied to the `templates/.specdev/` mirror if state.js logic lives there too (verify; if not, no-op).

---

<!-- additional bugs appended below as user surfaces them -->
