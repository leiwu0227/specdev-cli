# Test Audit Lane

Parent design: `./workflow_lanes.md`

Test Audit is a concurrent product-and-test-read-only callable that evaluates
redundant, obsolete, or disproportionately costly test protection. It prepares an
exact possible Assignment without granting deletion or rewrite authority.

Creation requires initialized project context, atomically reserves a `TA` identity,
records the starting revision, creates `audit.md` and an Assignment contract seed,
and starts the versioned callable graph. It never becomes the focused scheduler.

Redundancy is judged by retained protection rather than textual similarity. Each
candidate explains the behavior or failure mode it protects, the retained coverage
that would replace it, expected maintenance or execution savings, uncertainty, and
confidence. The audit distinguishes safe removal, consolidation, uncertain cases,
and uniquely valuable tests.

Completion validates that the audit and proposed contract are substantive and records
a content hash at the current revision. The files remain editable, but changed bytes
invalidate promotion until the completed content is restored or a new audit is
created. Completion does not mutate tests, approve the proposed contract, or
guarantee that evidence remains current.

Concurrent product changes can invalidate findings. Promotion verifies the completed
call and artifact hash, creates a fresh Assignment, and requires normal contract
review and approval. Its contract may be refined after revalidation, but no mutation
authority transfers automatically.

Test Audit artifacts remain independently owned while the callable is active or
completed. Adhoc and focused workflows cannot adopt them as incidental dirt.

## Source Targets

- `src/commands/test-audit.js` — maximum 280 lines — callable lifecycle, artifacts, and promotion readiness.
- `src/utils/test-audit.js` — maximum 70 lines — identity, selector, and artifact hashing.
- `templates/.specdev/workflows/test-audit-lifecycle/graph.json` — maximum 130 lines — recoverable callable shape.
