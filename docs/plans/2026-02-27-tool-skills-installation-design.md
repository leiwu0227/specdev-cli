# Tool Skills Installation & Discovery System

**Date:** 2026-02-27

## Problem

Tool skills (project-specific capabilities in `.specdev/skills/tools/`) are frequently ignored by coding agents during assignments. The breakdown phase relies on the agent remembering to run `specdev skills` and manually declaring tools per task. In practice, agents skip this step, and subagents never receive the tool skill content.

## Solution

An activation system that combines:
- **Interactive installation** with LLM-driven validation
- **Auto-discovery wrappers** in coding agent skill folders
- **Enforcement touchpoints** at breakdown and checkpoint

## Data Model

### `active-tools.json` (`.specdev/skills/active-tools.json`)

Single source of truth for which tool skills are active in this project.

```json
{
  "tools": {
    "fireperp": {
      "installed": "2026-02-27",
      "validation": "smoke",
      "lastValidated": "2026-02-27",
      "wrappers": [".claude/skills/fireperp.md"],
      "inferredTriggers": {
        "keywords": ["API documentation"],
        "inferred": true
      }
    }
  },
  "agents": ["claude-code"]
}
```

### Skill Frontmatter Extension

Tool skills get optional validation and trigger fields:

```yaml
---
name: fireperp
description: Web search via Perplexity API
type: tool
triggers:
  keywords: ["web search", "research", "look up", "verify facts"]
  paths: []
  operations: ["brainstorm", "fact-check"]
validation:
  env: ["PERPLEXITY_API_KEY"]
  basic: "which fire"
  smoke: "fire perplexity 'test' --max-tokens 10"
---
```

**Triggers** control when breakdown warns about missing skill declarations:
- `keywords` — terms in task descriptions that suggest this skill is needed
- `paths` — file path patterns the skill is relevant to
- `operations` — workflow operations (brainstorm, debug, etc.)

**Trigger precedence:**
- Author-owned: canonical triggers in SKILL.md frontmatter (source of truth)
- Installer-owned: derived hints generated at install time, cached in `active-tools.json`
- Frontmatter wins on conflict
- If frontmatter triggers are missing, install can propose generated triggers marked `inferred: true` for review

**Validation** declares prerequisite checks per level:
- `env` — required environment variables (checked first, cheapest)
- `basic` — binary/file existence command
- `smoke` — harmless read-only command (default level)

Validation chain: env → basic → smoke. Each level gates the next.

## Commands

### `specdev skills install` — Interactive Installation

1. Scan `.specdev/skills/tools/` for available tool skills
2. Read frontmatter from each SKILL.md
3. Auto-detect coding agents (check for `.claude/`, `.codex/`, `.opencode/`)
4. Present interactive prompt:
   - Checkbox list of available tool skills (name + description)
   - Checkbox list of detected coding agents (pre-ticked)
5. For each selected skill, run validation:
   - LLM executes the validation chain (env → basic → smoke)
   - LLM interprets results, reports issues, suggests fixes
   - User can proceed despite warnings or fix and retry
6. If skill has no frontmatter triggers, LLM reads the skill body and proposes triggers marked `inferred: true`
7. Generate wrappers in each selected agent's skill folder
8. Update `active-tools.json`

### `specdev skills remove <name>` — Clean Removal

1. Read `active-tools.json` to find wrapper paths
2. Delete wrappers
3. Remove entry from `active-tools.json`

### `specdev skills sync` — Reconciliation

1. Compare `active-tools.json` against `.specdev/skills/tools/`
2. Remove wrappers for tools no longer in `tools/` (stale)
3. Warn about tools in `tools/` that aren't installed (available but inactive)
4. Regenerate any missing wrappers for active tools
5. Runs automatically as part of `specdev update`

### `specdev skills` (existing, enhanced)

- Current behavior: list all skills
- New: show activation status next to tool skills (active / available / stale)

## Wrapper Format

Thin SKILL.md placed in the coding agent's skill folder. Gives the agent enough context to match the skill to relevant work, then points to the source of truth.

**Template:**

```markdown
---
name: fireperp
description: Web search via Perplexity API. Use for researching topics, looking up API docs, verifying facts, and checking library status.
---

# fireperp

Web search tool powered by the Perplexity Search API.

**Source of truth:** `.specdev/skills/tools/fireperp/SKILL.md`
Read the source skill file and follow its instructions.
```

**Generation rules:**
- `name` — copied from source SKILL.md frontmatter
- `description` — copied from source, extended with "when to use" summary (LLM-generated during install)
- Body — one-line summary + canonical pointer
- No duplication of usage details, scripts, or examples

**Per-agent placement:**

| Agent | Wrapper path | Detection |
|-------|-------------|-----------|
| Claude Code | `.claude/skills/<name>.md` | `.claude/` exists |
| Codex | `.codex/skills/<name>/SKILL.md` | `.codex/` or `AGENTS.md` exists |
| OpenCode | `.claude/skills/<name>.md` (shared) | `.opencode/` exists |

Claude Code and OpenCode share the same wrapper (OpenCode reads `.claude/skills/` as fallback). Codex gets its own in its expected location. The `wrappers` array in `active-tools.json` tracks all generated paths for clean removal.

## Enforcement Touchpoints

### Auto-Discovery (wrapper)

The coding agent's native skill matching picks up the wrapper during any phase. If the agent encounters relevant work, the wrapper triggers and points to the source skill. This catches organic usage without plan declarations.

### Breakdown (advisory)

After writing the plan, check each task against active tool skill triggers:
- Only warn when the match is high-confidence (trigger keywords/paths/operations match task content)
- If a task interacts with something an active tool skill covers and doesn't declare it in `Skills:`, warn
- Agent adds the declaration or records a waiver

**Waiver format** in plan tasks:
```
**Skills:** [test-driven-development]
**Skipped:** fireperp — this task is pure refactoring, no research needed
```

### Checkpoint (advisory, machine-readable)

`specdev checkpoint implementation` checks:
- Read `active-tools.json` for the active tool set
- Read plan for `Skills:` and `Skipped:` declarations
- Distinguish intentional non-use (has waiver) from accidental omission (no declaration, no waiver)

**Structured output** (`--json`):

```json
{
  "warnings": [
    {"code": "TOOL_SKILL_UNUSED", "skill": "fireperp", "waiver": null},
    {"code": "TOOL_SKILL_SKIPPED", "skill": "fireperp", "task": 3, "reason": "no research needed"}
  ]
}
```

### What enforcement does NOT do

- Hard-block implementation if a skill wasn't declared
- Force every tool skill to be used in every assignment
- Validate during implementation (validation happens at install time)

Enforcement is graduated: auto-discovery catches organic use, breakdown catches planning omissions, checkpoint catches assignment-level gaps. All advisory, not blocking.
