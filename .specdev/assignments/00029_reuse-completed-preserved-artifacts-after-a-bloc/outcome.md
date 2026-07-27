# Outcome

## Delivered behavior

The working-tree candidate classifies preserved worker results as absent,
blocked, malformed, artifact-invalid, or completed. Only a strictly valid
completed result is reused; non-reusable preserved results return distinct
actionable diagnostics without launching a provider unless `--retry-worker` is
explicitly supplied. A focused regression script covers recovery reuse,
preservation, graph position, provider-attempt counts, explicit retry, and the
normal absent-result path.

## Deviations

The first focused run stopped during fixture setup because its Big Picture note
lacked the required Overview and Architecture sections. The isolated fixture
was corrected before the passing final run.

## Unresolved risks

None identified within the approved scope.

| Acceptance | Evidence | Result |
| --- | --- | --- |
| AC-1 | `npm run test:implement-recovery` reused valid completed artifacts with zero provider Attempts. | Passed |
| AC-2 | `npm run test:implement-recovery` preserved blocked, malformed, and invalid states with distinct diagnostics and zero provider Attempts. | Passed |
| AC-3 | `npm run test:implement-recovery` launched exactly one provider Attempt for explicit retry and absent-result paths. | Passed |
