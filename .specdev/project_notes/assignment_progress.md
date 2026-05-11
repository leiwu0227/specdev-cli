# Assignment Progress

Below is a list of proposed assignments and their completion progress.

## Format

| # | Assignment Name | Status | Completed Date | Notes |
|---|--------------|--------|----------------|-------|
| ##### | Short assignment name | Status | YYYY-MM-DD | Optional notes |

**Status Values:**
- **Proposed**: Assignment idea documented in brainstorm/proposal.md
- **Planning**: Working on breakdown/plan.md
- **Scaffolding**: Creating scaffold documents
- **In Progress**: Implementing tasks
- **Testing**: Running validation gates
- **Done**: All gates passed, assignment complete
- **Rolled Back**: Implementation abandoned or reverted

---

## Assignments

| # | Assignment Name | Status | Completed Date | Notes |
|---|-----------------|--------|----------------|-------|
| 00001 | distill-improvement | Done | 2026-03-04 | Refactored distill commands, integrated into knowledge-capture |
| 00002 | cursor-reviewer | Done | 2026-03-11 | Added cursor-agent as reviewloop reviewer |
| 00003 | mandatory-assignment-flag | Done | 2026-03-12 | .current pointer, discussions, focus command |
| 00004 | specdev-discussion-skill | Done | 2026-03-12 | Renamed discuss→discussion, added agent skill + discussion_progress.md |
| 00005 | claude-reviewer | Done | 2026-03-25 | Added Claude Code as reviewloop reviewer |
| 00006 | reviewer-focus-areas | Done | 2026-03-25 | Round-specific focus areas, max_rounds 5, SPECDEV_FOCUS env var |
| 00007 | multi-reviewer | Done | 2026-03-25 | Comma-separated --reviewer, independent rounds, per-reviewer feedback files |
| 00008 | workflow-status-json | Done | 2026-05-07 | Added specdev status --json for machine-readable workflow state |
| 00009 | reviewer-preflight-checks | Done | 2026-05-07 | Added reviewloop --preflight and automatic blocking reviewer readiness checks |
| 00010 | structured-skill-inspection | Done | 2026-05-07 | Added skills --json and guarded skills view for progressive skill loading |
| 00011 | bounded-working-memory | Done | 2026-05-07 | Added memory refresh command and bounded working_memory.md generation |
| 00012 | guided-layout-migration | Done | 2026-05-08 | Made migrate guide-based by default; moved old automatic assignment migration to legacy-assignments |
| 00013 | sqlite-knowledge-retrieval | Done | 2026-05-08 | Added SQLite FTS knowledge index/search commands with generated cache |
| 00015 | claude-reviewer-observability | Done | 2026-05-10 | Added reviewloop heartbeats, richer reviewer logs, timeout cleanup, strict stdout salvage, and Claude stream-json progress |
| 00016 | distill-workflow | Done | 2026-05-10 | Added structured workflow feedback note template and accumulation guidance |
| 00017 | workflow-architecture | Done | 2026-05-11 | Centralized workflow facts in a contract module and added drift coverage |
| 00018 | workflow-agents | Done | 2026-05-11 | Added first-class workflow agents, researcher command, agent-runner, and agent inspect |
| 00019 | autocontinue-reviewloop | Done | 2026-05-11 | Added reviewloop autocontinue contract/guidance and kept discussions standalone |

---

## Instructions

1. When creating a new assignment, add a row with the next number (five digits)
2. Update status as the assignment progresses through stages
3. Add completion date when the assignment reaches "Done" status
4. Use Notes column for blockers, important updates, or rollback reasons
