---
verdict: approved
material_divergence: false
---

## Findings

No blocking findings.

Prior blocking finding resolved: `package.json` `releaseDate` is now `2026-07-27` (package.json:4), matching the current date, and the diff is confined to that single field — no dependency was added, upgraded, or removed, so no registry/lockfile/advisory evidence is required.

Acceptance verification (all criteria have a final result)

- AC-1: `tests/test-reviewloop-modes.js` mutates an unrelated `.specdev/discussions/D90000_concurrent/brainstorm/proposal.md` during the Assignment brainstorm review and `.specdev/test-audits/TA99999_concurrent/audit.md` during the Mission review (tests/test-reviewloop-modes.js:237-239, asserting `status === 'approved'`). Receipt: `npm run test:reviewloop-modes`, passed at `working-tree@ebd6ee0`.
- AC-2: same suite asserts `/Reviewer modified/` for a mutation to the active Discussion's own `brainstorm/proposal.md` and for product-tree mutations in both Assignment and Discussion reviews (tests/test-reviewloop-modes.js:163, 183, 190). Both sides of the boundary are proven as the contract's risk section requires.
- AC-3: `tests/test-engine-integration.js` asserts the concurrent Discussion/Test Audit artifacts are absent from `git show --name-only HEAD`, absent from `git diff --cached --name-only` (including after the injected failed-delivery path), and still present in `git status`, for both Adhoc finish and standalone Assignment delivery. Receipt: `npm run test:engine-integration`, passed at `working-tree@ebd6ee0`.

Re-verification of the repair's blast radius: the acceptance suites were not rerun after the `releaseDate` bump. That is acceptable here — no test or fixture reads `releaseDate`; its only consumers are `src/commands/update.js:74,138,165` and `src/commands/context.js:32`, all reporting paths. The recorded receipts therefore remain valid for the delivered tree.

Implementation still matches the approved plan. `reviewerCandidateRoot`/`reviewerStateDigest` (src/utils/spawned-agent.js:556-586) compose the product digest with the exact candidate root; every `role: 'reviewer'` site (reviewloop.js:138/244/387/519/811, mission.js:1855/2153) resolves a result path under `assignments|missions|discussions`, so the new throw is defensive only. A Mission-child Assignment nested under a Mission root resolves to the broader Mission root, which widens protection rather than weakening it. `stageOwnedChanges` (src/utils/git-delivery.js:48-74) excludes the concurrent roots at `git add` time and unstages any pre-staged ones; `stageAll` has no remaining callers, and `trackedStateDigest`'s new options signature has no stale positional-array call sites.

Informational (unchanged from the prior review, not divergence)

- The product-tree-plus-candidate model tolerates all non-candidate `.specdev/**` mutation during review, not only the two enumerated concurrent-callable roots. This follows directly from the contract's Important Decisions and plan T-1, but it is a residual widening the approval gate should see.
- Nested-project edge case, pre-existing and unchanged in kind: `git status --porcelain` returns repo-root-relative paths while `isConcurrentCallablePath` and the `git restore --staged` pathspecs are interpreted relative to `targetDir`. These differ only when `.specdev/` lives below the Git root; not exercised here.
- The engine-integration graph-version assertions (`assignment-lifecycle@2.2.0`, `mission-lifecycle@1.4.0`) repair a fixture that went stale in `ebd6ee0`; recorded in `deviations`.
