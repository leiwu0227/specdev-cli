# SpecDev Workflow v3 — Design

## Proposal

Redesign the specdev workflow from 14+ skills with redundant handoffs into a clean 5-phase, 2-agent architecture. The current flow has too many skill boundaries, redundant Q&A between brainstorm and planning, and no clear separation between implementer and reviewer. The new design combines brainstorm+planning into one interactive phase, adds an automatic breakdown phase, keeps superpowers-style subagent implementation, and introduces a dedicated review agent that communicates via file-based signals.

## Design

### Architecture: 5 Phases, 2 Agents

**Main agent** (one session):
1. **Brainstorm** — interactive Q&A with user → `proposal.md` + `design.md`
2. **Breakdown** — automatic, reads design, writes detailed executable plan → `plan.md`
3. **Implement** — automatic, subagent per task with per-task spec+quality review loops
4. **Knowledge Capture** — automatic, writes two diff files

**Review agent** (separate session, launched by user):
5. **Verify** — holistic review at phase boundaries (breakdown, implementation)

### Phase 1: Brainstorm (Interactive)

Combines the old brainstorm + planning Q&A phases. The main agent:

1. Scans project context (existing `get-project-context.sh`)
2. Asks questions one at a time (multiple choice preferred)
3. Proposes 2-3 approaches with trade-offs
4. Presents design in 200-300 word sections, validates each with user
5. Writes two files to `assignments/<id>/brainstorm/`:
   - `proposal.md` — short (1-2 paragraphs), what and why, serves as index card
   - `design.md` — full validated design with decisions, architecture, components, data flow
6. Announces "Brainstorm complete" and stops

**After brainstorm stops**, the user can:
- Launch review agent in separate session: `review brainstorm`
- Review agent reads files, writes `review/review-feedback.md`
- User relays feedback to main agent, main agent addresses it (may ask user for clarification)
- User relays updates back to review agent, repeat until approved
- Brainstorm review is always user-mediated (design-level feedback may need human judgment)

### Phase 2: Breakdown (Automatic)

Triggered when user tells main agent `auto next`. The main agent:

1. Reads `brainstorm/design.md`
2. Generates detailed executable plan (superpowers writing-plans style):
   - Bite-sized tasks (2-5 minutes each)
   - Exact file paths, complete code, exact commands with expected output
   - TDD steps: write failing test → verify fails → implement → verify passes → commit
3. Writes to `assignments/<id>/breakdown/plan.md`
4. Writes `review/ready-for-review.md` (phase: breakdown, round: 1)
5. Checks for `review/watching.json`:
   - If present → runs `poll-for-feedback.sh` (blocks until feedback)
   - If absent → proceeds immediately to implementation

### Phase 3: Implement (Automatic)

Same as superpowers subagent-driven-development:

1. Extract tasks from `breakdown/plan.md`
2. Per task:
   - Dispatch fresh implementer subagent with full task text
   - Implementer implements, tests, commits, self-reviews
   - Dispatch spec reviewer subagent → loop until spec compliant
   - Dispatch code quality reviewer subagent → loop until approved
3. Track progress in `implementation/progress.json`
4. After all tasks: writes `review/ready-for-review.md` (phase: implementation, round: 1)
5. Polls for review feedback if reviewer watching

### Phase 4: Verify (Review Agent)

The review agent is a separate session. It has two modes:

**Explicit mode:**
- `review brainstorm` — one-shot review of brainstorm files
- `review breakdown` — one-shot review of breakdown plan
- `review implementation` — one-shot review of full implementation

**Auto mode:**
- `autoreview rest` — enter watch mode for breakdown + implementation
- `autoreview breakdown and implementation` — same, explicit
- Writes `review/watching.json` with phases being watched
- Polls for `ready-for-review.md`, auto-reviews when it appears

**`autoreview brainstorm` is not valid** — brainstorm review is always user-mediated.

**Review loop:**
- Review agent reads assignment files, writes `review/review-feedback.md`
- Main agent reads feedback, fixes issues automatically, re-signals
- Up to **3 rounds** per phase. After 3 rounds without approval, escalate to user.
- For breakdown/implementation: fully automatic, no user involvement needed

**Holistic focus:**
- Review agent checks the *whole* thing, not individual tasks
- Breakdown review: "Is the plan complete? Tasks ordered correctly? Any gaps?"
- Implementation review: "Does the full implementation match the design? Integration issues?"

### Phase 5: Knowledge Capture (Automatic)

Main agent writes two files after implementation is approved:

1. **Project notes diff** — compares what was learned during the assignment against `project_notes/` files. Notes what could be improved in project_notes (does NOT update the files).
2. **Workflow diff** — compares the actual flow against the specdev workflow. Notes observations about what worked, what didn't, what could be improved.

Written to the knowledge vault. Quick, automatic, no user interaction.

### Communication Protocol

The assignment folder is the communication channel between agents:

```
assignments/00001_feature_auth/
├── brainstorm/
│   ├── proposal.md            # short index card — what and why
│   └── design.md              # validated design with decisions
├── breakdown/
│   └── plan.md                # detailed executable steps
├── implementation/
│   └── progress.json          # task completion tracking
└── review/
    ├── watching.json           # reviewer presence signal
    ├── ready-for-review.md     # main agent → review agent
    └── review-feedback.md      # review agent → main agent
```

**Signal file formats:**

`ready-for-review.md`:
```markdown
# Ready for Review

**Phase:** breakdown
**Timestamp:** 2025-01-15T10:30:00
**Round:** 1
```

`review-feedback.md`:
```markdown
# Review Feedback

**Phase:** breakdown
**Verdict:** approved / needs-changes
**Round:** 1
**Timestamp:** 2025-01-15T10:35:00

## Findings
- [list, or "None — approved"]
```

`watching.json`:
```json
{"phases": ["breakdown", "implementation"], "started_at": "..."}
```

**Blocking poll:** `poll-for-feedback.sh` blocks via shell sleep loop until `review-feedback.md` appears. Default timeout 30 minutes. No token burn.

**Race condition handling:** Signal files are persistent. If breakdown finishes before review agent starts watching, `ready-for-review.md` is already there. Review agent picks it up immediately when it starts.

### Skill Inventory (New)

| Skill | Type | Agent | Scripts | Prompts |
|-------|------|-------|---------|---------|
| brainstorming | Folder | Main | get-project-context.sh | — |
| breakdown | Folder | Main | — | — |
| implementing | Folder | Main | extract-tasks.sh, track-progress.sh, poll-for-feedback.sh | implementer.md, spec-reviewer.md, code-reviewer.md |
| review-agent | Folder | Review | poll-for-feedback.sh | breakdown-reviewer.md, implementation-reviewer.md |
| knowledge-capture | Folder | Main | — | — |
| test-driven-development | Folder | Both | verify-tests.sh | — |
| systematic-debugging | Folder | Both | — | — |
| parallel-worktrees | Folder | Main | setup-worktree.sh | — |
| orientation | Folder | Both | list-skills.sh | — |

**Removed:** planning, verification, spec-review, code-review, gate-coordination, subagent-dispatch, knowledge-capture-project, knowledge-capture-specdev (all absorbed or replaced)

**Kept as-is:** test-driven-development, systematic-debugging, parallel-worktrees

**Reworked:** brainstorming, orientation, knowledge-capture (simplified)

**New:** breakdown, implementing, review-agent

### Key Decisions

1. **Brainstorm + planning merged** — eliminates redundant Q&A between phases
2. **Review agent is a separate session** — not a subagent, communicates via files
3. **Brainstorm review is user-mediated** — design feedback may need human judgment
4. **Breakdown + implementation review is automatic** — agents resolve technical issues on their own
5. **3 round limit on review loops** — prevents infinite ping-pong, escalates to user
6. **Signal files are minimal** — phase, timestamp, round. Content lives in the assignment files.
7. **`autoreview brainstorm` is not valid** — brainstorm review is always explicit
8. **Per-task spec/quality reviews stay as subagents** (superpowers style) — review agent only does holistic phase reviews
9. **Knowledge capture writes diffs, not updates** — user decides whether to apply
10. **Breakdown plan follows superpowers writing-plans format** — proven, detailed, bite-sized TDD tasks
