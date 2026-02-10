# Implementation Plan: Dynamic Knowledge & Multi-Agent Support

## Summary
Add knowledge vault, assignment context/task structure, two interactive ponder commands, and update migration support. Full design documented in `project_notes/upgrade.md`.

## Tech Stack
- Language: Node.js (ESM)
- Dependencies: None new (uses Node built-in `readline` for prompts)
- Testing: Existing integration test pattern (init + verify)

## Architecture

### Knowledge Vault (`templates/.specdev/knowledge/`)
```
knowledge/
├── _index.md                    # Routing to branches
├── _workflow_feedback/          # Global candidates for maintainer pickup
├── codestyle/                   # Local: naming, errors, tests
├── architecture/                # Local: patterns, deps, boundaries
├── domain/                      # Local: business concepts
└── workflow/                    # Local: project-specific workflow notes
```

### Assignment Structure (new subdirectories)
```
assignments/XXXXX_type_name/
├── context/                     # SHORT-TERM knowledge
│   ├── decisions.md
│   ├── progress.md
│   └── messages/                # Inter-agent communication
└── tasks/                       # Task decomposition
    ├── _index.md
    └── NN_name/
        ├── spec.md              # What to do
        ├── scratch.md           # WORKING knowledge
        └── result.md            # What was done
```

### New CLI Commands
- `specdev ponder workflow` → scans assignments, suggests workflow observations, writes to `_workflow_feedback/`
- `specdev ponder project` → scans assignments, suggests project knowledge, writes to `knowledge/<branch>/`

### New Source Files
- `src/utils/scan.js` — assignment scanner
- `src/utils/prompt.js` — readline-based interactive prompts
- `src/commands/ponder-workflow.js` — workflow ponder command
- `src/commands/ponder-project.js` — project ponder command

### Modified Files
- `bin/specdev.js` — route `ponder` subcommands
- `src/commands/help.js` — document new commands
- `src/utils/update.js` — ensure new directories on migration
- `tests/verify-output.js` — verify new structure, fix `_main.md`/`_router.md` prefix bug

### Repo-Only (not shipped)
- `learnings/` — global aggregation directory for workflow improvement knowledge

## Implementation Steps
1. Create knowledge vault template directory structure
2. Add context/ and tasks/ to assignment example template
3. Create learnings/ directory at repo root
4. Build scan utility for assignment analysis
5. Build prompt utility for interactive CLI
6. Implement ponder workflow command
7. Implement ponder project command
8. Update CLI routing and help text
9. Fix and update tests
10. Update update.js for migration support

## Success Criteria
- `specdev init` creates full new structure (40 files verified)
- `specdev update` migrates old installations (creates knowledge/ if missing, preserves project files)
- `specdev ponder workflow` and `specdev ponder project` run interactively
- All tests pass
- This repo dogfoods the new structure via `specdev update`
