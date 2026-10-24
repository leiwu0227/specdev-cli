# Assignment contract

Kind: bugfix

## Objective and context

Remove the Mission verification-order deadlock without weakening verified completion.
In oceanshed-cli Mission M00001, derived child 00084 inherits AC-5 requiring the final
integrated command to pass, while its verification authority reserves that command
for the controller after child review. The child reviewer correctly blocks. The
saved user-approved amendment separates child acceptance from Mission acceptance,
but the installed CLI rejects changes to the approved child contract.

Evidence: ../cli/oceanshed-cli/.specdev/assignments/00084_implement-the-portable-oceanshed-single-lab-conv/
contains brainstorm/contract.md, brainstorm/contract_amendment.md,
review/implementation-verdict.md, and implementation/resolver-result.md.
Source anchors: src/commands/mission.js deriveSingleChildContract and driveMission;
src/utils/assignment-vnext.js assertApprovedContract; src/utils/assignment-delivery.js
acceptance and verification validation. The affected repository remains read-only.

## Scope and non-goals

- In scope: explicit child versus controller verification ownership, generation of
  consistent new child contracts, child review/receipt evaluation, bounded recovery
  for existing approved children with this conflict, command guidance, and regression tests.
- Non-goals: a general contract amendment system; arbitrary acceptance waivers;
  treating missing evidence as passed; running the parent final command inside an
  unauthorized child; closing the Mission with limitations; changing Oceanshed code
  or mutating its Mission; publishing or installing the CLI.

## Expected behavior

New Missions must not require a child to produce evidence that only the controller
can produce after that child's review. Represent verification ownership explicitly
and preserve every parent acceptance obligation. Focused child evidence can satisfy
child-owned criteria when authorized and sufficient. Controller-owned integrated
acceptance remains pending until the approved final command passes on the relevant
candidate. Review and status must distinguish child readiness from Mission success.
Do not infer ownership or remove criteria using keyword matching of contract prose.

Provide a supported semantic recovery operation for an existing active Mission and
its approved child. It previews the exact old and proposed verification boundary,
contract/approval identities, affected evidence and review state, and candidate.
Explicit confirmation binds that unchanged plan. Preserve original contracts and
approval history, record superseding authority through lifecycle APIs, and invalidate
only evidence/review decisions whose authority or candidate no longer matches.
An already-saved approval note is evidence for the preview, not automatic permission
to apply a new migration plan. Preserve implementation bytes and valid focused
receipts; do not relabel qualification evidence as authoritative without validating
its command, scope, candidate, and the approved acceptance boundary.

For the reported case, recovery must permit review of the child's implementation
and focused acceptance, then let the controller run npm run verify:mission, and
permit Mission completion only after passing final evidence and required review.
The parent AC-5 remains unchanged. Tests use isolated fixtures, not the user's repository.

## Important decisions

Fix the dependency cycle and verification ownership at their source. Keep normal
approved-contract immutability. Limit the recovery operation to this verification
boundary correction; reject material changes to parent behavior, scope, constraints,
or final verification authority. Use explicit ownership declarations or a reviewed
mapping where prose alone is ambiguous. Remove guidance that promises unsupported
amend-and-reapprove behavior.

## Constraints and invariants

Use semantic lifecycle APIs; never hand-edit RippleGraph checkpoints. Retain failed
receipts, blocked verdicts, original contracts, approval events, and missing-evidence
history. Stale plans, changed candidates, wrong ownership, and live or ambiguous
execution must fail closed without damaging work. Recovery must be idempotent and
recoverable after interruption. Preserve unrelated dirty files and workflow focus.
Before repository commits, set package.json releaseDate to the current date.

## Delegated and reserved authority

- Delegated: command spelling, metadata representation, bounded internal refactoring,
  candidate binding, migration journaling, and regression fixture implementation.
- Reserved for the user: this contract's approval; execution of the listed tests;
  confirmation of any real Mission recovery plan; changed product scope or acceptance
  requirements. This Assignment does not authorize mutating oceanshed-cli or running
  its tests or integrated command.

## Risks and assumptions

The reported failure has two causes: the cyclic AC-5 prerequisite and qualification-only
receipts that do not satisfy the current authoritative acceptance gate. Both need
consistent handling. Free-form criteria can combine child and parent obligations;
ambiguous ownership requires an explicit mapping, not silent deletion. Preserve
required independent review after recovery. Do not reuse a prior verdict merely
because product bytes are unchanged when its approval authority has changed.

## Verification authority

Proposed focused commands, pending explicit user authorization:
- node tests/test-mission-verification-boundary.js (new isolated regressions)
- npm run test:mission-environment
- npm run test:reviewloop-modes

Use these commands for necessary repair reruns within this Assignment. No full suite
or tests in oceanshed-cli are authorized. Contract approval alone does not authorize
test execution. A semantic review of the reported user's artifacts is read-only.

## Acceptance criteria

- AC-1: A new Mission with controller-owned final verification has no child-review
  dependency on that later evidence. Child review requires sufficient authorized
  child evidence, while Mission completion still requires the unchanged parent
  acceptance obligations and passing final integrated verification.
- AC-2: A previewed and explicitly confirmed recovery resolves an existing approved
  child verification-order conflict without product edits, lost history, fabricated
  evidence, or a general contract-lock bypass. Wrong ownership, material scope changes,
  stale confirmation, and unsafe live execution fail before authoritative mutation;
  interrupted recovery and exact retries are consistent and idempotent.
- AC-3: An isolated fixture based on oceanshed-cli M00001/00084 progresses from the
  blocked child to review and controller verification, then completes only with
  passing final evidence. Failed or missing final evidence keeps the Mission
  incomplete; qualification-only receipts are not silently promoted. Existing
  Mission verification and review behavior retains its required gates.
