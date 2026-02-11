# Changelog

All notable changes to this project will be documented in this file.

## [0.0.4] - 2026-02-11

### Added
- **Skills library** -- `.specdev/skills/` with 8 modular skills (scaffolding-lite/full, systematic-debugging, requesting/receiving-code-review, parallel-worktrees, verification-before-completion, micro-task-planning)
- **Always-apply vs invoke-when-needed** skill categories -- `verification-before-completion` and `receiving-code-review` are mandatory on every assignment; others triggered by complexity gate
- **Complexity/risk gate** in planning -- classifies assignments as LOW/MEDIUM/HIGH, drives scaffolding and Gate 1 requirements
- **TDD enforcement** in implementing guide -- iron law, rationalization table (11 entries), red-green-refactor with good/bad examples, red flags checklist (13 items), adapted from [obra/superpowers](https://github.com/obra/superpowers)
- **Two-stage review model** -- Stage 1 (spec compliance) then Stage 2 (code quality) with severity tagging and file:line references
- **Anti-sycophancy protocol** in `receiving-code-review` skill -- forbidden responses, evidence-based evaluation pattern
- **Verification-before-completion** skill with gate function, rationalization table, and common failures matrix
- **Subagent isolation** -- controller/worker dispatch model in implementing guide
- **Gate 0** (planning complexity/skill selection) in gate checklist
- **Gate 1 at MEDIUM** -- user approval of contracts required for MEDIUM complexity, not just HIGH
- **Conditional scaffolding** -- scaffolding guide now supports none/lite/full modes
- **`specdev skills`** command to list available skills
- **Skills invocation tracking** -- `skills_invoked.md` per assignment
- **Skills preserved on update** -- `specdev update` creates missing default skills without overwriting customizations
- **Subagent-driven development skill** -- `skills/subagent-driven-development.md` with implementer, spec reviewer, and code quality reviewer prompt templates adapted from [obra/superpowers](https://github.com/obra/superpowers)
- **Knowledge capture step** -- Step 7 in all workflow guides, distills learnings into `knowledge/` branches after finalize

### Changed
- Implementing guide rewritten with superpowers-style TDD enforcement
- Validation guide restructured around two-stage review model
- Planning guide expanded with complexity gate and task granularity gate
- Scaffolding guide refactored for conditional modes
- All workflow guides (feature, refactor, bugfix) updated for TDD, conditional scaffolding, and two-stage review
- Gate checklist template restructured with Gate 0, conditional Gate 1, TDD tracking per task, and verification evidence table
- Assignment guide adds "Before starting" section for always-apply skills
- Example plan.md rewritten with TDD-style task decomposition
- `_main.md` bumped to v0.0.3, reflects skills-enabled workflow
- `_router.md` now lists skills with always-apply vs invoke-when-needed split

## [0.0.3] - 2026-02-10

### Added
- **Knowledge vault** -- `knowledge/` directory with branches for codestyle, architecture, domain, and workflow knowledge
- **Workflow feedback** -- `knowledge/_workflow_feedback/` for collecting workflow improvement observations
- **`specdev ponder workflow`** -- interactive command to review assignments and write workflow-level feedback
- **`specdev ponder project`** -- interactive command to review assignments and write project-specific knowledge
- **Assignment context tracking** -- `context/` subdirectory with decisions, progress, and inter-agent messages
- **Task decomposition** -- `tasks/` subdirectory with specs, scratchpads, and results for parallel work
- **Migration support** -- `specdev update` now creates new `knowledge/` directories for existing installations
- **Scan utility** -- `src/utils/scan.js` for analyzing assignment structure
- **Prompt utility** -- `src/utils/prompt.js` for interactive CLI prompts (Node built-in readline)
- **Unit tests** -- `tests/test-scan.js` with 29 assertions for scan utility

### Fixed
- Test verification now checks correct `_main.md` and `_router.md` filenames (was missing underscore prefix)
- Test verification now checks `project_scaffolding/_README.md` (was `README.md`)

## [0.0.2] - 2025-10-03

### Added
- `specdev update` command to update system files while preserving project files
- Assignment examples with scaffold files

## [0.0.1] - 2025-10-03

### Added
- Initial release
- `specdev init` command to initialize .specdev folder
- Complete workflow guides (planning, scaffolding, implementation, validation)
- Support for `--force`, `--dry-run`, and `--target` flags
- Automated testing and verification
- GitHub Actions for publishing and testing
