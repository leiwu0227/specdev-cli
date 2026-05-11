## Round 1

- [F1.1] Added `src/commands/assignment.js` as an explicit workflow-contract consumer for assignment type validation and help text.
- [F1.1] Added assignment type boundary validation as a representative drift fix and success criterion, including rejection of unsupported `specdev assignment --type=<type>` values before folder creation.

## Round 2

- [F2.1] Added `src/commands/init.js` as an explicit workflow-contract consumer for generated command-skill prose.
- [F2.1] Expanded the drift validator and success criteria so generated command skills must use contract-declared assignment types and accepted review/check-review/reviewloop phases instead of hard-coded lists.
