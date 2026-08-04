# Outcome

## Delivered behavior

Added one provider-neutral Attempt-progress model for workers and reviewers. It validates optional 4 KiB public milestone files from ignored runtime cache, rejects malformed, oversized, unknown-field, future-dated, control-character, and sensitive-looking content with bounded diagnostics, retains the last valid milestone, and classifies live controller/log activity as fresh, quiet, or stale. Spawned Attempts now write the validated projection and emit the same object as concise human stderr or JSON-line stderr while final command JSON remains on stdout; telemetry does not update durable lifecycle status.

## Deviations

None.

## Unresolved risks

None.

| Acceptance | Evidence | Result |
| --- | --- | --- |
| AC-1 | `npm run test:attempt-progress` passed the shared progress model, human/JSON-line formatting, and freshness fixtures. | Passed |
| AC-2 | `npm run test:attempt-progress` passed absent, malformed, oversized, stale, sensitive-text, bounded-output, and path-safety fixtures without lifecycle mutation. | Passed |
