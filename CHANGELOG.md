# Changelog

All notable changes to this project will be documented in this file.

## [0.0.3] - 2026-02-10

### Added
- **Knowledge vault** — `knowledge/` directory with branches for codestyle, architecture, domain, and workflow knowledge
- **Workflow feedback** — `knowledge/_workflow_feedback/` for collecting workflow improvement observations
- **`specdev ponder workflow`** — interactive command to review assignments and write workflow-level feedback
- **`specdev ponder project`** — interactive command to review assignments and write project-specific knowledge
- **Assignment context tracking** — `context/` subdirectory with decisions, progress, and inter-agent messages
- **Task decomposition** — `tasks/` subdirectory with specs, scratchpads, and results for parallel work
- **Migration support** — `specdev update` now creates new `knowledge/` directories for existing installations
- **Scan utility** — `src/utils/scan.js` for analyzing assignment structure
- **Prompt utility** — `src/utils/prompt.js` for interactive CLI prompts (Node built-in readline)
- **Unit tests** — `tests/test-scan.js` with 29 assertions for scan utility

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
