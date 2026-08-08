# Outcome

## Delivered behavior

Implemented `specdev assignment close <id> --outcome=unsupported` with required reason and attributable written evidence, a digest-protected `--snapshot=owned` plan, exact owned/excluded manifests, an ignored recovery journal, one compare-and-swap terminal commit, runtime/focus compaction, immutable lifecycle/history handling, dirt-by-owner reporting, and fresh-successor provenance. Added focused command-level regression coverage and shipped workflow/artifact guidance.

## Deviations

Blocking review identified a recovery deadlock when a confirmed predicted runtime path became byte-identical to the parent during preparation. The closure plan remains the complete authorization boundary, while the recovery journal and exact delivery now use the effective prepared subset. Only confirmed prospective effects may be net-clean; other owned paths remain mandatory, and terminal verification rejects any committed path outside the confirmed plan. The focused regression now tracks `.specdev/.ripplegraph/current.json` with canonical null focus before the run and proves closure succeeds without forcing that unchanged path into the terminal commit.

The first repair-focused test fixture included a trailing newline that RippleGraph does not emit, so it did not reproduce the byte-identical case. After aligning the fixture with the canonical serialization, the same focused test passed.

## Unresolved risks

None.

| Acceptance | Evidence                                                                                                                                                                                                                                                                        | Result |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC-1       | `npm run test:assignment-unsupported` passed, covering required inputs, approved lifecycle/Attempt checks, evidence digests, semantic plan output, exclusions, and stale-plan refusal.                                                                                          | Passed |
| AC-2       | The same focused regression passed exact-commit publication, canonical status/artifact, owned runtime compaction, focus clearing, recovery, committed-tree verification, and the tracked null-focus path returning byte-identically to the parent without deadlocking recovery. | Passed |
| AC-3       | The same focused regression passed idle/history and dirt-owner status views, immutable source handling, and fresh-successor provenance.                                                                                                                                         | Passed |
