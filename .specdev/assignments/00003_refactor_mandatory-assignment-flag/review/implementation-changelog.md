## Round 1

### Changes
- [F1.1] Fixed discussion reviewloop: added `SPECDEV_DISCUSSION` env var passed to reviewer subprocess, and updated `review.js` to accept `SPECDEV_DISCUSSION` env var as fallback when `--discussion` flag is not provided. This allows standard reviewer configs (`specdev review $SPECDEV_PHASE --round $SPECDEV_ROUND`) to work with discussion phase.
- [F1.2] No change needed — by design, plain `specdev assignment "desc"` reserves an ID for human folder creation, while `--type/--slug` enables automated creation by agents. The design document explicitly describes this two-path approach.
- [F1.3] No change needed — test suite passes (all suites green, 0 failures). The reviewer's failure was caused by using the old globally-installed `specdev` binary (v0.0.4) which still used heuristic detection. After `npm link`, the local dev version is used and all tests pass.
- [F1.4] Updated live `.specdev/` docs to match template updates: `_main.md`, `_index.md`, `_guides/workflow.md`, and `_guides/assignment_guide.md` now reference `specdev focus`, `specdev discuss`, `.current` pointer, `--type/--slug`, and `--discussion` promotion flow.

## Round 2

### Changes
- [F2.1] No change needed — same as F1.2. By design, plain `specdev assignment "desc"` reserves an ID for human folder creation, while `--type/--slug` enables automated creation by agents. The design document explicitly describes this two-path approach under "Two creation paths".
- [F2.2] No change needed — same as F1.3. Test suite passes (all suites green, 0 failures). The reviewer must run `npm link` first so the local dev version is used instead of the globally-installed v0.0.4.
- [F2.3] Fixed: updated `assignment.js` line 81 to reference `specdev focus <name>` instead of the removed `specdev continue --assignment=<name>`.
- [F2.4] Fixed: corrected workflow.md (live, template, and test fixture) to remove incorrect claim that `specdev discuss` sets `.current`. Discussions don't set `.current` — only `specdev focus` and `specdev assignment --type --slug` do.
