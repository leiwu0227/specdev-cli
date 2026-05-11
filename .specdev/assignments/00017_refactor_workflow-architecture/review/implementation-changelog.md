## Round 1

### Addressed
- [F1.1] Wired `src/commands/check-review.js` to validate explicit phases against `commandPhases.checkReview` before looking for feedback files. Invalid phases now fail with `unknown_phase` in JSON mode and a clear human error otherwise.
- Updated generated `specdev-check-review` skill prose to derive its accepted phase list from `commandPhases.checkReview`.
- Added workflow tests for invalid `check-review` phases in human and JSON modes, plus an init test that verifies generated check-review skill prose uses the contract phase list.

### Tests
- `npm run test:workflow`
- `npm run test:init`
- `npm run test:workflow-contract`
- `npm run test:workflow-contract-drift`
