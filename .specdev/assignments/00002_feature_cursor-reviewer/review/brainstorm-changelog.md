## Round 1

### Changes
- [F1.1] Removed incorrect claim about needing to modify `src/utils/reviewers.js`. Updated design to reflect that CLI detection is already config-driven — adding `cursor.json` is sufficient for auto-discovery.
- [F1.2] Specified concrete test targets: `test-reviewloop.js` (init installs cursor.json), `test-reviewloop-command.js` (reviewer listing includes cursor), and `checkReviewerCLIs` (returns cursor-agent binary entry).
