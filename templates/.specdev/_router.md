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

- **Brainstorming:** `skills/brainstorming/SKILL.md` — start here for new work
- **Breakdown:** `skills/breakdown/SKILL.md` — design → executable plan
- **Implementing:** `skills/implementing/SKILL.md` — plan → code with subagent dispatch
- **Knowledge Capture:** `skills/knowledge-capture/SKILL.md` — write diff files after completion

### Review agent skill (phase 4)

- **Review Agent:** `skills/review-agent/SKILL.md` — holistic phase reviews (separate session)

### Supporting skills (use when needed)

- **Test-Driven Development:** `skills/test-driven-development/SKILL.md` — RED-GREEN-REFACTOR
- **Systematic Debugging:** `skills/systematic-debugging/SKILL.md` — root-cause analysis
- **Parallel Worktrees:** `skills/parallel-worktrees/SKILL.md` — git worktree isolation
- **Orientation:** `skills/orientation/SKILL.md` — decision tree for skill selection

### Flat skills (reference guides)

- `skills/scaffolding-lite.md` — lightweight scaffolding
- `skills/scaffolding-full.md` — full scaffolding
- `skills/verification-before-completion.md` — always-apply: evidence before claims
- `skills/receiving-code-review.md` — always-apply: no performative agreement

---

## Assignment structure

Assignments live in `.specdev/assignments/<id>/` with subfolders: `brainstorm/`, `breakdown/`, `implementation/`, `review/`.
