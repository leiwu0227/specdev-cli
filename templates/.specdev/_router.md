Based on the user request, identify the situation and route to the right skill.

---

## First reads

- `.specdev/_main.md` — workflow overview
- `.specdev/_guides/README.md` — guide index
- `.specdev/project_notes/big_picture.md` — project context
- `.specdev/project_notes/feature_descriptions.md` — what exists today

---

## Core guides

- `.specdev/_guides/codestyle_guide.md` (must follow)
- `.specdev/_guides/assignment_guide.md` (must follow)

---

## Skill routing

### Main agent skills (phases 1-3, 5)

- **Brainstorming:** `skills/core/brainstorming/SKILL.md` — start here for new work
- **Breakdown:** `skills/core/breakdown/SKILL.md` — design → executable plan
- **Implementing:** `skills/core/implementing/SKILL.md` — plan → code with subagent dispatch
- **Knowledge Capture:** `skills/core/knowledge-capture/SKILL.md` — write diff files after completion

### Review agent skill (phase 4)

- **Review Agent:** `skills/core/review-agent/SKILL.md` — holistic phase reviews (separate session)

### Supporting skills (use when needed)

- **Test-Driven Development:** `skills/core/test-driven-development/SKILL.md` — RED-GREEN-REFACTOR
- **Systematic Debugging:** `skills/core/systematic-debugging/SKILL.md` — root-cause analysis
- **Parallel Worktrees:** `skills/core/parallel-worktrees/SKILL.md` — git worktree isolation
- **Orientation:** `skills/core/orientation/SKILL.md` — decision tree for skill selection

### Flat skills (reference guides)

- `skills/core/scaffolding-lite.md` — lightweight scaffolding
- `skills/core/scaffolding-full.md` — full scaffolding
- `skills/core/verification-before-completion.md` — always-apply: evidence before claims
- `skills/core/receiving-code-review.md` — always-apply: no performative agreement

### Tool skills (project-specific)

- Check `skills/tools/` for project-specific tool skills
- Tool skills can be referenced in plan tasks via the `Skills:` field

---

## Assignment structure

Assignments live in `.specdev/assignments/<id>/` with subfolders: `brainstorm/`, `breakdown/`, `implementation/`, `review/`.
