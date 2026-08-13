# Outcome

## Delivered behavior

Implemented precise-default all-term and quoted-phrase knowledge search, explicit broad discovery, strong-first bounded partial fallback, match diagnostics, and refinement guidance in text and JSON. Mission planning explicitly uses broad discovery for its existing 50-result candidate pool so verified history cannot consume the precise fallback cap before living-knowledge filtering. Added bounded clean tracked repository-evidence locations with byte, file, line, and Git identities to curation proposals, approval-time invalidation, per-change attribution, and durable receipts without relaxing existing publication authority. Updated installed Assignment, Mission, Adhoc, curation, workflow, index, and quick-start guidance, plus focused command-level coverage.

## Deviations

The first authorized focused run failed before product assertions because the test selected the empty `knowledge-curations/.gitkeep` instead of the generated JSON receipt. The fixture was repaired to select the `.json` receipt, and the separately authorized rerun passed.

Implementation review then found that the unchanged Mission consumer inherited the shared API's new precise default and bounded fallback, allowing higher-coverage verified-history rows to crowd living knowledge out of its five-row fallback. The consumer now explicitly requests broad mode, and a focused regression fixture covers more than five competing history matches.

## Unresolved risks

None identified after the focused command-level repair acceptance. No full suite was run or needed for this bounded change.

| Acceptance | Evidence | Result |
| --- | --- | --- |
| AC-1 | `node ./tests/test-knowledge-curation.js` verifies precise, phrase, broad, bounded fallback, malformed-query, diagnostics, refinement behavior, and Mission broad-discovery injection beyond the five-row precise fallback cap. | Passed |
| AC-2 | `node ./tests/test-knowledge-curation.js` verifies bounded tracked repository evidence, content identity, approval invalidation, per-change attribution, and durable receipt behavior. | Passed |
| AC-3 | `node ./tests/test-knowledge-curation.js` verifies canonical installed Assignment, Mission, Adhoc, curation, and workflow guidance. | Passed |
