# SpecDev Upgrade Plan — Dynamic Knowledge & Multi-Agent Support

## Overview

Two major enhancements to the SpecDev workflow system:

1. **Dynamic knowledge system** — evolving guides that improve as the user works
2. **Multi-agent support** — orchestrator model with specialized sub-agents

Both are implemented as **templates only** — the CLI remains a scaffolder, agents figure out orchestration using the guides. This aligns with Claude Code's agent teams concept.

---

## 1. Knowledge System

### Local vs Global

Two distinct categories of knowledge with different purposes and locations:

- **Local (project-specific)** — knowledge about *what you're working on*. Project patterns, architecture, domain concepts. Lives in the user's `.specdev/knowledge/` directory, grown by agents during assignments, preserved by `specdev update`.
- **Global (workflow improvement)** — meta-knowledge about *how to work*. Better planning strategies, decomposition heuristics, validation approaches. Lives **only in this repo** (not shipped to users). Used by the maintainer to refine the guides and templates.

**Global knowledge does NOT ship to user projects.** Users only get the refined guides. The global learnings directory is an internal concern of this repo — a staging area for improving the workflow.

### Feedback Loop

```
Agents work on assignments in user projects
  → agents write workflow observations to knowledge/_workflow_feedback/
  → maintainer periodically collects _workflow_feedback/ from various projects
  → brings them back to this repo
  → agent aggregates into learnings/ (this repo only)
  → agent reviews current guides against new knowledge
  → agent updates _guides/ and _templates/ accordingly
  → next `specdev update` ships improved workflows to all projects
```

Three locations, each with a clear role:
- **`_workflow_feedback/`** (in user projects) — collection point. Agents write here during assignments. Preserved by `specdev update`.
- **`learnings/`** (in this repo) — aggregation point. Maintainer brings feedback here from multiple projects.
- **`_guides/` & `_templates/`** (in this repo) — refined output. Updated based on aggregated learnings, shipped to users.

### Three-Tier Temporal Model

Knowledge is also categorized by lifetime:

| Tier | Scope | Lifetime | Purpose |
|------|-------|----------|---------|
| **Working** | Current task | Discarded on task completion | Agent scratch space, active reasoning |
| **Short-term** | Assignment | Archived on assignment completion | Progress, decisions, inter-agent communication |
| **Long-term** | Project | Permanent, grows over time | Accumulated domain knowledge |

### Directory Structure

**In user projects (shipped via `specdev init`):**

```
.specdev/
├── knowledge/                              # LONG-TERM (local, project-specific)
│   ├── _index.md                           #   routing to local knowledge branches
│   ├── _workflow_feedback/                 #   GLOBAL CANDIDATES — collected for maintainer pickup
│   │   └── ...                             #     "scaffolding missed X", "validation should check Y"
│   ├── codestyle/                          #   naming conventions, error patterns, test style
│   ├── architecture/                       #   design patterns, dependencies, module boundaries
│   ├── domain/                             #   business domain concepts
│   └── workflow/                           #   what worked/didn't in this project's assignments
│
├── assignments/
│   └── 00001_feature_auth/
│       ├── proposal.md
│       ├── plan.md
│       │
│       ├── context/                        # SHORT-TERM (lives with assignment)
│       │   ├── decisions.md                #   key decisions and rationale
│       │   ├── progress.md                 #   what's done, what's left
│       │   └── messages/                   #   inter-agent communication
│       │       ├── 001_review_to_master.md
│       │       └── 002_impl1_to_impl2.md
│       │
│       └── tasks/
│           ├── _index.md                   #   task list, status, dependencies
│           └── 01_api/
│               ├── spec.md                 #   what to do
│               ├── scratch.md              # WORKING (agent's live scratchpad)
│               └── result.md               #   what was done
```

**In this repo only (not shipped to users):**

```
learnings/                                  # GLOBAL — workflow improvement knowledge
├── workflow_improvements.md                #   aggregated from user projects
├── guide_feedback.md                       #   what guides need updating
└── ...                                     #   raw material for refining _guides/ & _templates/
```

### Knowledge Flow (Distillation)

```
Working (scratch.md)
  → on task completion, key findings distill into →
Short-term (context/decisions.md, context/progress.md)
  → on assignment completion, lasting insights distill into two paths:

  Project-specific insights → Long-term local (knowledge/<branch>)
      e.g. "this codebase uses repository pattern for DB access"

  Workflow-level observations → Global candidates (knowledge/_workflow_feedback/)
      e.g. "the planning guide should account for monorepo task splitting"
```

Distillation steps are embedded in the workflow guides themselves. The validation guide instructs agents to review scratch notes and decisions, then route insights to the appropriate destination — local knowledge for project patterns, `_workflow_feedback/` for workflow improvement observations.

### Growth Model

- Long-term knowledge tree is **agent-grown**: the agent creates new files/subdirectories as it encounters new categories
- `_index.md` at the root stays updated as a routing layer
- Periodic consolidation: agents deduplicate and reorganize during natural workflow pauses

---

## 2. Multi-Agent Support (Orchestrator Model)

### Agent Roles

| Agent | Responsibility | Writes code? |
|-------|---------------|-------------|
| **Master (orchestrator)** | Coordinates workflow, decomposes tasks, integrates results | No |
| **Review agent** | Evaluates proposals/plans, approves or sends back with feedback | No |
| **Impl agent(s) (1-2)** | Executes tasks, writes code | Yes |

### Communication Mechanism

Agents communicate through **files on disk** (templates-only approach, no runtime).

**Coordination board** (`context/progress.md` within each assignment):
- Current phase (proposal / review / planning / implementation / validation)
- Task breakdown with status (pending / claimed / done)
- Who owns what
- Blockers and decisions

**Message protocol** (`context/messages/` within each assignment):
- Agents write message files for lateral communication
- Format:
  ```markdown
  ---
  from: impl-1
  to: impl-2
  type: info | question | blocker
  status: unread
  ---
  Changed the auth endpoint response shape to include `refresh_token`.
  Update your UI code to handle it.
  ```

### Round-Based Orchestration

Since sub-agents are fire-and-forget (spawned, do work, return), communication is **round-based**:

1. Master spawns agents for the current round
2. Agents finish, write results + outbound messages
3. Master reads board, collects messages, decides if another round is needed
4. Master re-spawns agents with updated context including messages from peers
5. Repeat until board shows all tasks complete and no unresolved messages

### Typical Flow

```
Round 0: Master reads knowledge vault, creates assignment, writes proposal
Round 1: Master spawns review agent → reviews proposal → approves/rejects
Round 2: Master writes plan, spawns review agent → reviews plan
Round 3: Master decomposes into tasks, spawns impl-1 + impl-2 in parallel
Round 4: Master reads results, relays messages, spawns another round if needed
Round 5: Master runs validation across integrated result
Round 6: Master triggers knowledge distillation (short-term → long-term)
```

### Context Management

Each agent loads only what it needs:
- **Working**: private scratch space for the current task
- **Short-term**: shared assignment context (board, messages, decisions)
- **Long-term**: relevant knowledge vault branches (not everything)

This keeps context window pressure manageable.

---

## 3. CLI Commands

### Existing

| Command | Behavior |
|---------|----------|
| `specdev init` | Scaffolds `.specdev/` into project (unchanged) |
| `specdev help` | Shows usage info (updated to include new commands) |

### Updated

#### `specdev update`

Updates system guides (`_guides/`, `_templates/`, `_main.md`, `_router.md`) to the latest version from the installed CLI. Preserves all project files (`knowledge/`, `project_notes/`, `assignments/`, `project_scaffolding/`).

Already exists — no behavior change, just needs to handle the new `knowledge/` directory correctly (preserve it entirely, since it's all project-owned).

### New

#### `specdev ponder workflow`

Interactive session that reviews recent work and helps the user articulate workflow-level observations. Writes to `knowledge/_workflow_feedback/`.

**Flow:**
1. Scans recent assignments (`assignments/*/context/decisions.md`, `*/tasks/*/result.md`) for material
2. Presents suggestions to the user:
   - "It looks like the scaffolding step was skipped in 2 of 3 recent assignments. Should we note that scaffolding guidance may need simplification?"
   - "The planning phase in assignment #00003 took 3 revision rounds. Should we note that the planning guide could provide more concrete examples?"
3. User can:
   - **Accept** — writes the observation as-is to `_workflow_feedback/`
   - **Edit** — user modifies the wording, then it's written
   - **Reject** — skip this suggestion
   - **Add custom** — user writes their own observation from scratch
4. Writes accepted observations to `knowledge/_workflow_feedback/` as timestamped entries

**Output format** (in `_workflow_feedback/`)
```markdown
## 2026-02-10 — Workflow Observations

### Scaffolding step often skipped
- **Observed in:** assignments #00002, #00003
- **Suggestion:** Scaffolding guide may be too heavyweight for small changes. Consider a lightweight scaffolding path for simple tasks.
- **Source:** user-confirmed via `specdev ponder workflow`

### Planning revisions excessive
- **Observed in:** assignment #00003
- **Suggestion:** Planning guide could include more concrete examples to reduce back-and-forth.
- **Source:** user-confirmed via `specdev ponder workflow`
```

#### `specdev ponder project`

Interactive session that reviews recent work and helps the user build local project knowledge. Writes to `knowledge/<branches>`.

**Flow:**
1. Scans recent assignments for material (same sources as above, plus code changes if git is available)
2. Presents suggestions organized by knowledge branch:
   - **codestyle:** "Assignment #00002 used early-return pattern consistently. Add to codestyle/error_handling.md?"
   - **architecture:** "The auth feature introduced a middleware layer at `src/middleware/`. Document in architecture/patterns.md?"
   - **domain:** "The billing feature references 'subscription tiers' and 'grace periods'. Capture in domain/?"
3. User can accept, edit, reject, or add custom (same as workflow ponder)
4. Writes accepted insights to the appropriate `knowledge/<branch>/` files
5. Updates `knowledge/_index.md` if new files or branches were created

**Key difference from `ponder workflow`:** this writes *project-specific* knowledge (patterns, architecture, domain) not workflow meta-observations.

### Command Summary

```
specdev init                    # Scaffold .specdev/ into project
specdev update                  # Update system guides to latest
specdev ponder workflow         # Interactive: review & write workflow feedback
specdev ponder project          # Interactive: review & write local knowledge
specdev help                    # Show usage info
specdev --version               # Show version
```

---

## 4. Impact on Existing Structure

### What changes

- New `knowledge/` directory in templates (local branches only, no global — global lives in this repo)
- New `learnings/` directory in this repo (not in templates) for aggregated global knowledge
- Assignment structure gains `context/` (short-term) and `tasks/` with `scratch.md` (working)
- Workflow guides updated to reference knowledge system and multi-agent coordination
- Two new CLI commands: `specdev ponder workflow` and `specdev ponder project`
- New dependency needed for interactive prompts (e.g., `inquirer` or `prompts`)
- `bin/specdev.js` updated to route `ponder` subcommands
- New source files: `src/commands/ponder-workflow.js`, `src/commands/ponder-project.js`
- New utility for scanning assignments: `src/utils/scan.js`

### What stays the same

- CLI remains primarily a scaffolder
- `_` prefix convention for system vs project files
- `specdev update` preserves project files, updates system files
- Overall assignment lifecycle (proposal → plan → scaffold → implement → validate)

---

## 5. Decisions Made

- **Message format:** Frontmatter YAML + markdown body (machine-readable metadata, human-readable content)
- **Ponder scan:** Start with rule-based file structure scanning (check which workflow phases exist, count files, detect skipped steps). Can add git diff analysis later.
- **Prompt library:** Node built-in `readline` — no new dependencies, keeps the package minimal
- **Ponder suggestions:** Rule-based for v1 (offline, no API key needed). LLM-powered suggestions can be added as a future `--smart` flag.
- **Completed assignments:** Keep in place for now. Archive strategy deferred to a future version.

## 6. Future Considerations

- `specdev contribute` command for packaging `_workflow_feedback/` and sending to this repo
- `specdev ponder --smart` flag for LLM-generated suggestions (requires API key)
- Git diff analysis in ponder scans for richer suggestions
- Task decomposition granularity guidance in templates
