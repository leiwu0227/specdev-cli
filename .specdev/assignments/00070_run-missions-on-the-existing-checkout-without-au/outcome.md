# Outcome

## Delivered behavior

Missions use the existing attached checkout and sequential children in both
implementation modes. Checkpoints use exact product byte manifests and owned
artifacts, preserving unrelated index/worktree changes. Automatic branching,
worktree execution, landing, and publishing are retired. Graph 1.7.0 removes
parallel routing and required branch approval. Historical inspection and guarded
abandonment survive missing/unreachable revisions; compatible sequential state
migrates while distributed state remains preserved and blocked.

Shipped instructions and generated Mission skills describe local sequential
execution and exact ownership. Installed workflow files were not updated.

## Deviations

None. User approval after the third contract review authorized implementation
and the ten listed focused verification commands. No full suite was run.

## Unresolved risks

History rewrites can block continuation and require guarded abandonment and a
fresh approved work item, as explicitly agreed. Historical parallel Missions
require separate user-directed recovery. Mission children must record final
product byte identities in progress.json owned_paths.

| Acceptance | Evidence | Result |
| --- | --- | --- |
| AC-1 | Engine integration, graph package, Mission environment and checkout tests; both modes complete locally; attached/real HEAD and removed-command refusals | Passed |
| AC-2 | Mission checkout tests commit owned bytes while retaining unrelated staged and unstaged bytes and blocking changed ownership digests; integration tests cover dirty refusal and exact adoption | Passed |
| AC-3 | Compatibility tests cover 1.6→1.7 immutable-package migration and preserved distributed state; abandonment tests cover new and legacy history rewrites; successor and reapproval tests pass | Passed |
| AC-4 | Source/template/help inspection and graph package checks; README, Quickstart, workflow guides, generated Mission skill, and artifact schema updated | Passed |
