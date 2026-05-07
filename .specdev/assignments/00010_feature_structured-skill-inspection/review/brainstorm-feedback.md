# Brainstorm Review — 00010_feature_structured-skill-inspection

## Round 1

**Verdict:** approved

### Findings

1. [F1.1] **Scanner enrichment is the right call but adds unused fields to text output path.**
   `scanSkillsDir` currently returns `{ name, description, hasScripts, category }`. The design proposes adding `path`, `skill_md_path`, and tool activation status to the shared scanner. The text listing (`skillsListCommand`) doesn't use paths. This slightly widens the return shape for all callers, but it's the correct tradeoff — maintaining a single scanner avoids inventory divergence (the design explicitly calls this out). No action needed; just noting the coupling.

2. [F1.2] **`--json` interaction with subcommands is unspecified.**
   If a user runs `specdev skills install --json`, the behavior isn't defined. The current routing checks subcommand first (install/remove/sync) before falling through to list. Since `--json` only makes sense on the list path, the natural routing order already handles this — `install` would consume the args before `--json` is evaluated. No design change needed, but implementation should avoid accidentally applying `--json` formatting to error output from subcommands.

3. [F1.3] **Codebase verification: all referenced files and structures exist.**
   - `src/utils/skills.js` with `scanSkillsDir` — confirmed (line 87)
   - `src/commands/skills.js` with subcommand routing — confirmed (lines 10-21)
   - `.specdev/skills/active-tools.json` — confirmed
   - Flat markdown skills (`receiving-code-review.md`, `verification-before-completion.md`) — confirmed in `.specdev/skills/core/`
   - `readActiveTools` in `src/utils/active-tools.js` — confirmed
   - Existing test file `tests/test-skills.js` covers listing, install, remove, sync — confirmed

4. [F1.4] **Scope is appropriate.** Two features (`--json` flag and `view` subcommand) in one assignment. Both are read-only additions that don't modify existing behavior. The non-goals are clear and reasonable.

### Addressed from changelog
- (none -- first round)
