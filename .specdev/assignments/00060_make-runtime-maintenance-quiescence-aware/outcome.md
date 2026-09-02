# Outcome

## Delivered behavior

`specdev update` now uses one provider-neutral quiescence model across initial mutation and update-completion resume. It inspects every durable Attempt record, blocks live or ambiguous execution with structured ownership diagnostics, reconciles only confirmed stale local processes to `interrupted`, and rechecks before managed mutation. Dry-run and status expose the same facts without reconciliation. Update guidance documents the no-bypass boundary.

## Deviations

No contract or scope deviations. Focused verification required a bounded resume-helper repair, a null-safe malformed-record diagnostic, and synchronization of one stale shelf-test placeholder with existing terminal-Assignment guidance.

## Unresolved risks

None identified after focused acceptance. Missing, unreadable, inaccessible, or invalid process evidence remains conservatively blocking; PID reuse can therefore cause a safe false-positive block rather than unsafe maintenance.

| Acceptance | Evidence | Result |
| --- | --- | --- |
| AC-1 | `node tests/test-update-workflow.js` and `node tests/test-update-skill-roots.js` cover initial/resumed gates, structured failures, and the pre-mutation boundary. | Passed |
| AC-2 | `node tests/test-update-workflow.js` covers stale reconciliation and retry; `node tests/test-assignment-shelf.js` covers shared liveness compatibility. | Passed |
| AC-3 | `node tests/test-update-workflow.js` covers read-only inspection and adapter completion; `node tests/test-update-skills.js` covers existing quiescent update behavior. | Passed |
