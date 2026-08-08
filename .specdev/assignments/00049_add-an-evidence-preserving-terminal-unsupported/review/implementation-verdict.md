---
verdict: approved
material_divergence: false
---

## Findings

The previously blocking defect is repaired and directly covered.

`src/commands/assignment-close.js` now separates the *authorization* boundary from the *effective delivery* boundary. `buildClosePlan` still records the full `owned_paths` manifest plus a new `prospective_paths` list (`:292`, populated by `prospectiveTrackedEffects` at `:609-623`). `assertPreparedManifest` (`:674-697`) returns the actually-dirty owned subset, and `assertPreparedPathSet` (`:861-875`) treats a predicted path that is absent from `git status` as satisfied *only* when it is in `prospective_paths`, while any path outside `owned_paths` is still rejected as unauthorized. Publication then uses that prepared subset end-to-end: journal `prepared_paths`/`prepared_digest` (`:376-377`), `commitExactDelivery({paths: preparedPaths})` and `assertSamePaths(committedPaths, preparedPaths, 'Prepared terminal commit')` (`:417-428`), and `verifyUnsupportedCommit` re-checks the committed tree with the same rule (`:507`). Non-prospective owned paths (evidence working-tree files, adopted product paths) remain mandatory, so the tolerance is narrow.

The deadlock scenario is closed: a tracked `.specdev/.ripplegraph/current.json` that `abandonRun` + `compactUnsupportedWorkflowRuntime` rewrite back to bytes identical to the parent no longer aborts preparation after mutation, so the journal reaches `phase: 'prepared'` and `recoverUnsupportedClose` (`:477-500`) converges on the same terminal commit rather than re-running a preparation that can never succeed.

Regression coverage reproduces the exact failure: `tests/test-assignment-unsupported.js:23-30` now creates and commits `.specdev/.ripplegraph/current.json` as the canonical `{\n  "focusedRunId": null\n}` in the baseline commit, `:210-211` assert the path appears in both `owned_paths` and `prospective_paths`, and `:270` / `:283-286` assert the terminal commit excludes it while the file is restored to canonical null focus. The one-commit, exclusion, idempotent-retry, status/history, immutability, and successor-provenance assertions are unchanged and still present (`:257-321`). `progress.json` records the intermediate failed run (fixture trailing-newline mismatch) honestly and a final `npm run test:assignment-unsupported` pass at `working-tree@17e0905`, with `outcome.md` and the deviations describing the same repair; every AC has a final result.

No external dependency was added or upgraded — the `package.json` diff only adds the focused test script, wires it into `test`, and adds the new test file to `lint`; `releaseDate` is `2026-08-08`. Only `templates/.specdev/` was edited, not installed `.specdev/` workflow files; the modified `.specdev/.id-counters.json` and `.specdev/.ripplegraph/current.json` are runtime state from executing the workflow. No tests were run during this review.

Non-blocking, carried forward for a successor:

- `prospective_paths` also contains the Assignment's `status.json` and `unsupported.md` (`:621-622`), so the path-set check alone would tolerate a terminal commit missing them. In practice `verifyUnsupportedCommit:518-538` re-reads both from the commit and requires the unsupported status, plan digest, contract hash, reason, and evidence digests, so an omission still fails closed — but the manifest check is weaker than it reads.
- `classifyDirtyPath:637` still sweeps every dirty non-`.specdev/` path into the owned manifest once `git_boundary.starting_git_commit_hash` matches HEAD; the fixture only exercises the boundary-absent regime.
- `src/utils/status-view.js:194-212` collects only `unsupported` records into `terminalAssignmentHistory`, so `last_workflow` can surface an older unsupported closure ahead of a newer completed or shelved Assignment. Cosmetic.
