# Outcome

## Delivered behavior

Reviewer integrity snapshots now combine the product tree with the exact active
Assignment, Mission, or Discussion candidate. Unrelated Discussion and Test
Audit artifacts are outside that boundary, while active-candidate and product
mutations remain protected.

Adhoc dirty checks and Adhoc/standalone Assignment delivery now use reusable
concurrent-callable path classification and ownership-scoped staging.
Discussion and Test Audit artifacts are excluded and explicitly left unstaged;
owned product changes and normal SpecDev evidence remain eligible for delivery.

Focused regressions were added for both tolerated and rejected review-time
mutations and for Adhoc/Assignment staging and commit ownership.

The pending delivery now reports the required user-visible build date through
`package.json` `releaseDate: 2026-07-27`.

## Deviations

The first focused runs exposed stale fixture assumptions rather than product
failures: the synthetic concurrent Discussion ID forced a six-digit allocation,
and engine integration expected older installed graph versions. The fixtures
were corrected before the passing final runs.

The blocking implementation review found that `package.json` still carried the
previous build date. The repair updates `releaseDate` to `2026-07-27`; it does
not alter the accepted implementation, and the completed acceptance suites were
not rerun.

## Unresolved risks

The review recorded two non-blocking residuals: non-candidate `.specdev/**`
changes beyond the named concurrent roots remain outside reviewer snapshots,
as authorized by the approved product-tree-plus-candidate model; and nested
projects below a Git root retain a pre-existing path-relative staging edge
case. Neither was changed in this blocking-only repair. Full-suite coverage was
neither needed nor authorized.

| Acceptance | Evidence | Result |
| --- | --- | --- |
| AC-1 | `npm run test:reviewloop-modes` passed with Assignment/Mission unrelated callable mutations | Passed |
| AC-2 | `npm run test:reviewloop-modes` passed with active Discussion and product mutation rejection | Passed |
| AC-3 | `npm run test:engine-integration` passed with Adhoc/Assignment scoped staging and commit checks | Passed |
| Blocking review repair | `releaseDate` assertion and `git diff --check -- package.json` passed | Passed |
