# Skill Installation Design

**Problem:** Specdev relies on coding agents reading CLAUDE.md → _main.md to discover the workflow. At session boundaries (new conversation) or during long-context drift, agents lose track. There's no native integration with the coding agent's own skill/command system.

**Solution:** During `specdev init --platform=claude`, install thin pointer skills into `.claude/skills/` so specdev workflows are available as native slash commands.

---

## Skills

Five slash commands, serving two purposes:

**Drift recovery (mid-session):**

| Skill | Purpose |
|-------|---------|
| `/specdev-remind` | Compact context refresh — current state + phase rules |
| `/specdev-rewind` | Full re-read of `_main.md`, hard re-anchor |

**Session boundary (new conversation):**

| Skill | Purpose |
|-------|---------|
| `/specdev-brainstorm` | Kick off the brainstorm/design phase |
| `/specdev-continue` | Resume work — auto-detects review mode |
| `/specdev-review` | Orient a new session as the review agent |

## Skill File Contents

All files live in `.claude/skills/` (project-level).

### specdev-remind.md

```markdown
---
name: specdev-remind
description: Re-anchor to the specdev workflow with a phase-aware context refresh
---

Run `specdev remind` and present the output to the user. This shows your current assignment, phase, and the rules that apply right now.

After reading the output, continue your work following those rules. Announce every subtask with "Using specdev: <action>".
```

### specdev-rewind.md

```markdown
---
name: specdev-rewind
description: Fully re-read the specdev workflow and re-anchor from scratch
---

You have drifted from the specdev workflow. Stop what you're doing and:

1. Read `.specdev/_main.md` completely
2. Run `specdev remind` to confirm your current assignment and phase
3. Resume work following the workflow rules

Announce every subtask with "Using specdev: <action>".
```

### specdev-brainstorm.md

```markdown
---
name: specdev-brainstorm
description: Start the specdev brainstorm phase for a new feature or change
---

Read `.specdev/skills/core/brainstorming/SKILL.md` and follow it exactly.

Start by reading `.specdev/_main.md` for workflow context, then begin
the interactive brainstorm process with the user.
```

### specdev-continue.md

```markdown
---
name: specdev-continue
description: Resume specdev work from where you left off
---

1. Run `specdev remind` to see current assignment state and phase
2. Check if `.specdev/assignments/<current>/review/watching.json` exists
   - If yes: a review agent is active. Use auto mode with polling.
   - If no: manual mode. Proceed without polling.
3. Read the skill for your current phase:
   - brainstorm → `.specdev/skills/core/brainstorming/SKILL.md`
   - breakdown → `.specdev/skills/core/breakdown/SKILL.md`
   - implementation → `.specdev/skills/core/implementing/SKILL.md`
4. Pick up from where the assignment state indicates

Announce every subtask with "Using specdev: <action>".
```

### specdev-review.md

```markdown
---
name: specdev-review
description: Start a specdev review agent session
---

You are the review agent. Read `.specdev/skills/core/review-agent/SKILL.md`
and follow it exactly.

Ask the user which mode to use:
- `review <phase>` — one-shot review of a specific phase
- `autoreview <phases>` — watch and review phases automatically
```

## Installation Mechanism

### `specdev init --platform=claude`

1. Creates `.specdev/` directory (existing behavior)
2. Creates `CLAUDE.md` adapter if not exists (existing behavior)
3. **New:** Creates `.claude/skills/` directory and writes all 5 skill files

Other platforms (`codex`, `cursor`, `generic`) skip step 3.

### `specdev update`

Auto-detects whether skills were installed by checking if `.claude/skills/specdev-remind.md` exists. If so, overwrites all 5 specdev skill files with current versions. They're system-managed pointers, not user content.

### Implementation

Skill file contents are defined as a template map in `src/commands/init.js` (inline strings, similar to `adapterContent()`). No new template directory needed — each file is under 15 lines.

Files involved:
- Modify: `src/commands/init.js` — add skill templates and installation logic
- Modify: `src/utils/update.js` — add skill file update with auto-detection
- Modify: `bin/specdev.js` — no changes needed (skills are not CLI commands)
