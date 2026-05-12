# Inventory: Source code

## Files
| Path | Purpose (one line) | Last meaningfully touched (commit subject) |
| --- | --- | --- |
| bin/specdev.js | CLI entrypoint; parses argv and dispatches to command handlers. | feat: new commands, review refactor, continue overhaul, and code cleanup |
| hooks/session-start.sh | Claude Code SessionStart hook; emits phase-aware additionalContext using `specdev context --json` or filesystem fallback. | fix: detect hook implementation phase from artifacts |
| scripts/verify-assignment-schema.js | Deterministic schema check against specdev.assignment-schema.json for an assignment directory. | feat: add legacy assignment migration command and tighten v4 workflow checks |
| scripts/verify-gates.sh | Mechanical bash gate checks (planning, architecture, implementation evidence, review_request.json). | feat: add legacy assignment migration command and tighten v4 workflow checks |
| src/commands/agents-inspect.js | `specdev agents inspect <path>` — validates and prints an agent spec. | Add agent inspect command |
| src/commands/approve.js | `specdev approve <phase>` — hard gate writer (brainstorm/implementation). | refactor: thin workflow runtime guidance |
| src/commands/assignment.js | `specdev assignment <desc>` — reserve assignment ID, optionally create folder. | Centralize workflow contract facts |
| src/commands/check-review.js | `specdev check-review [phase]` — read latest review feedback round and report next step. | refactor: thin workflow runtime guidance |
| src/commands/checkpoint.js | `specdev checkpoint <phase>` — phase artifact validation (brainstorm/implementation/discussion). | feat: add workflow runtime overlay |
| src/commands/context.js | `specdev context` — dump assignment, knowledge, project_notes, skills, history (human/JSON). | fix: align workflow guidance after review |
| src/commands/continue.js | `specdev continue` — diagnose current state and emit next-action payload (also used by status). | refactor: thin workflow runtime guidance |
| src/commands/discussion.js | `specdev discussion <desc>` — create or list parallel discussion folders. | refactor: rename specdev discuss to specdev discussion |
| src/commands/dispatch.js | Command dispatcher; maps command names to handlers (incl. distill, migrate, agents subroutes). | feat: add workflow runtime overlay |
| src/commands/distill-done.js | `specdev distill done <name>` — legacy marker for old capture distillation flow. | feat: add memory refresh distill hint |
| src/commands/distill.js | `specdev distill --assignment=<name>` — legacy capture-diff aggregation/heuristics. | fix: standardize workflow_feedback naming (drop underscore prefix) |
| src/commands/focus.js | `specdev focus <id>` — set/clear .specdev/.current pointer. | feat: add --json to approve, focus, revise, help, skills-remove, migrate |
| src/commands/help.js | `specdev help` — prints command list and workflow tips. | refactor: thin workflow runtime guidance |
| src/commands/implement.js | `specdev implement` — scaffold implementation dir and print task-loop instructions. | refactor: thin workflow runtime guidance |
| src/commands/init.js | `specdev init` — copy templates, install adapters, command skills, SessionStart hook, tool skills. | refactor: thin workflow runtime guidance |
| src/commands/knowledge.js | `specdev knowledge index|search|list` — SQLite FTS over markdown corpus. | chore: capture current specdev workflow updates |
| src/commands/memory.js | `specdev memory refresh` — regenerate bounded `project_notes/working_memory.md`. | feat: generate bounded working memory |
| src/commands/migrate-legacy-assignments.js | `specdev migrate legacy-assignments` — deterministic V3-to-V4 file mover. | feat: add --json to implement, migrate-legacy, review, skills-install, skills-sync, update |
| src/commands/migrate.js | `specdev migrate` — print guided layout migration instructions. | feat: add --json to approve, focus, revise, help, skills-remove, migrate |
| src/commands/next.js | `specdev next` — emit canonical next workflow action (computeNextAction). | feat: add workflow runtime overlay |
| src/commands/research.js | `specdev research <topic>` — spawn researcher agent and write `context/research-*.md`. | Add research command and host detection |
| src/commands/review.js | `specdev review <phase>` — print phase-aware manual review instructions. | Centralize workflow contract facts |
| src/commands/reviewloop.js | `specdev reviewloop <phase>` — spawn external reviewer CLI, parse verdict, auto-approve on pass. | refactor: thin workflow runtime guidance |
| src/commands/revise.js | `specdev revise` — bump brainstorm revision counter and re-enter brainstorm. | feat: add --json to approve, focus, revise, help, skills-remove, migrate |
| src/commands/skills-install.js | `specdev skills install` — install tool-skill wrappers into agent skill dirs. | fix: address round 2 review — dry-run JSON, skill contract alignment |
| src/commands/skills-remove.js | `specdev skills remove <name>` — remove an installed tool skill and its wrappers. | feat: add --json to approve, focus, revise, help, skills-remove, migrate |
| src/commands/skills-sync.js | `specdev skills sync` — reconcile active-tools.json with skills/tools and regenerate wrappers. | fix: address round 2 review — dry-run JSON, skill contract alignment |
| src/commands/skills.js | `specdev skills` (list/view/install/remove/sync) — top-level skills command, owns `view` subcommand inline. | feat: add guarded skills view |
| src/commands/start.js | `specdev start` — print/inspect `project_notes/big_picture.md` status. | feat: new commands, review refactor, continue overhaul, and code cleanup |
| src/commands/status.js | `specdev status` — thin wrapper that calls continueCommand with statusPayload flag. | feat: add workflow status json command |
| src/commands/update.js | `specdev update` — refresh system files, skills, hooks, adapters; sync tool skills. | feat: add workflow runtime overlay |
| src/utils/active-tools.js | Read/write `.specdev/skills/active-tools.json` (tools + agents); exposes addTool/removeTool. | refactor: orchestration restructure, code review fixes, and new skills |
| src/utils/agent-runner.js | Load agent specs, render prompts, spawn agent process, validate artifact JSON output. | Fix agent runner timeout validation |
| src/utils/agents.js | AGENT_CONFIGS map and detectCodingAgents (.claude/.codex/.opencode markers). | refactor: unbundle fireperp, fix skill wrappers, and auto-install tool skills |
| src/utils/approve-phase.js | approvePhase: artifact validation + write status.json gate fields. | Centralize workflow contract facts |
| src/utils/assignment-schema.js | Loads specdev.assignment-schema.json; exports ASSIGNMENT_SCHEMA and ASSIGNMENT_PHASES. | feat: add legacy assignment migration command and tighten v4 workflow checks |
| src/utils/assignment.js | parseAssignmentId, resolveAssignmentSelector, resolveAssignmentPath, assignmentName. | feat: replace heuristic assignment detection with .current pointer and discussions |
| src/utils/cli.js | parseArgv — argv -> {command, flags, positionalArgs}. | feat: new commands, review refactor, continue overhaul, and code cleanup |
| src/utils/command-context.js | resolveTargetDir/SpecdevPath, requireSpecdevDirectory, ensureProgressJson. | feat: new commands, review refactor, continue overhaul, and code cleanup |
| src/utils/commands.js | COMMANDS metadata array + formatCommandLine for help/context output. | refactor: thin workflow runtime guidance |
| src/utils/current.js | Read/write/clear `.specdev/.current`; resolveCurrentAssignment with stale handling. | feat: replace heuristic assignment detection with .current pointer and discussions |
| src/utils/discussion.js | parseDiscussionId, resolveDiscussionSelector, getNextDiscussionId. | feat: change discussion IDs from 4-digit to 5-digit (D00001) |
| src/utils/host-detection.js | detectHostAgent — pick claude/codex/cursor from flags/env markers. | Add research command and host detection |
| src/utils/knowledge.js | SQLite FTS index builder/searcher and markdown document collector. | Fix knowledge search hyphenated queries |
| src/utils/output.js | Small console-output helpers (blankLine, printSection, printLines, printBullets, printKeyValue, printListSection). | feat: new commands, review refactor, continue overhaul, and code cleanup |
| src/utils/project-context.js | readBigPictureStatus — detect filled-vs-template big_picture.md. | feat: new commands, review refactor, continue overhaul, and code cleanup |
| src/utils/prompt.js | Interactive readline helpers (ask, askChoice, askYesNo, askMultiLine, presentSuggestion, askCustomObservation). | feat: new commands, review refactor, continue overhaul, and code cleanup |
| src/utils/review-feedback.js | parseReviewFeedback, getLatestRound, hasUnaddressedFindings — append-only review markdown parser. | feat: add shared review-feedback parser utility |
| src/utils/review-focus.js | resolveRoundFocus — pick per-round focus string from review-focus.json. | feat: add round-specific review focus areas and increase max_rounds to 5 |
| src/utils/reviewer-preflight.js | Reviewer config name validation, binary-on-PATH check, review-dir writability. | feat: improve reviewloop diagnostics and salvage |
| src/utils/reviewer-runner.js | runReviewerProcess — spawn bash -c "<command>" with timeout, heartbeats, stdout capture. | fix: handle later-round reviewloop stdout salvage |
| src/utils/reviewer-stream-json.js | createReviewerStreamJsonTranslator — render Claude `--output-format stream-json` to human text. | feat: render claude stream json progress |
| src/utils/reviewers.js | checkReviewerCLIs + printReviewerCheck — readiness check used by init/update. | fix: simplify reviewloop, add specdev implement command, fix relative paths |
| src/utils/scan.js | scanAssignments/scanSingleAssignment, readKnowledgeBranch, processed-captures tracking. | feat: replace heuristic assignment detection with .current pointer and discussions |
| src/utils/skills.js | parseFrontmatter + scanSkillsDir — read SKILL.md frontmatter from core/tool skill dirs. | feat: add skills json output |
| src/utils/state.js | detectAssignmentState, readGateStatus, readRevisionNumber, progress/legacy-root detection. | refactor: thin workflow runtime guidance |
| src/utils/update.js | updateSpecdevSystem, isValidSpecdevInstallation, updateSkillFiles, updateHookScript, backfillAdapters. | feat: add workflow runtime overlay |
| src/utils/workflow-contract.js | Canonical workflow constants (ASSIGNMENT_TYPES, commandPhases, REQUIRED_BRAINSTORM_SECTIONS, artifactPaths, gateFields, helpers). | refactor: thin workflow runtime guidance |
| src/utils/workflow-runtime.js | DEFAULT_WORKFLOW, loadWorkflowDefinition, validateWorkflowDefinition, buildReviewChoices, computeNextAction. | refactor: thin workflow runtime guidance |
| src/utils/working-memory.js | buildWorkingMemory — bounded synthesis for project_notes/working_memory.md. | fix: standardize workflow_feedback naming (drop underscore prefix) |
| src/utils/wrappers.js | generateWrapperContent, writeWrappers, removeWrappers for tool-skill wrappers in agent dirs. | refactor: unbundle fireperp, fix skill wrappers, and auto-install tool skills |

## References
| Path | References these (paths/commands/skills it points to) | Referenced by (paths that mention it) |
| --- | --- | --- |
| bin/specdev.js | src/utils/cli.js, src/commands/dispatch.js | package.json (bin entry) |
| hooks/session-start.sh | `specdev context --json`, `.specdev/skills/tools/*/SKILL.md`, `.specdev/_main.md` | src/commands/init.js, src/utils/update.js (copies as .claude/hooks/specdev-session-start.sh) |
| scripts/verify-assignment-schema.js | specdev.assignment-schema.json | tests/test-assignment.js |
| scripts/verify-gates.sh | breakdown/plan.md, implementation/progress.json, tasks/*/result.md, review_request.json, brainstorm artifacts | templates/.specdev/_templates/review_report_template.md (paste output here); no test or src caller |
| src/commands/agents-inspect.js | src/utils/agent-runner.js (loadAgentSpec), src/utils/command-context.js | src/commands/dispatch.js |
| src/commands/approve.js | src/utils/assignment.js, src/utils/approve-phase.js, src/utils/workflow-contract.js | src/commands/dispatch.js, src/commands/reviewloop.js |
| src/commands/assignment.js | src/utils/{command-context,project-context,current,discussion,workflow-contract,prompt}.js, src/commands/continue.js | src/commands/dispatch.js |
| src/commands/check-review.js | src/utils/{assignment,review-feedback,scan,state,workflow-contract}.js | src/commands/dispatch.js |
| src/commands/checkpoint.js | src/utils/{assignment,discussion,command-context,active-tools,workflow-contract,workflow-runtime}.js | src/commands/dispatch.js |
| src/commands/context.js | src/utils/{command-context,current,scan,state,commands,skills,knowledge}.js | src/commands/dispatch.js |
| src/commands/continue.js | src/utils/{assignment,command-context,scan,state,project-context,review-feedback,current,workflow-contract}.js | src/commands/dispatch.js, src/commands/status.js, src/commands/assignment.js |
| src/commands/discussion.js | src/utils/{command-context,discussion,project-context}.js | src/commands/dispatch.js |
| src/commands/dispatch.js | every src/commands/*.js handler | bin/specdev.js |
| src/commands/distill-done.js | src/utils/scan.js, src/utils/command-context.js | src/commands/dispatch.js |
| src/commands/distill.js | src/utils/scan.js, src/utils/command-context.js | src/commands/dispatch.js, src/commands/continue.js (suggests it) |
| src/commands/focus.js | src/utils/{command-context,assignment,current,scan}.js | src/commands/dispatch.js |
| src/commands/help.js | src/utils/output.js, src/utils/commands.js | src/commands/dispatch.js |
| src/commands/implement.js | src/utils/{assignment,command-context,output}.js; references `.specdev/skills/core/implementing/scripts/{extract,prepare,complete,track}-task.sh` and prompts/{implementer,code-reviewer}.md | src/commands/dispatch.js |
| src/commands/init.js | templates/.specdev, hooks/session-start.sh, src/utils/{skills,reviewers,workflow-contract}.js, src/commands/skills-install.js | src/commands/update.js (imports SKILL_FILES, ALL_ADAPTERS, COMMAND_SKILL_DIRS, adapterContent), src/commands/dispatch.js |
| src/commands/knowledge.js | src/utils/{command-context,knowledge}.js | src/commands/dispatch.js |
| src/commands/memory.js | src/utils/{command-context,working-memory}.js | src/commands/dispatch.js |
| src/commands/migrate-legacy-assignments.js | src/utils/{command-context,output}.js | src/commands/dispatch.js |
| src/commands/migrate.js | src/utils/{command-context,output}.js; `.specdev/_guides/migration_guide.md` | src/commands/dispatch.js |
| src/commands/next.js | src/utils/{command-context,workflow-runtime,output}.js | src/commands/dispatch.js |
| src/commands/research.js | src/utils/{command-context,current,host-detection,agent-runner,workflow-contract}.js | src/commands/dispatch.js |
| src/commands/review.js | src/utils/{assignment,discussion,command-context,review-feedback,workflow-contract,output}.js | src/commands/dispatch.js |
| src/commands/reviewloop.js | src/utils/{assignment,discussion,command-context,current,review-feedback,approve-phase,review-focus,reviewer-preflight,reviewer-runner,reviewer-stream-json,workflow-contract,output}.js | src/commands/dispatch.js |
| src/commands/revise.js | src/utils/{assignment,state,output}.js | src/commands/dispatch.js |
| src/commands/skills-install.js | src/utils/{command-context,skills,active-tools,agents,wrappers,output}.js | src/commands/init.js (auto-install), src/commands/skills.js (dynamic import), src/commands/dispatch.js |
| src/commands/skills-remove.js | src/utils/{command-context,active-tools,wrappers}.js | src/commands/skills.js, src/commands/dispatch.js |
| src/commands/skills-sync.js | src/utils/{command-context,skills,active-tools,wrappers,output}.js | src/commands/update.js, src/commands/skills.js, src/commands/dispatch.js |
| src/commands/skills.js | src/utils/{command-context,skills,active-tools}.js; src/commands/skills-install.js, src/commands/skills-remove.js, src/commands/skills-sync.js (dynamic imports) | src/commands/dispatch.js |
| src/commands/start.js | src/utils/{command-context,output,project-context}.js | src/commands/dispatch.js |
| src/commands/status.js | src/commands/continue.js | src/commands/dispatch.js |
| src/commands/update.js | src/commands/init.js (re-exports), src/utils/{update,reviewers,output,command-context}.js, hooks/session-start.sh | src/commands/dispatch.js |
| src/utils/active-tools.js | `.specdev/skills/active-tools.json` | skills-install.js, skills-remove.js, skills-sync.js, skills.js, checkpoint.js |
| src/utils/agent-runner.js | templates/.specdev/_templates/agent-spec.schema.json | research.js, agents-inspect.js |
| src/utils/agents.js | filesystem markers (.claude, .codex, .opencode) | skills-install.js, wrappers.js |
| src/utils/approve-phase.js | src/utils/workflow-contract.js | approve.js, reviewloop.js |
| src/utils/assignment-schema.js | specdev.assignment-schema.json | scan.js |
| src/utils/assignment.js | src/utils/{current,command-context}.js | continue.js, focus.js, checkpoint.js, approve.js, check-review.js, review.js, reviewloop.js, revise.js, implement.js |
| src/utils/cli.js | (none) | bin/specdev.js |
| src/utils/command-context.js | fs-extra | nearly every command file |
| src/utils/commands.js | (none) | help.js, context.js |
| src/utils/current.js | `.specdev/.current` | assignment.js, focus.js, continue.js, context.js, research.js, working-memory.js, reviewloop.js, workflow-runtime.js |
| src/utils/discussion.js | `.specdev/discussions/` | assignment.js, checkpoint.js, review.js, reviewloop.js, discussion.js |
| src/utils/host-detection.js | env vars (CLAUDECODE, CODEX_HOME, CURSOR_*) | research.js |
| src/utils/knowledge.js | node:sqlite, `.specdev/cache/knowledge.sqlite` | knowledge.js, context.js |
| src/utils/output.js | (none) | many command files |
| src/utils/project-context.js | `.specdev/project_notes/big_picture.md` | start.js, assignment.js, discussion.js, continue.js |
| src/utils/prompt.js | node:readline | assignment.js (askChoice) |
| src/utils/review-feedback.js | (none) | review.js, check-review.js, reviewloop.js, continue.js |
| src/utils/review-focus.js | `.specdev/skills/core/reviewloop/review-focus.json` | reviewloop.js |
| src/utils/reviewer-preflight.js | `.specdev/skills/core/reviewloop/reviewers/*.json` | reviewloop.js |
| src/utils/reviewer-runner.js | child_process | reviewloop.js |
| src/utils/reviewer-stream-json.js | (none) | reviewloop.js |
| src/utils/reviewers.js | `.specdev/skills/core/reviewloop/reviewers/*.json` | init.js, update.js |
| src/utils/scan.js | src/utils/{assignment,assignment-schema}.js | continue.js, distill.js, distill-done.js, context.js, focus.js, working-memory.js, check-review.js, workflow-runtime.js |
| src/utils/skills.js | filesystem (skills/core, skills/tools) | skills.js, skills-install.js, skills-sync.js, init.js, context.js |
| src/utils/state.js | src/utils/workflow-contract.js | continue.js, check-review.js, context.js, working-memory.js, workflow-runtime.js, revise.js |
| src/utils/update.js | src/utils/* (none) | update.js (command) |
| src/utils/workflow-contract.js | (none) | assignment.js, approve.js, approve-phase.js, check-review.js, checkpoint.js, continue.js, init.js, research.js, review.js, reviewloop.js, state.js, workflow-runtime.js |
| src/utils/workflow-runtime.js | src/utils/{current,scan,state,workflow-contract}.js, `.specdev/workflow.yaml` | next.js, checkpoint.js |
| src/utils/working-memory.js | src/utils/{scan,state,current}.js | memory.js |
| src/utils/wrappers.js | src/utils/agents.js | skills-install.js, skills-sync.js, skills-remove.js |

## Within-area findings
| Path | Type | Severity | Note | Suggested action |
| --- | --- | --- | --- | --- |
| src/commands/distill.js | legacy | med | Help text and `commands.js` explicitly mark `distill` as "Legacy helper". No test coverage. Only `continue.js` references it as a hint when capture diffs exist; in active assignments capture/ is no longer produced by the workflow. | Confirm with maintainers that legacy distill flow is still supported; otherwise remove command, entries in `commands.js` and dispatcher branch in `dispatch.js`, and the suggestion block in `continue.js`. |
| src/commands/distill-done.js | legacy | med | Companion to distill; same status. Validates feature_descriptions.md presence, which is not part of current workflow. | Same — gate removal alongside `distill`. |
| src/commands/migrate-legacy-assignments.js | legacy | low | "Deterministic V3-to-V4 mover". Help text labels it legacy. No tests. Templates and migration guide still reference it. | Keep for now (still advertised) but add to a deprecation roadmap; ensure tests cover at least dry-run. |
| src/commands/migrate.js | inconsistency | low | Just prints a static guide pointer. Function is one screen. If layout migration is now agent-driven via `specdev-layout-migration` skill, the command duplicates the skill prose. | Consider folding into help text or making it emit JSON suitable for `specdev next` instead of console-only prose. |
| src/commands/help.js | inconsistency | low | Help OPTIONS block lists `--platform=<...>` indirectly via init's deprecation message but help itself omits it. Also lists `--assignment=<id>` as applying only to legacy distill/migrate-legacy — accurate but stale once distill is removed. | Re-audit options list after legacy-distill removal. |
| src/commands/skills.js | inconsistency | low | `skills view` subcommand exists but is not exposed in `commands.js` / help / context output. Useful but undocumented. | Add `skills view` row to `COMMANDS` or remove the handler. |
| src/commands/init.js | duplication | low | Inline `listReviewers`-style logic duplicated across `init.js` (auto reviewer check via reviewers.js), `checkpoint.js`, `implement.js`, and `reviewloop.js` (each redefines `listReviewers` or inlines reviewer-dir scanning). | Extract a single `listReviewers(specdevPath)` helper (e.g. into `src/utils/reviewers.js`) and reuse. |
| src/commands/checkpoint.js | duplication | low | Local `listReviewers` reads `.specdev/skills/core/reviewloop/reviewers/` (same as reviewer-preflight `availableReviewerNames`). | Reuse `availableReviewerNames` from reviewer-preflight. |
| src/commands/implement.js | duplication | low | Same private `listReviewers` reimplemented. | Reuse shared helper. |
| src/commands/reviewloop.js | duplication | low | Inline reviewer-dir scan in two places (discussion branch and assignment branch) duplicates `availableReviewerNames`. | Reuse `availableReviewerNames`. |
| src/utils/command-context.js | drift | low | `ensureProgressJson` is exported but no caller references it (`implement.js` deliberately lets `track-progress.sh` lazy-init progress.json). | Remove `ensureProgressJson` or document why it is preserved as a public helper. |
| src/utils/command-context.js | drift | low | `resolveSpecdevPath` is exported but unused anywhere in `src/`, `bin/`, `scripts/`, `hooks/`, or `tests/`. | Drop the export or adopt it in commands that currently compose `join(resolveTargetDir(flags), '.specdev')` (every command). |
| src/utils/active-tools.js | drift | low | `addTool` is exported but unused; tools are added via direct `activeTools.tools[name] = ...` writes in `skills-install.js`. | Remove `addTool` or migrate `skills-install.js` to use it for consistency with `removeTool`. |
| src/utils/prompt.js | drift | med | `askYesNo`, `askMultiLine`, `presentSuggestion`, `askCustomObservation` are exported but no command imports them (only `assignment.js` uses `askChoice`). Likely leftover from the deleted distillation interactive flows. | Delete the unused helpers or document the public API surface. |
| src/utils/workflow-contract.js | drift | low | `phaseList(command, separator)` is exported but no caller references it. Tests use raw `commandPhases` arrays. | Drop `phaseList` or wire it through help/skill-template generation. |
| src/utils/workflow-contract.js | drift | low | `phases.aliases` (with `implementation: ['implement']`) is exported but never read; only `phases.canonical` is consumed (`workflow-runtime.js`). | Remove the unused alias map or hook it into a CLI alias system. |
| src/utils/knowledge.js | drift | low | `KNOWLEDGE_DB_RELATIVE_PATH` is exported but only referenced internally inside `knowledge.js`. | Either consume from callers (context.js hardcodes `cache/knowledge.sqlite`) or de-export. |
| src/commands/context.js | inconsistency | low | `buildKnowledgeInfo` hardcodes `join(specdevPath, 'cache', 'knowledge.sqlite')` while `knowledge.js` already defines `KNOWLEDGE_DB_RELATIVE_PATH`. | Import constant from `knowledge.js` to keep DB path canonical. |
| src/commands/continue.js | inconsistency | low | `distill_pending` logic still scans capture-diff assignments and surfaces the legacy distill helper, but the current workflow no longer produces `capture/*.md`. If legacy distill is removed, this block becomes dead. | Gate on legacy-distill keepalive decision; remove together. |
| src/commands/dispatch.js | inconsistency | low | `agents` is routed to `agentsInspectCommand` only — there's no `agents` parent listing, and `commands.js` advertises `agents inspect` only. Handler accepts any subcommand and re-checks. | Either expose `agents` list (no-op currently) or simplify to a dedicated `agents-inspect` command line. |
| src/commands/help.js | drift | low | Help still mentions `# Legacy knowledge distillation for old capture diffs` block; if distill is removed, this section becomes stale. | Sync with legacy-distill decision. |
| scripts/verify-gates.sh | legacy | med | Refers to V3 `implementation.md` schema and references `review_request.json` / `review_report.md` — but no source command in `src/` writes `review_request.json` (only validates it). The script is invoked nowhere in `src/`, `tests/`, `hooks/`, or `package.json`. Only a templated review report mentions "paste verify-gates.sh output here". | Decide whether to retain as an operator tool. If yes, document; if no, delete script and the template reference. |
| scripts/verify-assignment-schema.js | drift | low | Used by `tests/test-assignment.js` only; no runtime caller. Schema check duplicates logic also performed in-process by `scan.js`/`detectAssignmentState`. | Keep as a test utility but consider moving to `tests/helpers` or document as a test-only script. |
| hooks/session-start.sh | inconsistency | low | Mentions `.specdev/skills/tools/` for `TOOL_SKILLS`, but this fallback branch only fires when `specdev context --json` fails — modern installations always have that command, so fallback path is dead in practice. | Trim fallback or leave as graceful degradation; either way add a comment that it is purely a backstop. |
| hooks/session-start.sh | duplication | low | Brainstorm/breakdown/implementation rule blurbs duplicate the prose shipped via skill SKILL.md files and `_main.md`. Drift risk if rules change. | Consider centralizing in a helper that emits canonical phase text. |
| src/utils/update.js | drift | low | `OFFICIAL_TOOL_SKILLS` constant is an empty array; mapped into `systemPaths` produces nothing. | Remove the constant and its `.map` expansion if no built-in tool skills are planned. |
| src/utils/update.js | drift | low | Cleanup-removePaths list still includes paths like `skills/tools/autoloop`, `skills/tools/reviewloop`, `_guides/task`, `_guides/workflow`, `_router.md` for older installations. Harmless but represents a long-running migration tail. | Periodically prune oldest entries once the user base is past those versions. |
| src/commands/init.js | duplication | low | `SKILL_FILES` template strings duplicate phase command names listed in `commands.js` and `workflow-contract.js` (e.g. lists of valid phases). Strings are dynamically built but each SKILL still hardcodes phase verbiage. | Already partially centralized via `commandPhases`; continue migrating remaining hardcoded text. |
| src/utils/scan.js | drift | low | `readKnowledgeBranch` used only by legacy `distill.js`. Tied to distill keepalive. | Remove together with distill if legacy command is dropped. |
| src/utils/scan.js | drift | low | `markCapturesProcessed`/`readProcessedCaptures` used only by distill / distill-done / continue (capture surface). Same legacy fate. | Same — gate removal alongside distill. |
| src/commands/continue.js | inconsistency | low | `selection.selectedBy` field is set on the `selected` object (`selectedBy: 'current'`) but consumed via `selection.selectedBy` in `buildContinuePayload`. Works only because the spread copies one property; fragile contract. | Tighten the return shape of `resolveAssignment`. |
| src/utils/reviewer-runner.js | duplication | low | `appendCapped` helper duplicated verbatim with `agent-runner.js`. | Extract to a shared internal helper (e.g. `src/utils/buffer.js`). |
| src/utils/agent-runner.js | duplication | low | `createStreamJsonTranslator` in `agent-runner.js` and `createReviewerStreamJsonTranslator` in `reviewer-stream-json.js` overlap substantially (tail buffering, line splitting, `renderStreamJsonLine`). | Factor out shared streaming translator core. |
| src/commands/init.js | inconsistency | low | Adapter map defines `generic: { path: 'AGENTS.md' ... }` but `ALL_ADAPTERS` only includes `claude`, `codex`, `cursor` — `generic` is unreachable. | Either include `generic` in `ALL_ADAPTERS` or drop it. |
| src/commands/dispatch.js | drift | low | `--version`/`-v` is handled inside dispatch but `version` does not appear in the `commandHandlers` map; it is special-cased like `help`. The `commands.js` entry shows `version` as a command (usage `--version, -v`) — half command, half flag. | Document or split into a real `version` handler for consistency. |
