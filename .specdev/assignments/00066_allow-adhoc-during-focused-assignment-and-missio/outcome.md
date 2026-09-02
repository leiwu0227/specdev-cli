# Outcome

## Delivered behavior

Adhoc can now coexist with a focused standalone Assignment or Mission at an
explicitly safe contract-formation position without shelving, abandoning, or
replacing that owner. The shared focused-owner classifier preserves complete
workflow state, protects Assignment, Mission, child, run, and Attempt paths,
and fails closed for product execution boundaries, live Attempts, unsupported
positions, or ambiguous ownership.

Adhoc finish and cancel now leave a durable revision-and-path revalidation
obligation. Focused advancement remains blocked until an explicit unchanged-
contract revalidation succeeds; a reported contract change remains blocked for
normal editing and user approval. Status output, receipts, help, generated
skills, workflow guidance, and public guidance expose the same recovery path.

## Deviations

Focused verification exposed three fixture-only mismatches before passing:
blocked status correctly exits nonzero, generated prose uses capitalized
`Focused-workflow`, and the Mission boundary fixture needed to replace its
existing null YAML field instead of appending a duplicate key. No runtime scope
was broadened by these repairs.

## Unresolved risks

None identified within the approved contract. Mission positions after approval
remain deliberately blocked because Mission approval establishes its execution
boundary; nested Mission child focus also fails closed to its controller.

| Acceptance | Evidence                                                                                                                                                                                                                                                                                         | Result |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC-1       | `npm run test:engine-integration` passed Assignment brainstorm/approval/design and Mission brainstorm/approval coexistence, preserved-owner/path, and safe-position fixtures.                                                                                                                    | Passed |
| AC-2       | The same engine integration run passed active-command guards, exact finish/cancel behavior, durable changed-path/revision obligations, blocked status projection, unchanged-contract revalidation, and changed-contract reporting.                                                               | Passed |
| AC-3       | Engine integration passed live-Attempt, established-boundary, unsupported-position, and ambiguous-state failures; `node ./tests/test-init-platform.js`, `node ./tests/test-status-visibility.js`, and `npm run test:engine-packaging` all passed their focused guidance and regression coverage. | Passed |
