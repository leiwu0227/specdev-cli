# Orchestration Restructure Design

## Problem

Coding agents frequently forget steps because the orchestration docs (_main.md, _router.md) are unclear organizationally. Two parallel instruction systems (guides and skills) overlap without clear authority. The agent doesn't know which to follow, resulting in missed artifacts, skipped phases, and broken handoffs between agents.

## Design Principles

1. **Guides orchestrate, skills execute.** Guides are pure prose instructions (sequencing, gates). Skills bundle instructions with tooling (scripts, prompts, assets). No circularity — guides point to skills, skills never point back to guides.

2. **Constrained choice, not open judgment.** At every decision point, the agent picks from a finite set of explicit options. Never "figure it out yourself."

3. **Uniform workflow.** Every assignment follows the same 4 phases: brainstorm → breakdown → implement → summary. Variation is handled by skill selection within a phase, not by separate workflow paths.

4. **Each skill owns its own contract.** The producing skill defines "I output X." The consuming skill defines "I expect X as input." The CLI gate validates "X exists."

5. **Programmatic guardrails.** CLI commands enforce artifact completeness at phase boundaries. The agent can't proceed if artifacts are missing.

## The Workflow

Every assignment follows 4 phases with 2 hard gates:

```
User: specdev assignment "Add auth with JWT"
  Agent: brainstorm Q&A with user (skill chosen by work type)
  Agent: writes brainstorm artifacts
  Agent: runs specdev checkpoint brainstorm (validates artifacts)
  → Optional: review agent runs specdev review brainstorm (separate session)
User: specdev approve brainstorm                    ← HARD GATE 1
  Agent: auto-review subagent (1 round)
  Agent: breakdown → plan.md
  Agent: implementation (subagent per task, review per task)
  Agent: runs specdev checkpoint implementation (validates artifacts)
  → Optional: review agent runs specdev review implementation (separate session)
User: specdev approve implementation                ← HARD GATE 2
  Agent: auto-review subagent (1 round)
  Agent: knowledge capture, docs update, finalize
```

## CLI Commands

### New commands

| Command | Who runs it | Purpose |
|---------|------------|---------|
| `specdev checkpoint brainstorm` | Main agent | Validate brainstorm artifacts exist and are non-empty |
| `specdev checkpoint implementation` | Main agent | Validate all tasks completed, tests verified |
| `specdev approve brainstorm` | User (with main agent) | Hard gate 1 — signal to proceed to breakdown+implementation |
| `specdev approve implementation` | User (with main agent) | Hard gate 2 — signal to proceed to summary/finalize |

### Kept commands

| Command | Purpose |
|---------|---------|
| `specdev assignment "<desc>"` | Reserve next assignment ID |
| `specdev continue` | Detect state, resume where left off |
| `specdev review <phase>` | Manual review in separate session |
| `specdev check-review` | Read review feedback |
| `specdev skills` | List available skills |

### Removed commands

| Command | Reason |
|---------|--------|
| `specdev breakdown` | Workflow guide + skill handle phase transition |
| `specdev implement` | Workflow guide + skill handle phase transition |
| `specdev progress` | Implementing skill calls track-progress.sh directly |

## File Structure Changes

### `_main.md` — rewrite as minimal hub (~25 lines)

What is specdev, read order (big_picture → _index.md → assignments), link to workflow guide, hard rules. No phase descriptions, no skill explanations, no assignment structure details.

### `_router.md` → rename to `_index.md` — flat index

Pure listing of all docs, skills, project context, CLI commands. No routing logic, no decision trees. Like a book index.

### `_guides/workflow.md` — NEW single unified workflow guide

Replaces the 4 separate workflow guides (feature, bugfix, refactor, familiarization). Four phases, constrained choices at each decision point. Each phase names its skill, checkpoint, and gate.

Phase 1 (Brainstorm) has 3 skill options based on work type:
- Building/changing functionality → `skills/core/brainstorming/SKILL.md`
- Understanding existing code → `skills/core/investigation/SKILL.md`
- Diagnosing a bug → `skills/core/diagnosis/SKILL.md`

Phases 2-4 have one skill each (breakdown, implementing, knowledge-capture).

### `_guides/task/` — DELETE entire directory

All content merged into corresponding skills:

| Task Guide | Merge Into |
|---|---|
| `planning_guide.md` | `skills/core/breakdown/SKILL.md` (complexity gate, task granularity gate) |
| `implementing_guide.md` | `skills/core/test-driven-development/SKILL.md` (Gate 2 checklist, TDD verification) |
| `scaffolding_guide.md` | `skills/core/scaffolding-lite.md` + `scaffolding-full.md` (mode criteria, checklist) |
| `validation_guide.md` | `skills/core/implementing/SKILL.md` (review protocol, rollback) |
| `documentation_guide.md` | `skills/core/knowledge-capture/SKILL.md` (doc update templates) |
| `research_guide.md` | New `skills/core/investigation/SKILL.md` |
| `presentation_guide.md` | New `skills/core/investigation/SKILL.md` |

### `_guides/workflow/` — DELETE directory

Replaced by single `_guides/workflow.md`.

### Kept guides

- `_guides/assignment_guide.md` — assignment naming (NNNNN_type_slug), folder structure
- `_guides/codestyle_guide.md` — coding standards
- `_guides/migration_guide.md` — legacy migration reference
- `_guides/README.md` — simplified to point to workflow.md

### New skills

| Skill | Source | Purpose |
|---|---|---|
| `skills/core/investigation/` | `task/research_guide.md` + `task/presentation_guide.md` | Research and document existing code |
| `skills/core/diagnosis/` | Front half of `systematic-debugging/` | Bug reproduction and root cause analysis |

### Removed skills

| Skill | Reason |
|---|---|
| `skills/core/orientation/` | Replaced by `_guides/workflow.md` routing |

## Final Directory Structure

```
.specdev/
├── _main.md                          ← minimal hub (rewritten)
├── _index.md                         ← flat index (renamed from _router.md)
├── _guides/
│   ├── README.md                     ← simplified
│   ├── workflow.md                   ← NEW: single unified workflow guide
│   ├── assignment_guide.md           ← stays
│   ├── codestyle_guide.md            ← stays
│   └── migration_guide.md            ← stays
├── skills/
│   └── core/
│       ├── brainstorming/            ← stays (design-oriented brainstorm)
│       ├── investigation/            ← NEW (research + documentation)
│       ├── diagnosis/                ← NEW (bug reproduction + root cause)
│       ├── breakdown/                ← stays (absorbs planning_guide)
│       ├── implementing/             ← stays (absorbs validation_guide)
│       ├── knowledge-capture/        ← stays (absorbs documentation_guide)
│       ├── test-driven-development/  ← stays (absorbs implementing_guide TDD)
│       ├── systematic-debugging/     ← stays
│       ├── parallel-worktrees/       ← stays
│       ├── review-agent/             ← stays
│       ├── scaffolding-lite.md       ← stays (absorbs scaffolding_guide)
│       ├── scaffolding-full.md       ← stays
│       ├── verification-before-completion.md  ← stays
│       └── receiving-code-review.md  ← stays
├── _templates/                       ← stays unchanged
├── assignments/                      ← stays unchanged
├── knowledge/                        ← stays unchanged
├── project_notes/                    ← stays unchanged
└── project_scaffolding/              ← stays unchanged
```

## Gate State Persistence

Gate approvals are persisted in `assignments/<assignment-folder>/status.json`, where `<assignment-folder>` is the full `NNNNN_type_slug` directory name (resolved via `--assignment` flag or latest-by-ID heuristic, same as other commands):

```json
{
  "brainstorm_approved": true,
  "implementation_approved": false
}
```

- `specdev approve brainstorm` writes `brainstorm_approved: true`
- `specdev approve implementation` writes `implementation_approved: true`
- `specdev checkpoint` does NOT write to status.json — it only validates artifacts and exits 0/1

### State precedence rules for `specdev continue`

`status.json` is the authority on **gate decisions** (may the agent proceed past this gate?).
Artifacts are the authority on **phase progress** (has this phase's work been done?).

Combined state detection:

| status.json | Artifacts present | State | Next action |
|---|---|---|---|
| missing or no approvals | `brainstorm/proposal.md` or `brainstorm/design.md` missing | `brainstorm_in_progress` | Continue brainstorming |
| missing or no approvals | both `brainstorm/proposal.md` and `brainstorm/design.md` exist | `brainstorm_checkpoint_ready` | Run `specdev checkpoint brainstorm` |
| `brainstorm_approved: true` | `breakdown/plan.md` missing | `breakdown_in_progress` | Invoke breakdown skill |
| `brainstorm_approved: true` | `breakdown/plan.md` exists, `implementation/progress.json` missing or no tasks started | `implementation_in_progress` | Invoke implementing skill |
| `brainstorm_approved: true` | `implementation/progress.json` shows all tasks completed | `implementation_checkpoint_ready` | Run `specdev checkpoint implementation` |
| `implementation_approved: true` | `capture/project-notes-diff.md` or `capture/workflow-diff.md` missing | `summary_in_progress` | Invoke knowledge-capture skill |
| `implementation_approved: true` | both capture diff files exist | `completed` | Assignment done |

Missing `status.json` is treated as no approvals given (backward compatible with existing assignments).

### Reserved-but-not-created assignment

`specdev assignment` reserves an ID but does not create the folder — the agent creates it immediately as the first action in the brainstorm phase. If the session is interrupted between reservation and folder creation, `specdev continue` will see no assignment and report `no_assignment`. The user simply re-runs `specdev assignment` — the same ID is returned since no folder advanced the counter. No separate reservation registry is needed.

## Migration and Compatibility

**This is a breaking change.** Pre-1.0, no backward compatibility shim. No transition window — old commands are removed in the same release that adds new ones.

### `specdev update` handling

The `update` command must handle the file renames and deletions:
- Delete `_router.md` from target (replaced by `_index.md`)
- Delete `_guides/task/` directory from target
- Delete `_guides/workflow/` directory from target
- Delete `skills/core/orientation/` from target
- Copy new files (`_index.md`, `_guides/workflow.md`, new skills)
- Standard template-copy handles the rest

### Reference updates

All source files that reference removed commands or paths must be updated:
- `src/commands/dispatch.js` — remove breakdown/implement/progress routing
- `src/utils/state.js` — add status.json reading for gate state
- `src/commands/continue.js` — use gate state in phase detection
- `src/commands/check-review.js` — update next-step guidance
- `src/commands/review.js` — update references
- `src/commands/help.js` — update command list and workflow text
- `src/commands/init.js` — update slash command templates

### `assignment_guide.md` updates

Update references from `_guides/workflow/feature_workflow.md` etc. to `_guides/workflow.md`.

### All changes target `templates/.specdev/`

The shipping path is `templates/.specdev/`, not a local `.specdev/`. All doc and skill changes are made in the templates directory. `specdev init` copies from templates; `specdev update` syncs system files.

## Implementation Order

Safe order — add before delete, update references before removing what they point to:

1. Add new orchestration docs in `templates/.specdev/` (`_index.md`, `_guides/workflow.md`)
2. Rewrite `templates/.specdev/_main.md` as minimal hub
3. Create new skills in `templates/.specdev/skills/core/` (`investigation/`, `diagnosis/`)
4. Merge task guide content into existing skills
5. Update `assignment_guide.md` references
6. Update `_guides/README.md`
7. Implement new CLI commands (`checkpoint`, `approve`) with `status.json` persistence
8. Update `src/commands/continue.js` and `src/utils/state.js` to read `status.json`
9. Update `src/commands/dispatch.js` — add new commands, remove old ones (`breakdown`, `implement`, `progress`)
10. Update `src/commands/help.js`, `src/commands/init.js` slash command templates
11. Update all reference paths in `check-review.js`, `review.js`, etc.
12. Update `src/commands/update.js` to handle rename/delete migration
13. Delete removed template files (`_router.md`, `_guides/task/`, `_guides/workflow/`, `orientation/`)
14. Update all tests
15. Full test suite verification
