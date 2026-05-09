# Design: Structured Workflow Feedback Notes

## Overview

The current distill workflow has the right storage locations but weak rules for workflow feedback accumulation. During Knowledge Capture, each assignment writes `capture/workflow-diff.md` with raw observations about brainstorm, breakdown, implementation, and review. Later in the same phase, distill may synthesize durable observations into `.specdev/knowledge/workflow_feedback/`, but the guidance is intentionally broad and leaves agents to invent format and update behavior.

This refactor keeps the existing file-based knowledge model and makes the durable workflow feedback path explicit. Assignment-local `workflow-diff.md` remains a lightweight reflection artifact. Durable SpecDev workflow issues and improvements are accumulated as structured Markdown notes in `knowledge/workflow_feedback/`, using a required template with status, type, severity, first/last seen dates, observed assignments, mitigation, and proposed action.

## Non-Goals

- Do not replace Markdown knowledge with a JSON registry or database.
- Do not remove `capture/workflow-diff.md`; it remains the raw per-assignment source.
- Do not change the command contract for `specdev distill --assignment=<name>` or `specdev distill done <name>` unless implementation discovers a small output field is necessary.
- Do not automatically create assignments from workflow feedback in this change.
- Do not require every assignment to produce a workflow feedback note; many assignments should only produce the local workflow diff.

## Design

Add a structured workflow feedback template and update the Knowledge Capture skill to use it during distill. Because this repository develops SpecDev itself, product changes must be made in source-of-truth files under `templates/.specdev/`, tests, and docs. Installed runtime files under `.specdev/` should not be edited as part of this assignment unless the user explicitly requests a `specdev update` operation.

The durable note format should be installed into projects from a template file, for example `templates/.specdev/_templates/workflow_feedback_note.md`. Agents then create durable project notes under `.specdev/knowledge/workflow_feedback/*.md` using that template. A note should use concise Markdown with stable fields:

```markdown
# Short Workflow Feedback Title

Status: open | mitigated | resolved
Type: issue | improvement | recurring-pattern
Severity: minor | moderate | major
First seen: YYYY-MM-DD, assignment-name
Last seen: YYYY-MM-DD, assignment-name
Assignments observed: assignment-a, assignment-b

## Observation
- What happened, with concrete workflow/CLI/skill behavior.

## Impact
- Why it matters for agents or users.

## Current Mitigation
- How agents should handle it today.

## Proposed Action
- none | monitor | update-guidance | create-assignment
```

During Knowledge Capture, agents should classify workflow observations before writing durable notes:

- Project-local process patterns go to `knowledge/workflow/`.
- SpecDev workflow/product issues or improvement ideas go to `knowledge/workflow_feedback/`.
- One-off low-value reflections stay only in `capture/workflow-diff.md`.

Before creating a new workflow feedback note, agents must run `specdev knowledge search` or otherwise search `knowledge/workflow_feedback/` for related notes. If a note already exists, update `Last seen`, `Assignments observed`, and mitigation/proposed action instead of creating a duplicate. If the issue is severe or recurring, set `Proposed Action` to `create-assignment`; otherwise use `monitor`, `update-guidance`, or `none`.

The existing `knowledge/_index.md` description should be tightened so `knowledge/workflow/` means project-specific process knowledge, while `knowledge/workflow_feedback/` means feedback about SpecDev itself that could improve templates, skills, CLI behavior, or review flow.

## Success Criteria

- `templates/.specdev/skills/core/knowledge-capture/SKILL.md` tells agents exactly how to turn `capture/workflow-diff.md` observations into durable workflow feedback notes.
- A reusable workflow feedback note template exists under `templates/.specdev/` and is installed by `specdev init` and refreshed by `specdev update` through the normal template copy path.
- `templates/.specdev/knowledge/_index.md` clearly distinguishes `workflow/` from `workflow_feedback/`.
- The design does not require direct edits to installed runtime `.specdev/` files for product behavior changes.
- Tests verify `specdev init` or template installation includes the new template/guidance.
- Existing distill tests continue to pass.

## Testing Approach

Update template/init tests to assert the new workflow feedback template is installed. Add or adjust a focused test if there is an existing template-file coverage pattern for knowledge or skill files. Run targeted tests for init/template behavior and distill behavior, then run the full suite if practical.

## Risks

The main risk is making Knowledge Capture too heavy. The mitigation is to keep durable feedback optional and classification-based: raw reflections always go to `workflow-diff.md`, but only reusable SpecDev-level observations become structured feedback notes.

Another risk is confusing `knowledge/workflow/` with `knowledge/workflow_feedback/`. The template and `_index.md` update should make the distinction explicit and give concrete examples.
