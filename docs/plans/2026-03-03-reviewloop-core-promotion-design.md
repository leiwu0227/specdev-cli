# Design: Promote reviewloop to core skill + remove fireperp references

**Date:** 2026-03-03
**Status:** Approved

## Motivation

Reviewloop is essential to the specdev workflow — it shouldn't be an optional tool skill. Every project should have it, and making it optional sends the wrong signal.

## Changes

### 1. Move reviewloop from tools/ to core/

- Move `.specdev/skills/tools/reviewloop/` → `.specdev/skills/core/reviewloop/`
- Move `templates/.specdev/skills/tools/reviewloop/` → `templates/.specdev/skills/core/reviewloop/`
- Update frontmatter in `SKILL.md`: `type: tool` → `type: core`
- Reviewer configs stay inside the core skill directory (system-managed, not user-owned)

### 2. Update source code references

- **`src/commands/reviewloop.js`** — Change reviewers path from `skills/tools/reviewloop/reviewers` to `skills/core/reviewloop/reviewers`
- **`src/utils/update.js`** — Remove `reviewloop` from `OFFICIAL_TOOL_SKILLS`. Add `skills/tools/reviewloop` to `removePaths`.
- **`src/commands/init.js`** — No change needed; reviewloop arrives via template copy of `skills/core/`.

### 3. Migration cleanup on `specdev update`

- Remove `.claude/skills/reviewloop/` wrapper (stale)
- Remove `skills/tools/reviewloop/` from `.specdev/` (old location)
- Remove `reviewloop` entry from `active-tools.json` if present

### 4. Update skills README

- Add reviewloop to core skills listing in `.specdev/skills/README.md`
- Remove from tools section

### 5. Replace fireperp references in tests

- `tests/test-wrappers.js` — Replace `fireperp` with `mock-tool`
- `tests/test-active-tools.js` — Replace `fireperp` with `mock-tool`
- `tests/test-frontmatter.js` — Replace `fireperp` with `mock-tool`
- Leave `docs/plans/` untouched (historical records)

### 6. Update test expectations

- `tests/test-reviewloop-install.js` — Rework or remove (reviewloop is no longer a tool skill install)
- `tests/test-update-skills.js` — Update references to `OFFICIAL_TOOL_SKILLS` behavior for reviewloop
- `tests/test-skills-status.js` — Adjust if reviewloop was part of status output
