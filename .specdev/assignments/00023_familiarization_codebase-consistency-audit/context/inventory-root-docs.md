# Inventory: Root docs and misc

Scope: root-level user-facing docs/scripts/schemas, `learnings/` (recursive), and `docs/` (recursive, includes `docs/plans/`). FINDINGS-ONLY — no source files changed.

References were checked against `src/`, `bin/`, `templates/.specdev/`, `.specdev/_main.md`, `.specdev/_index.md`, `.specdev/_guides/`. Threshold: aggressive — flag anything not actively referenced by current code/workflow, even if currently harmless.

## Files

| Path | Purpose (one line) | Last meaningfully touched (commit subject) |
| --- | --- | --- |
| README.md | Primary user-facing CLI overview, quick start, commands, and skills table | refactor: thin workflow runtime guidance |
| CLAUDE.md | Claude Code platform adapter (points to `.specdev/_main.md`) plus repo dev rules (releaseDate, "Specdev:" announce, test confirmation) | docs: refresh readme and release date guidance |
| AGENTS.md | Codex platform adapter (points to `.specdev/_main.md`) plus repo dev rules — near-duplicate of CLAUDE.md minus the test-confirmation IMPORTANT block | feat: add reviewloop autocontinue guidance |
| QUICKSTART.md | Onboarding guide describing the v3/4-phase workflow with `distill` commands | feat: add two-tier review choices |
| SETUP.md | Pre-v0.0.1 package author/publish/npm-link setup checklist | Initial commit: SpecDev CLI v0.0.1 |
| GITHUB_SETUP.md | Pre-v0.0.1 instructions for initial git push + npm publish setup | Initial commit: SpecDev CLI v0.0.1 |
| CHANGELOG.md | Changelog frozen at 0.0.4 (2026-02-11) — entries describe skills/scaffolding model that no longer exists | Add subagent-driven development skill and wire knowledge capture into workflow |
| setup-github.sh | Helper script for initial git/GitHub remote setup; substitutes `YOUR_USERNAME` in README | Initial commit: SpecDev CLI v0.0.1 |
| specdev.assignment-schema.json | Authoritative assignment schema (top-level dirs, phases, optional paths) — included in package `files` and consumed by `src/utils/assignment-schema.js` | feat: per-assignment knowledge capture with ponder aggregation |
| docs/assignment-schema.md | Narrative explanation of the assignment schema and validation policy | feat: add legacy assignment migration command and tighten v4 workflow checks |
| learnings/guide_feedback.md | Empty placeholder (~1 line) for cross-project guide feedback | Add dynamic knowledge system, ponder commands, and multi-agent support |
| learnings/plan-header-depth-h2-vs-h3.md | Detailed friction report about `### Task N` vs `## Task N` header parsing in `extract-tasks.sh`/`track-progress.sh` | chore: capture specdev workflow learnings |
| learnings/progress-json-init-bug.md | Bug report: `implement.js` writes `{}` to `progress.json` and races `track-progress.sh` lazy init | chore: capture specdev workflow learnings |
| learnings/silent-test-relaxation-caught-by-cross-doc-review.md | Anti-pattern note: test loosened to mask Success-Criteria regression; caught by cross-doc review | chore: capture specdev workflow learnings |
| learnings/workflow_improvements.md | Empty placeholder (~1 line) for cross-project workflow improvements | Add dynamic knowledge system, ponder commands, and multi-agent support |
| docs/plans/2026-02-11-review-agent-resilience-design.md | Pre-history design: 8-subcommand `specdev review` → `work`/`check` resilience model | refactor: replace specdev review with specdev work/check commands |
| docs/plans/2026-02-11-review-agent-resilience-plan.md | Implementation plan introducing `specdev work`/`specdev check` (no longer the command surface) | refactor: replace specdev review with specdev work/check commands |
| docs/plans/2026-02-12-executing-orientation-skills.md | Plan for now-removed `executing` and `orientation` skills | docs: add executing + orientation skills implementation plan |
| docs/plans/2026-02-12-planning-skill-prototype.md | Plan for now-removed `planning` skill prototype + platform adapter generator | docs: add planning skill prototype implementation plan |
| docs/plans/2026-02-12-specdev-v2-design.md | "SpecDev v2" agent-agnostic framework design (skills-as-tools, state/, etc.) | docs: add specdev v2 design — agent-agnostic workflow framework |
| docs/plans/2026-02-12-workflow-v3-design.md | "Workflow v3" 5-phase, 2-agent architecture design | docs: add workflow v3 design — 5 phases, 2 agents |
| docs/plans/2026-02-12-workflow-v3-plan.md | Migration plan to v3 (delete 8 skills, etc.) | docs: add workflow v3 implementation plan — 8 tasks |
| docs/plans/2026-02-13-skill-architecture-redesign-plan.md | Plan: restructure `skills/` into `core/` and `tools/`, aligned frontmatter | feat: restructure skills into core/ and tools/ with aligned frontmatter |
| docs/plans/2026-02-13-skill-architecture-redesign.md | Design for `core/` vs `tools/` split and Claude/SpecDev two-layer model | feat: restructure skills into core/ and tools/ with aligned frontmatter |
| docs/plans/2026-02-14-architectural-hardening.md | Security/code-hygiene plan around `work.js`/`check.js` (commands no longer exist) | docs: add architectural hardening design plan |
| docs/plans/2026-02-14-context-drift-design.md | Three-mechanism context-drift design ("Using specdev:" prefix, `specdev remind`, hooks) | docs: add context-drift and skill-installation design plans |
| docs/plans/2026-02-14-skill-installation-design.md | Design for `.claude/skills/` slash-command installation | docs: add context-drift and skill-installation design plans |
| docs/plans/2026-02-14-skill-installation-plan.md | Plan for 5 specdev slash-command skills | docs: add context-drift and skill-installation design plans |
| docs/plans/2026-02-17-workflow-v4-design.md | "Workflow v4" single-thread auto-review + superpowers alignment design | refactor: rename work/check commands to main/review, add workflow v4 design |
| docs/plans/2026-02-17-workflow-v4-plan.md | v4 implementation plan (delete `main.js`/`remind.js`, add `start/assignment/breakdown/implement/review`) | feat: add legacy assignment migration command and tighten v4 workflow checks |
| docs/plans/2026-02-27-distill-commands-design.md | Design swapping interactive `ponder` for `specdev distill project|workflow` JSON commands | docs: add distill commands design doc |
| docs/plans/2026-02-27-distill-commands.md | Implementation plan for `distill-project`/`distill-workflow` (current code uses different distill shape) | chore: add distill commands implementation plan and clean up scratch files |
| docs/plans/2026-02-27-orchestration-restructure-design.md | Design: guides orchestrate, skills execute; introduces 4-phase brainstorm→breakdown→implement→summary model | refactor: orchestration restructure, code review fixes, and new skills |
| docs/plans/2026-02-27-tool-skills-installation-design.md | Design for `active-tools.json` + `specdev skills install/remove/sync` | refactor: simplify workflow guides and skills, add tool skills installation design |
| docs/plans/2026-02-27-tool-skills-installation.md | Implementation plan for tool-skill installer | refactor: orchestration restructure, code review fixes, and new skills |
| docs/plans/2026-02-28-fold-design-review-into-breakdown-design.md | Design: remove explicit "auto review" command, run review inside breakdown | docs: design doc for folding design review into breakdown phase |
| docs/plans/2026-02-28-fold-design-review-into-breakdown.md | Implementation plan for the above | docs: add implementation plan for design review fold |
| docs/plans/2026-02-28-implementation-speedup-design.md | Design: add `standard` task mode + batch execution | docs: design doc for implementation speedup (smart review + batch execution) |
| docs/plans/2026-02-28-implementation-speedup.md | Implementation plan for `standard` mode + batches | docs: fix stale review-per-task references and add implementation plan |
| docs/plans/2026-03-01-autoloop-design.md | Original "autoloop" external-reviewer design (later renamed to reviewloop) | feat: add autoloop automated external review loop |
| docs/plans/2026-03-01-autoloop.md | Original autoloop implementation plan | feat: add autoloop automated external review loop |
| docs/plans/2026-03-03-prd-brainstorm-design.md | Design adding PRD section structure to brainstorm | docs: add PRD brainstorm improvement design |
| docs/plans/2026-03-03-prd-brainstorm.md | Implementation plan for PRD brainstorm | docs: add PRD brainstorm implementation plan |
| docs/plans/2026-03-03-reviewloop-core-promotion-design.md | Design: promote reviewloop from `tools/` to `core/`, drop fireperp placeholders | docs: add reviewloop core promotion design |
| docs/plans/2026-03-03-reviewloop-core-promotion.md | Implementation plan for reviewloop core promotion | docs: add reviewloop core promotion implementation plan |
| docs/plans/2026-03-03-reviewloop-design.md | Design renaming autoloop → reviewloop + adding `specdev reviewloop` CLI | docs: add reviewloop rename design |
| docs/plans/2026-03-03-reviewloop.md | Implementation plan for rename + CLI command | docs: add reviewloop implementation plan |
| docs/plans/2026-03-04-reviewloop-node-command-design.md | Design: replace bash reviewloop with Node command, append-only review artifacts | fix: checkpoint shows reviewloop option, cleanup codex-with-context, add reviewloop design |
| docs/plans/2026-03-04-reviewloop-node-command.md | Implementation plan for Node reviewloop command | fix: checkpoint shows reviewloop option, cleanup codex-with-context, add reviewloop design |
| docs/plans/2026-03-11-cursor-reviewer-design.md | Design adding `cursor-agent` reviewer JSON config to reviewloop | chore: sync workspace updates |

## Claims & instructions

| Path | Claim/instruction (verbatim or paraphrased) | Where else this is asserted (if known) |
| --- | --- | --- |
| README.md | "SpecDev guides a single coding agent through a 3-phase workflow" (Brainstorm/Breakdown/Implement + optional knowledge capture) | `.specdev/_main.md` says **4 phases** (Brainstorm/Breakdown/Implement/Summary). `_guides/workflow.md`, `_index.md` echo 3-phase but mention summary/capture. |
| README.md | Lists `specdev distill workflow` / `specdev distill project` is NOT present; README only lists `specdev knowledge ...` commands | QUICKSTART.md still references `specdev distill workflow` and `specdev distill project` as if they were primary commands. Current `src/commands/distill.js` only accepts `--assignment=<name>` form. |
| README.md | Skills table includes `verification-before-completion` and `receiving-code-review` as Always-apply skills | `templates/.specdev/skills/core/` confirms; `_index.md` matches. |
| README.md | `specdev migrate` runs "Guided .specdev layout migration workflow" | `src/commands/migrate.js` exists; `_guides/migration_guide.md` exists. |
| CLAUDE.md | "Before committing any repo change, update `package.json` releaseDate to the current date." | Same paragraph repeated in AGENTS.md. |
| CLAUDE.md | 'IMPORTANT: Before starting any subtask, announce "Specdev: <what you\'re doing>".' | Same line repeated in AGENTS.md and in `.specdev/_main.md` Rules section. |
| CLAUDE.md | 'IMPORTANT: Always confirm with the user before running tests. Do not run `npm test` or any test command without explicit user approval.' | NOT mirrored in AGENTS.md (asymmetric) — also not present in `_main.md`/`_guides/`. |
| CLAUDE.md & AGENTS.md | "Read `.specdev/_main.md` for the full SpecDev workflow and rules." | Same line, both files; `.specdev/_main.md` is the canonical workflow entry. |
| AGENTS.md | Same Specdev-dev rules as CLAUDE.md minus the test-confirmation block | Duplicate content with CLAUDE.md (drift risk). |
| QUICKSTART.md | "The 4-Phase Workflow" (Brainstorm/Breakdown/Implement/Summary) and "Phase 4: Summary (automatic)" with `capture/project-notes-diff.md` and `capture/workflow-diff.md` | `.specdev/_main.md` describes 4 phases including Summary. README.md says 3 phases (contradiction). Current `templates/.specdev/skills/core/knowledge-capture/SKILL.md` (not deeply inspected here) handles capture. |
| QUICKSTART.md | "Every task goes through two automatic per-task reviews ... 1. Spec review ... 2. Code quality review" | Contradicts later "Implementation Speedup" design where `standard` mode (default) skips reviewer subagent. Current `_index.md` says implementing supports `standard/full/lightweight` task review modes. |
| QUICKSTART.md | "After multiple assignments are complete, you can aggregate learnings across them: `specdev distill workflow`, `specdev distill project`" | Current `src/commands/distill.js` signature is `specdev distill --assignment=<name>` (legacy) per `src/commands/help.js`; README omits distill entirely. |
| SETUP.md | "Update `author` field. Update repository URL in README.md. Update GitHub links in help command." | Pre-release setup checklist (v1.0.0 era language). No equivalent active doc. |
| SETUP.md | Templates structure shown: `templates/.specdev/router.md`, `generic_guides/`, `features/000_example_feature/` | None of these paths exist in current `templates/.specdev/` (now uses `_main.md`, `_guides/`, `assignments/`). |
| GITHUB_SETUP.md | "Repository name: specdev-cli" + commit message "Initial commit: SpecDev CLI v1.0.0" | Repo already published; package version is 0.0.4 — v1.0.0 wording is stale. |
| GITHUB_SETUP.md | Three install methods using `YOUR_USERNAME` placeholder | README.md uses literal `leiwu0227/specdev-cli`; placeholder text is one-time setup leftover. |
| setup-github.sh | `sed -i.bak "s/YOUR_USERNAME/$username/g" README.md` | README.md no longer contains `YOUR_USERNAME` — script would be a no-op. |
| setup-github.sh | Commits "Initial commit: SpecDev CLI v1.0.0" | Conflicts with actual package version 0.0.4 and existing git history. |
| CHANGELOG.md | Latest entry is `[0.0.4] - 2026-02-11`. Lists "8 modular skills (scaffolding-lite/full, systematic-debugging, requesting/receiving-code-review, parallel-worktrees, verification-before-completion, micro-task-planning)" | Current `templates/.specdev/skills/core/` set is brainstorming, breakdown, diagnosis, discussion, implementing, investigation, knowledge-capture, parallel-worktrees, receiving-code-review.md, review-agent, reviewloop, systematic-debugging, test-driven-development, verification-before-completion.md. "scaffolding-lite/full", "requesting-code-review", "micro-task-planning" no longer exist. |
| CHANGELOG.md | Entries reference `specdev ponder workflow`/`specdev ponder project` and `.specdev/_router.md` | Both removed in current code: only `specdev distill` remains (different shape) and router renamed to `_main.md`/`_index.md`. |
| CHANGELOG.md | "`_main.md` bumped to v0.0.3" | Current `_main.md` carries no version line. |
| docs/assignment-schema.md | "Validate an assignment folder against the schema: `node scripts/verify-assignment-schema.js .specdev/assignments/00001_feature_auth`" | `scripts/verify-assignment-schema.js` exists; CLI does not expose this. README.md does not mention this script — schema is consumed via `src/utils/assignment-schema.js` inside `specdev checkpoint`. |
| docs/assignment-schema.md | Lists required dirs `brainstorm`, `context`, and phases `brainstorm/breakdown/implementation/review` matching `specdev.assignment-schema.json` | Matches schema JSON. |
| docs/assignment-schema.md | "Change Policy": "update `specdev.assignment-schema.json` first → run `node scripts/verify-assignment-schema.js`" | Re-asserts script usage; not echoed in `_main.md`/`_guides/`. |
| learnings/plan-header-depth-h2-vs-h3.md | "`extract-tasks.sh` parses `^### Task [0-9]` (H3). `track-progress.sh` does the same when initializing `progress.json`." | Current `templates/.specdev/skills/core/implementing/` exists; status of `extract-tasks.sh` not re-validated here. Friction is from old executing skill or current implementing scripts. Knowledge currently not promoted into `.specdev/knowledge/`. |
| learnings/progress-json-init-bug.md | `src/commands/implement.js:32-35` writes empty `{}` to `progress.json` and races `track-progress.sh` | Current `src/commands/implement.js` exists; behavior not re-checked here. Same friction may apply. |
| learnings/silent-test-relaxation-caught-by-cross-doc-review.md | "Cross-check every test assertion change against the design's Success Criteria. Flag silent relaxations." (proposed addition to `implementing/SKILL.md`) | Not asserted in `_main.md`/`_guides/`; may already live in `templates/.specdev/skills/core/implementing/SKILL.md` (not verified here). |
| docs/plans/2026-02-11-review-agent-resilience-design.md | "specdev work mode=auto / specdev check mode=auto" + lifecycle | Commands have been removed; superseded by `specdev review`/`specdev reviewloop`. |
| docs/plans/2026-02-11-review-agent-resilience-plan.md | Lists task: "Delete `src/commands/review.js`" and rewrites to `work.js`/`check.js` | Current code has `review.js`, no `work.js`/`check.js`. |
| docs/plans/2026-02-12-executing-orientation-skills.md | Creates `templates/.specdev/skills/executing/` and `orientation/` | Neither directory exists in current `templates/.specdev/skills/core/` set. |
| docs/plans/2026-02-12-planning-skill-prototype.md | Creates `templates/.specdev/skills/planning/` and platform adapter dict in `init.js` | No `planning` skill exists; adapters now generated differently. |
| docs/plans/2026-02-12-specdev-v2-design.md | "Skills are folders. Scripts are tools. State lives in `.specdev/state/`." | Current `.specdev/` does not use `state/` — uses `assignments/`, `discussions/`, `knowledge/`, `project_notes/`. |
| docs/plans/2026-02-12-workflow-v3-design.md | "5 Phases, 2 Agents" with separate review-agent session | Superseded by v4 single-thread auto-review (also obsolete vs. current `specdev review`/`reviewloop`). |
| docs/plans/2026-02-12-workflow-v3-plan.md | "Delete `templates/.specdev/skills/planning/`, `verification/`, `spec-review/`, `code-review/`, `gate-coordination/`, `subagent-dispatch/`, `knowledge-capture-project/`, `knowledge-capture-specdev/`, `executing/`" | All listed skills already removed; plan is post-hoc / historical. |
| docs/plans/2026-02-13-skill-architecture-redesign-plan.md | Introduces `skills/core/` and `skills/tools/` directories | Current `templates/.specdev/skills/` follows this layout — implemented, doc is historical. |
| docs/plans/2026-02-14-architectural-hardening.md | "Fix command injection in check.js (execSync → execFileSync)" | `check.js` no longer exists; document is irrelevant to current code. |
| docs/plans/2026-02-14-context-drift-design.md | "Add `specdev remind` command" + adapter line "Using specdev: <action>" | `specdev remind` removed (CLAUDE.md uses "Specdev:" not "Using specdev:"). |
| docs/plans/2026-02-14-skill-installation-design.md | Five slash commands incl. `/specdev-remind`, `/specdev-rewind`, `/specdev-brainstorm`, `/specdev-continue` | Current skill commands list (per system reminders) includes `specdev-assignment`, `specdev-continue`, `specdev-review`, etc., not `specdev-remind` or `specdev-brainstorm`. |
| docs/plans/2026-02-17-workflow-v4-design.md | `specdev start/assignment/breakdown/implement/review` as the command set | Current CLI has these plus many additions (focus, discussion, checkpoint, approve, revise, check-review, reviewloop, distill, migrate, knowledge, memory, skills, etc.) — design is partially superseded. |
| docs/plans/2026-02-27-distill-commands-design.md | "specdev distill project [--assignment=<name>]" / "specdev distill workflow" JSON outputs | Current `distill.js` only has `--assignment=<name>` (single legacy form) per help text; `distill workflow` not a current subcommand. README.md omits `specdev distill`. |
| docs/plans/2026-03-01-autoloop-design.md, autoloop.md | Names skill `autoloop`, script `autoloop.sh`, env `$AUTOLOOP_*` | Renamed to reviewloop (2026-03-03 plan). Old names should not appear in current code, but `src/utils/update.js` still references the old `autoloop` path for cleanup. |
| docs/plans/2026-03-03-reviewloop-core-promotion-design.md | Move from `skills/tools/reviewloop/` to `skills/core/reviewloop/` | Current `templates/.specdev/skills/core/reviewloop/` exists; promotion completed. |

## References

| Path | References these (paths/commands/skills it points to) | Referenced by (paths that mention it) |
| --- | --- | --- |
| README.md | `.specdev/_main.md`, `.specdev/_index.md`, `.specdev/_guides/`, `.specdev/skills/`, `specdev init/update/migrate/skills/memory/knowledge/help/assignment/focus/discussion/checkpoint/approve/reviewloop/implement/revise/check-review/start/continue/next/status/review/context` | No other root doc references it directly. |
| CLAUDE.md | `.specdev/_main.md`, `src/`, `templates/.specdev/`, `package.json` releaseDate | `src/commands/init.js` writes CLAUDE.md as adapter (template content lives in code, not this file). |
| AGENTS.md | `.specdev/_main.md`, `src/`, `templates/.specdev/`, `package.json` releaseDate | `src/commands/init.js` writes AGENTS.md as adapter. |
| QUICKSTART.md | `specdev init/start/assignment/checkpoint/review/reviewloop/approve/revise/check-review/distill workflow/distill project/migrate`, `brainstorm/proposal.md`, `brainstorm/design.md`, `breakdown/plan.md`, `capture/project-notes-diff.md`, `capture/workflow-diff.md` | Not referenced from current code or `.specdev/`. |
| SETUP.md | `bin/specdev.js`, `src/commands/{init,help}.js`, `src/utils/copy.js`, `tests/verify-output.js`, `.github/workflows/{publish,test}.yml`, `templates/.specdev/{router.md, generic_guides/, project_notes/, templates/, features/000_example_feature/}` | Not referenced from current code or `.specdev/`. Most cited template paths no longer exist. |
| GITHUB_SETUP.md | GitHub web URLs, `npm install -g github:YOUR_USERNAME/specdev-cli` | Not referenced from current code or `.specdev/`. |
| CHANGELOG.md | `skills/subagent-driven-development.md`, `_router.md`, `specdev ponder workflow`, `specdev ponder project`, `_workflow_feedback/`, "scaffolding-lite/full", "micro-task-planning" | Not referenced from current code or `.specdev/`. |
| setup-github.sh | `README.md` (sed YOUR_USERNAME), git/GitHub | Not referenced from current code or `.specdev/`. |
| specdev.assignment-schema.json | (consumed at runtime) | `src/utils/assignment-schema.js`, `scripts/verify-assignment-schema.js`, `tests/test-assignment.js`, `docs/assignment-schema.md`, `package.json` `files` array. |
| docs/assignment-schema.md | `specdev.assignment-schema.json`, `scripts/verify-assignment-schema.js` | Not referenced from `src/`, `bin/`, `templates/.specdev/`, or `.specdev/_main.md`/`_index.md`/`_guides/`. |
| learnings/guide_feedback.md | (placeholder) | None. |
| learnings/plan-header-depth-h2-vs-h3.md | `templates/.specdev/skills/core/breakdown/SKILL.md`, `extract-tasks.sh`, `track-progress.sh` | None (knowledge not promoted into `.specdev/knowledge/`). |
| learnings/progress-json-init-bug.md | `src/commands/implement.js:32-35`, `templates/.specdev/skills/core/implementing/scripts/track-progress.sh` | None. |
| learnings/silent-test-relaxation-caught-by-cross-doc-review.md | `templates/.specdev/skills/core/implementing/SKILL.md`, reviewer prompt | None. |
| learnings/workflow_improvements.md | (placeholder) | None. |
| docs/plans/2026-02-11-review-agent-resilience-design.md | `src/commands/review.js`, `work.js`, `check.js`, `review_request.json`, `review_progress.json`, `review_report.md` | docs/plans/2026-02-11-review-agent-resilience-plan.md references this design. |
| docs/plans/2026-02-11-review-agent-resilience-plan.md | Same | Self-referential; not referenced by current code. |
| docs/plans/2026-02-12-executing-orientation-skills.md | `templates/.specdev/skills/{executing,orientation}/` | None. |
| docs/plans/2026-02-12-planning-skill-prototype.md | `templates/.specdev/skills/planning/`, `src/commands/{init,skills}.js`, references design doc `docs/plans/2026-02-12-specdev-v2-design.md` | Referenced by `docs/plans/2026-02-12-specdev-v2-design.md` (implicitly). |
| docs/plans/2026-02-12-specdev-v2-design.md | `.specdev/{state,skills,knowledge}/`, platform adapters | None in current code. |
| docs/plans/2026-02-12-workflow-v3-design.md | `assignments/<id>/brainstorm/`, planning/verification/spec-review/code-review/gate-coordination/subagent-dispatch skills | docs/plans/2026-02-12-workflow-v3-plan.md mirrors it. |
| docs/plans/2026-02-12-workflow-v3-plan.md | Long list of skill directories to delete; new skill `breakdown`, `implementing`, `review-agent` | None in current code. |
| docs/plans/2026-02-13-skill-architecture-redesign-plan.md | `templates/.specdev/skills/core/`, `tools/`, frontmatter spec | Design doc with same date in the file. |
| docs/plans/2026-02-13-skill-architecture-redesign.md | Same | Plan file. |
| docs/plans/2026-02-14-architectural-hardening.md | `src/commands/{work,check}.js`, `scripts/verify-gates.sh`, `src/utils/assignment.js` | None: `work.js`/`check.js`/`verify-gates.sh` not present. |
| docs/plans/2026-02-14-context-drift-design.md | `specdev remind`, `Using specdev:` prefix, hooks | None. |
| docs/plans/2026-02-14-skill-installation-design.md | `.claude/skills/`, `specdev-remind/rewind/brainstorm/continue` | docs/plans/2026-02-14-skill-installation-plan.md mirrors. |
| docs/plans/2026-02-14-skill-installation-plan.md | Same | None in current code. |
| docs/plans/2026-02-17-workflow-v4-design.md | `specdev start/assignment/breakdown/implement/review`, SessionStart hook | docs/plans/2026-02-17-workflow-v4-plan.md mirrors. |
| docs/plans/2026-02-17-workflow-v4-plan.md | Same | None in current code (commands evolved further). |
| docs/plans/2026-02-27-distill-commands-design.md | `specdev distill project/workflow`, capture diffs | docs/plans/2026-02-27-distill-commands.md mirrors. QUICKSTART.md still cites these commands. |
| docs/plans/2026-02-27-distill-commands.md | Same | Not referenced by current code (distill shape differs). |
| docs/plans/2026-02-27-orchestration-restructure-design.md | `_main.md`, `_router.md`, skills, gates | None directly. Concepts later realized in current `_main.md`/`_index.md`. |
| docs/plans/2026-02-27-tool-skills-installation-design.md | `.specdev/skills/active-tools.json`, `specdev skills install/remove/sync` | docs/plans/2026-02-27-tool-skills-installation.md mirrors; `specdev skills install/remove/sync` are still current commands. |
| docs/plans/2026-02-27-tool-skills-installation.md | Same | Not directly referenced. |
| docs/plans/2026-02-28-fold-design-review-into-breakdown-design.md | `brainstorming/SKILL.md`, `breakdown/SKILL.md` | docs/plans/2026-02-28-fold-design-review-into-breakdown.md mirrors. |
| docs/plans/2026-02-28-fold-design-review-into-breakdown.md | Same | None in current code (implemented). |
| docs/plans/2026-02-28-implementation-speedup-design.md | `breakdown/SKILL.md`, `implementing/SKILL.md` | docs/plans/2026-02-28-implementation-speedup.md mirrors. |
| docs/plans/2026-02-28-implementation-speedup.md | Same | None in current code (implemented). |
| docs/plans/2026-03-01-autoloop-design.md, autoloop.md | `skills/tools/autoloop/`, `$AUTOLOOP_*` | `src/utils/update.js` references the old path for cleanup. |
| docs/plans/2026-03-03-prd-brainstorm-design.md, prd-brainstorm.md | `brainstorming/SKILL.md`, `_templates/brainstorm-design.md` | None in current code (implemented). |
| docs/plans/2026-03-03-reviewloop-core-promotion-design.md, reviewloop-core-promotion.md | `skills/core/reviewloop/`, `src/commands/reviewloop.js` | `src/commands/reviewloop.js` exists; `templates/.specdev/skills/core/reviewloop/` exists. |
| docs/plans/2026-03-03-reviewloop-design.md, reviewloop.md | `skills/tools/reviewloop/`, `$REVIEWLOOP_*` | Rename completed; tool path later promoted to core. |
| docs/plans/2026-03-04-reviewloop-node-command-design.md, reviewloop-node-command.md | `src/commands/reviewloop.js`, `review-feedback.md`, `changelog.md` | Current `src/commands/reviewloop.js` matches design. |
| docs/plans/2026-03-11-cursor-reviewer-design.md | `templates/.specdev/skills/core/reviewloop/reviewers/cursor.json` | Reviewer JSON config presumably exists; not verified here. |

## Within-area findings

| Path | Type | Severity | Note | Suggested action |
| --- | --- | --- | --- | --- |
| AGENTS.md | duplication | high | Near-verbatim duplicate of CLAUDE.md minus the test-confirmation block. Asymmetric content (test-confirmation rule missing) is a drift hazard for Codex sessions. | Pick a single source (e.g., adapter content generated by `init.js`) and have both adapters read identical rules, or add the test-confirmation IMPORTANT block to AGENTS.md. Consider generating both from one template. |
| README.md vs QUICKSTART.md | contradiction | high | README states "3-phase workflow" (Brainstorm/Breakdown/Implement) with optional knowledge capture; QUICKSTART describes "4-Phase Workflow" with explicit "Phase 4: Summary (automatic)" + `capture/*-diff.md` files. `.specdev/_main.md` says 4 phases. | Reconcile both to a single phase count and capture-flow story. Prefer aligning with `_main.md` since that's the live workflow. |
| README.md vs QUICKSTART.md | contradiction | high | README lists `specdev knowledge index/search/list` and never mentions `specdev distill`; QUICKSTART promotes `specdev distill workflow` / `specdev distill project` as primary aggregation commands. Current `src/commands/distill.js` (per `help.js`) only exposes legacy `specdev distill --assignment=<name>` / `specdev distill done <name>`. | Remove/update the `distill workflow` / `distill project` references in QUICKSTART, or update the CLI/help to match. |
| README.md vs implementation-speedup design + `_index.md` | contradiction | med | README mentions task review modes only briefly ("lightweight/standard/full"); QUICKSTART asserts "two automatic per-task reviews" on every task. After the 2026-02-28 speedup change, `standard` (the default) skips the reviewer subagent. | Soften QUICKSTART's "every task goes through two automatic per-task reviews" to reflect mode-dependent behavior. |
| SETUP.md | legacy | high | v1.0.0-era publish guide; mentions `@specdev/cli` npm publish, "Update author/repository URL", tests via `npm test`. Template structure listed (`router.md`, `generic_guides/`, `features/000_example_feature/`) no longer exists. Not referenced anywhere. | Delete, or replace with a short maintainers' release-process note that reflects current `package.json` (0.0.4, GitHub-install, releaseDate). |
| GITHUB_SETUP.md | legacy | high | v1.0.0-era GitHub-publish guide. Uses `YOUR_USERNAME` placeholder and "Initial commit: SpecDev CLI v1.0.0". README already hard-codes `leiwu0227/specdev-cli`. Not referenced anywhere. | Delete. |
| setup-github.sh | legacy | high | Companion to GITHUB_SETUP.md. `sed -i.bak "s/YOUR_USERNAME/$username/g" README.md` is a no-op (placeholder no longer present). Commits "Initial commit: SpecDev CLI v1.0.0". Not referenced anywhere. | Delete. |
| CHANGELOG.md | drift | high | Frozen at `[0.0.4] - 2026-02-11` while `package.json` is also `0.0.4` but `releaseDate` is `2026-05-12`. Entries reference removed entities (`_router.md`, `specdev ponder`, scaffolding-lite/full, micro-task-planning, requesting-code-review, subagent-driven-development skill). | Either delete (project doesn't track via CHANGELOG anymore — releaseDate is the user-visible build date per CLAUDE.md), or refresh entries to reflect current skill set and post-0.0.4 changes. |
| docs/assignment-schema.md | drift | med | Asserts `node scripts/verify-assignment-schema.js <path>` as the validation entry point. The script exists, but the workflow now validates via `specdev checkpoint` / `src/utils/assignment-schema.js`. `_main.md`/`_guides/` don't reference the script. | Update text to reference `specdev checkpoint <phase>` as the primary validator, with the script noted as low-level utility. |
| learnings/guide_feedback.md | legacy | low | Empty placeholder ("Specific feedback on individual guides ..." + HTML comment). Not referenced. Predates current knowledge aggregation. | Delete (or promote any useful content to `.specdev/knowledge/_workflow_feedback/`). |
| learnings/workflow_improvements.md | legacy | low | Empty placeholder. Not referenced. | Delete. |
| learnings/plan-header-depth-h2-vs-h3.md | drift | med | Substantial friction note about `extract-tasks.sh`/`track-progress.sh` H3 parsing. References live skill `templates/.specdev/skills/core/breakdown/SKILL.md` but lives outside `.specdev/knowledge/`. Audit threshold: NOT actively referenced from current workflow files. | Move into `.specdev/knowledge/workflow/` (or `.specdev/knowledge/_workflow_feedback/`) so the workflow can surface it via `specdev knowledge search`. |
| learnings/progress-json-init-bug.md | drift | med | Active-looking bug report citing `src/commands/implement.js:32-35`. Outside `.specdev/knowledge/`, so workflow doesn't see it. | Move into `.specdev/knowledge/workflow/` and confirm/close against current `implement.js`. |
| learnings/silent-test-relaxation-caught-by-cross-doc-review.md | drift | med | Anti-pattern note proposing changes to `implementing/SKILL.md` and reviewer prompt. Outside `.specdev/knowledge/`. | Move into `.specdev/knowledge/workflow/`; verify whether the proposed rule was added to the implementing/review skill. |
| `learnings/` (folder) | duplication | med | Parallel knowledge silo competing with `.specdev/knowledge/`. README/CLAUDE/AGENTS/_main.md never mention `learnings/`. | After per-file migration above, remove the top-level `learnings/` directory. |
| docs/plans/ (entire folder, 35 files) | legacy | high | All files predate the current 3/4-phase workflow's stabilization. Most describe commands that no longer exist (`work`, `check`, `ponder`, `remind`, `executing`, `orientation`, `planning`, `autoloop`, scaffolding skills) or design states already superseded. Nothing under `src/`, `bin/`, `templates/.specdev/`, `.specdev/_main.md`, `_index.md`, `_guides/` references any file in `docs/plans/`. | Archive whole-sale to `.specdev/knowledge/_archive/plans/` (or delete). Current design history is captured per-assignment under `.specdev/assignments/`. |
| docs/plans/2026-02-11-review-agent-resilience-{design,plan}.md | legacy | high | Designs `specdev work`/`specdev check` (removed). | Archive/delete. |
| docs/plans/2026-02-12-executing-orientation-skills.md | legacy | high | Creates `executing`/`orientation` skills (removed). | Archive/delete. |
| docs/plans/2026-02-12-planning-skill-prototype.md | legacy | high | Creates `planning` skill (removed). | Archive/delete. |
| docs/plans/2026-02-12-specdev-v2-design.md | legacy | high | "v2" design with `state/` layout never adopted. | Archive/delete. |
| docs/plans/2026-02-12-workflow-v3-{design,plan}.md | legacy | high | v3 5-phase 2-agent model superseded by v4 and beyond. | Archive/delete. |
| docs/plans/2026-02-13-skill-architecture-redesign{,-plan}.md | legacy | med | Core/tools split was implemented — design is historical. | Archive (could be useful context for new contributors). |
| docs/plans/2026-02-14-architectural-hardening.md | legacy | high | Hardens files that no longer exist (`work.js`, `check.js`, `verify-gates.sh`). | Archive/delete. |
| docs/plans/2026-02-14-context-drift-design.md | legacy | high | Designs `specdev remind` (removed). "Using specdev:" prefix superseded by "Specdev:". | Archive/delete. |
| docs/plans/2026-02-14-skill-installation-{design,plan}.md | legacy | high | Five-slash-command set (`specdev-remind`, `specdev-brainstorm`, etc.) does not match current skill commands (`specdev-assignment`, `specdev-continue`, `specdev-review`, etc.). | Archive/delete. |
| docs/plans/2026-02-17-workflow-v4-{design,plan}.md | legacy | med | Command set partially superseded by current orchestration (focus/discussion/checkpoint/approve/revise/check-review/distill/migrate added later). | Archive. |
| docs/plans/2026-02-27-distill-commands-{design,}.md | drift | med | Designs `specdev distill project/workflow` JSON forms that QUICKSTART still cites; current CLI only has legacy `specdev distill --assignment` and `specdev distill done`. | Either implement the design or remove both this plan pair and the QUICKSTART references. |
| docs/plans/2026-02-27-orchestration-restructure-design.md | legacy | med | Conceptual foundation of current `_main.md`/`_index.md`. Implementation completed. | Archive. |
| docs/plans/2026-02-27-tool-skills-installation-{design,}.md | legacy | low | `specdev skills install/remove/sync` are current; doc is historical. | Archive. |
| docs/plans/2026-02-28-fold-design-review-into-breakdown-{design,}.md | legacy | low | Implemented. | Archive. |
| docs/plans/2026-02-28-implementation-speedup-{design,}.md | legacy | low | Implemented. | Archive. |
| docs/plans/2026-03-01-autoloop-{design,}.md | legacy | med | Skill renamed to reviewloop; `autoloop` no longer a name. | Archive. |
| docs/plans/2026-03-03-prd-brainstorm-{design,}.md | legacy | low | Implemented. | Archive. |
| docs/plans/2026-03-03-reviewloop-core-promotion-{design,}.md | legacy | low | Implemented. | Archive. |
| docs/plans/2026-03-03-reviewloop-{design,}.md | legacy | low | Implemented (rename + CLI command). | Archive. |
| docs/plans/2026-03-04-reviewloop-node-command-{design,}.md | legacy | low | Implemented. | Archive. |
| docs/plans/2026-03-11-cursor-reviewer-design.md | legacy | low | Cursor reviewer JSON added; design no longer load-bearing. | Archive. |
| `docs/plans/` parent | duplication | med | Per-design plans here duplicate the artifacts produced inside `.specdev/assignments/`. New per-feature design/plan files should live with their assignment. | Stop using top-level `docs/plans/` going forward; rely on `.specdev/assignments/<id>/brainstorm/design.md` + `breakdown/plan.md`. |
| `docs/` (parent) | drift | low | Only contains `assignment-schema.md` plus the legacy `plans/` subtree. After plans are removed, the directory's purpose collapses to a single file that could live in repo root or under `.specdev/knowledge/workflow/`. | Consolidate `docs/assignment-schema.md` into `.specdev/knowledge/workflow/` (or keep `docs/` but trim heavily). |
| README.md | drift | low | "Optional Phase-End Knowledge Capture" section instructs agents to run `specdev knowledge search` and ask the user before updating `knowledge/`; doesn't mention the `summary`/`capture` artifacts QUICKSTART describes. | Reconcile knowledge-capture description with QUICKSTART once the phase count question is resolved. |
| CLAUDE.md vs AGENTS.md | inconsistency | med | CLAUDE.md has the IMPORTANT "Always confirm with the user before running tests" rule; AGENTS.md does not. Either both adapter audiences need the rule, or neither does. | Add the rule to AGENTS.md, or remove from CLAUDE.md, depending on intent. |
| README.md `specdev knowledge` block | inconsistency | low | README lists `specdev knowledge index/search/list`; `.specdev/_index.md` and `_main.md` mention `specdev knowledge search` only in passing — no acknowledgment of `index/list` subcommands. | Cross-check `src/commands/knowledge.js` against both docs and align. |
| specdev.assignment-schema.json | drift | low | Filename is the only spec file at repo root. Referenced via `package.json` `files` so it ships in the package — but README never mentions its existence. | Consider moving alongside `src/utils/assignment-schema.js` or under `templates/.specdev/` so the surface area at repo root shrinks. (Path change requires touching `package.json` and consumers.) |
| QUICKSTART.md | drift | med | Section "Lost? Check your status" tells users to run `specdev continue` — matches current CLI. But the page hardcodes a Phase 1–4 list and never references `.specdev/_main.md` as the canonical entry point. | Add a one-liner "for the canonical workflow see `.specdev/_main.md`" so QUICKSTART can stay terse and the canonical doc owns the rules. |
