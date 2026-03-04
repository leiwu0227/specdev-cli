## Round 1

### Changes
1. [F1.1] Added "Backward Compatibility" section — clean breaking change, no aliases. Old commands were never referenced by workflow or skills.
2. [F1.2] Added "Error Handling" section — specified exit codes and JSON/message shapes for all failure modes in both `distill` and `distill done`.
3. [F1.3] Added "Continue Nudge Limits" section — capped at 5 assignment names in payload, true count always shown, oldest-first ordering.

## Round 3

### Changes
1. [F3.1] Added `.sort((a, b) => a.name.localeCompare(b.name))` to unprocessed distill assignments in `continue.js` to guarantee deterministic oldest-first ordering by directory name.
2. [F3.2] Moved "already processed" check before validation checks in `distill-done.js` so re-running `distill done` on a processed assignment is always a no-op exit 0, regardless of subsequent `big_picture.md` or `feature_descriptions.md` drift. Updated test order accordingly.
