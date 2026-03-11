# Cursor Reviewer Proposal

## Problem
specdev's reviewloop only has Codex as a configured reviewer. Users who prefer Cursor CLI should be able to use it as an alternative reviewer.

## Solution
Add a `cursor.json` reviewer config following the existing pattern, plus add `cursor-agent` to the CLI detection in `src/utils/reviewers.js`.

## Scope
- 1 new JSON config file
- 1 minor edit to reviewers.js (add cursor-agent to binary check list)
- Test coverage for both
