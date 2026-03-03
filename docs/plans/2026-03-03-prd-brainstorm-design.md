# Structured PRD for Specdev Brainstorming

**Date:** 2026-03-03

## Problem

Specdev's brainstorming phase produces `proposal.md` and `design.md` as freeform documents. The checkpoint only validates existence + 20 character minimum. This means each brainstorm produces a different shape of output — missing non-goals, success criteria, or scope boundaries depending on the agent's inclinations. PRDs are a well-established format with known-good sections, and specdev should learn from that.

## Inspiration

Three community PRD tools for Claude Code were studied:

- **spec-to-code** — 3-phase pipeline (PRD, tasks, implementation) with 13 clarifying question categories and 13 PRD sections
- **create-prd (schoolofai)** — 9-section PRD template with TDD-first question ordering and two-phase task generation with human gate
- **prd-taskmaster** — 12-section PRD with 60-point automated quality scoring, vague-language detection, and SMART metric enforcement

Key takeaways:
- All three enforce **non-goals** and **success criteria** sections — these prevent the most wasted work
- All three define **structured question categories** for requirements gathering
- prd-taskmaster's scoring system is impressive but over-engineered for specdev's "script does mechanics, agent does judgment" philosophy
- The value is in consistent structure, not rigid enforcement

## Solution

Add lightweight PRD structure to the brainstorming phase through three changes:

1. **Design template** with required/optional sections scaled by assignment type
2. **Question categories** in the brainstorming SKILL.md as guidance
3. **Checkpoint validation** of required section headers

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Structure level | Required + optional sections | Consistent shape without ceremony |
| Scaling dimension | Assignment type sets baseline, agent can upgrade | No new concepts, type already exists |
| Validation depth | Structural only (headers present) | Agent handles quality, checkpoint handles structure |
| Content quality checks | None | Deterministic checks can't judge design quality — that's the agent's and reviewer's job |
| Template location | `_templates/brainstorm-design.md` | Follows existing template pattern |
| proposal.md | Unchanged | Still serves as the short pitch, different purpose |

## Required Sections by Type

| Type | Required Sections |
|------|------------------|
| feature | Overview, Goals, Non-Goals, Design, Success Criteria |
| bugfix | Overview, Root Cause, Fix Design, Success Criteria |
| refactor | Overview, Non-Goals, Design, Success Criteria |
| familiarization | Overview |

The agent can always add more sections beyond the minimum. Optional sections available: User Stories, Dependencies, Risks, Technical Constraints, Testing Approach, Open Questions.

## Question Categories (SKILL.md Guidance)

Not a rigid interview script — guidance for what the agent should explore during conversation.

**Core topics** (always cover):
- Problem/goal — what are we solving and why
- Scope boundaries — what this should NOT do
- Success criteria — how do we verify it works

**Contextual topics** (cover when relevant):
- Target users/callers — who uses this
- Edge cases — what could go wrong
- Dependencies — what does this touch
- Existing patterns — how does the codebase handle similar things today
- Testing approach — how will this be tested

## Checkpoint Enhancement

The brainstorm checkpoint currently validates:
- `proposal.md` exists + 20 chars
- `design.md` exists + 20 chars

New behavior adds: validate required section headers in `design.md` based on assignment type.

- Extract type from assignment directory name (e.g., `00001_feature_auth` -> `feature`)
- Check for required headers using regex (`/^## Section Name/m`)
- On missing sections: report which are missing, block progression
- `--json` output includes: `{ sections: { required: [...], found: [...], missing: [...] } }`

No scoring, no content quality checks — structural presence only.

## Changes

| File | Change |
|------|--------|
| `templates/.specdev/_templates/brainstorm-design.md` | New template with required/optional sections by type |
| `templates/.specdev/skills/core/brainstorming/SKILL.md` | Add question category guidance + reference to template + type-based scaling |
| `src/commands/checkpoint.js` | Validate required section headers based on assignment type |
| `tests/test-checkpoint-tools.js` | Add tests for section validation by type |

## What Doesn't Change

- `proposal.md` — still the short pitch
- Assignment command — type system already exists
- Approve/continue flow — untouched
- Breakdown phase — untouched
