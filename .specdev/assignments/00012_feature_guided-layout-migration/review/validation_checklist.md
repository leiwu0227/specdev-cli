# Validation Checklist

## Verification Evidence

| Command | Exit Code | Key Output | Notes |
| --- | --- | --- | --- |
| `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh . "node tests/test-workflow.js"` | 0 | `passed:true`; `All workflow tests passed` | Task 1 and Task 3 focused workflow checks. |
| `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh . "node tests/test-init.js && node tests/test-update.js"` | 0 | `passed:true`; `57 passed, 0 failed` | Task 2 command skill install/update checks. |
| `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh . "node tests/test-workflow.js && node tests/test-init.js && node tests/test-update.js"` | 0 | `passed:true`; `All workflow tests passed` | Final focused verification for changed behavior. |
| `node bin/specdev.js migrate --target=.` | 0 | Prints `Guided SpecDev migration` and `specdev migrate legacy-assignments --dry-run` | Manual command behavior check. |
| `node bin/specdev.js migrate legacy-assignments --target=. --dry-run` | 0 | `assignments scanned: 12`; `files moved: 0` | Manual legacy dry-run check; no files moved. |
| `node bin/specdev.js help` | 0 | Lists `migrate` and `migrate legacy-assignments` | Manual help output check. |
| `.specdev/skills/core/test-driven-development/scripts/verify-tests.sh . "npm test"` | interrupted | Stopped at `test-reviewloop-command.js` after reviewer child exited but test process stayed alive | Full suite could not complete in this session; focused suites covering this assignment passed. |

## Checklist

- [x] Bare `specdev migrate` is non-destructive and guide-based.
- [x] Legacy assignment-file migration is available through `specdev migrate legacy-assignments`.
- [x] `specdev-layout-migration` command skill is installed by init/update.
- [x] Migration guide describes inspect-plan-confirm-apply flow and the legacy subcommand.
- [x] README/help/update messaging no longer describes bare migrate as automatic.
