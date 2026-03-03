# Index

Reference dictionary for all SpecDev resources. Consult when you need to find a specific guide, skill, or command.

---

## Workflow

- **`_guides/workflow.md`** — The 4-phase workflow (brainstorm → breakdown → implement → summary). Contains phase-by-phase instructions: what to do, which skill to load, checkpoint/gate commands, and review options. Read this when starting an assignment or resuming work.

## Reference Guides

- **`_guides/assignment_guide.md`** — How to create and structure assignment folders. Covers naming convention (NNNNN_type_slug), required subdirectories (brainstorm/, breakdown/, implementation/, review/), which template files to copy, and the expected artifacts at each phase.

- **`_guides/codestyle_guide.md`** — Project coding standards. Covers module independence, pure functions, single-responsibility, explicit signatures, documentation expectations, and import rules. Must read before writing any code.

- **`_guides/migration_guide.md`** — Migrating legacy (V3) assignment layouts to V4 subfolder structure. Only needed when `specdev update` detects old root-level phase files. Covers the `specdev migrate` command and file move mappings.

## Core Skills

### Brainstorm phase — choose one based on assignment type:

- **`skills/core/brainstorming/SKILL.md`** — For features, refactors, and new functionality. Interactive Q&A session: scans project context, asks 1-3 questions per round, explores 2-3 approaches, presents design in 200-300 word sections for incremental validation. Outputs `brainstorm/proposal.md` + `brainstorm/design.md`.

- **`skills/core/investigation/SKILL.md`** — For understanding unfamiliar code or systems. Defines learning objectives, investigates entry points and call chains, tests hypotheses with spike code, documents findings with file:line references. Outputs same brainstorm artifacts but as a research report.

- **`skills/core/diagnosis/SKILL.md`** — For bugs and unexpected behavior. Reproduces the bug (failing test required), finds root cause through evidence-based hypothesis testing, proposes fix with risk assessment. Outputs same brainstorm artifacts but as root cause analysis + fix design.

### Breakdown phase:

- **`skills/core/breakdown/SKILL.md`** — Turns validated design into ordered executable tasks. Each task: 2-5 minutes, complete TDD steps with exact code and commands, file paths, commit message. Includes a scaffolding check (triggers only for cross-module, high-risk, or >5-file changes), granularity gate, and skill declaration for subagent injection. Subagent reviews the plan (1-2 rounds), then auto-chains to implementing.

### Implement phase:

- **`skills/core/implementing/SKILL.md`** — Executes plan tasks via subagent dispatch. One fresh subagent per task (implementer prompt), followed by unified reviewer (spec compliance + code quality). Tracks progress via `scripts/track-progress.sh`. Supports `full` mode (TDD + review loop) and `lightweight` mode (trivial scaffold/config). Final test suite run before user approval.

- **`skills/core/test-driven-development/SKILL.md`** — The RED-GREEN-REFACTOR cycle. Write failing test → verify RED via `scripts/verify-tests.sh` → write minimal code → verify GREEN → refactor → commit. Injected into implementer subagents when tasks declare it in their `Skills:` field.

- **`skills/core/parallel-worktrees/SKILL.md`** — Git worktree isolation for tasks with zero overlapping file writes. Analyzes parallelizability, creates worktrees via `scripts/setup-worktree.sh`, dispatches independent subagents, merges branches, runs integration tests. Use when plan has clearly independent tasks.

### Summary phase:

- **`skills/core/knowledge-capture/SKILL.md`** — Final phase after implementation approval. Compares learnings against `project_notes/` to produce `capture/project-notes-diff.md` (proposed updates, not applied directly) and `capture/workflow-diff.md` (process friction/wins). Updates `feature_descriptions.md` and marks assignment done.

### Always-apply (read before any assignment):

- **`skills/core/verification-before-completion.md`** — No completion claims without fresh verification evidence. Core rule: run the command, read the output, only then claim success. Applies to tests, builds, linting, bug fixes — any status claim.

- **`skills/core/receiving-code-review.md`** — No performative agreement in reviews. Verify feedback against codebase before implementing. Push back with technical reasoning when feedback is wrong. No gratitude expressions — just fix or disagree with evidence.

### When needed:

- **`skills/core/systematic-debugging/SKILL.md`** — Root-cause-first debugging. Reproduce → gather evidence → hypothesize (top 3, ranked) → experiment one at a time → confirm root cause (not symptom) → fix with regression test. Use when tests fail unexpectedly during implementation.

## Tool Skills

Project-specific capabilities installed in `skills/tools/`. Declared in breakdown plan tasks via the `Skills:` field and injected into subagent prompts during implementation.

- Run `specdev skills` to list all installed tool skills with descriptions
- See `skills/tools/README.md` for how to create custom tool skills

## Project Context

- **`project_notes/big_picture.md`** — Project goals, tech stack, key decisions. Read at the start of every session.
- **`project_notes/feature_descriptions.md`** — Catalog of what's built: feature name, assignment ID, completion date, key files. Updated during knowledge capture.
- **`project_notes/assignment_progress.md`** — Assignment status tracking: ID, name, phase, status. Used to determine next assignment number.
- **`knowledge/`** — Accumulated project knowledge organized by branch (codestyle, architecture, domain, workflow). Built up over assignments via knowledge capture.

## CLI Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `specdev assignment "<desc>"` | Reserve next assignment ID | Starting new work |
| `specdev checkpoint <phase>` | Validate phase artifacts exist and are well-formed | Before requesting review or approval |
| `specdev approve <phase>` | Hard gate: signal to proceed past a phase | After user reviews and is satisfied |
| `specdev continue` | Detect current assignment state, suggest next action | Resuming work in a new session |
| `specdev review <phase>` | Launch manual review in a separate session | Optional quality check (brainstorm or implementation) |
| `specdev check-review` | Read review feedback and address findings | After a review session has been run |
| `specdev skills` | List all installed skills with descriptions | During breakdown to declare task skills |
