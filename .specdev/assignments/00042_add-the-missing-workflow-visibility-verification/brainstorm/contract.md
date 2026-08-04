# Assignment contract

Kind: bugfix

## Objective and context

Resolve durable Mission gap `gap-2d6c64c012c7d2ba` by adding the missing integrated verification entrypoints identified in `.specdev/missions/M00002_make-live-specdev-workflows-visibly-progressive-/review/mission-verdict.md`. This child is governed by `.specdev/missions/M00002_make-live-specdev-workflows-visibly-progressive-/brainstorm/contract.md` at approved hash `f807741f24148b58f7bba60216c0686c95ce99afd2fa7cd40d13d2670f0cfbd2` and builds on prerequisite outcomes `00039`, `00040`, and `00041`.

## Scope and non-goals

- In scope: make the Mission's declared `npm run test:workflow-visibility` entrypoint run the three existing focused workflow-visibility suites, and make Attempt-progress regression coverage reachable from the default test suite.
- Non-goals: changing product behavior, test scenarios, lifecycle authority, or broader test-suite organization; all unchanged Mission scope and non-goals are inherited.

## Expected behavior

The integrated workflow-visibility command runs the existing Attempt-progress, Assignment-delivery recovery, and status-visibility suites, while the default test command no longer omits Attempt-progress coverage.

## Important decisions

Reuse the three existing focused suites as the verification source of truth; this child adds aggregation entrypoints rather than duplicating their scenarios or introducing a new test body.

## Constraints and invariants

The approved Mission's constraints and invariants remain unchanged; this delta must preserve the existing focused suite entrypoints and their semantics.

## Delegated and reserved authority

- Delegated: the exact package-script composition and ordering needed to expose the two verification paths.
- Reserved for the user: any change to the Mission contract, product behavior, existing test semantics, or verification authority beyond the command below; all other Mission reserved authority is inherited.

## Risks and assumptions

The prerequisite outcomes for `00039`, `00040`, and `00041` establish that the three focused suites already cover the Mission scenarios; the remaining risk is script composition that omits a suite or executes it redundantly.

## Verification authority

After child approval, only `npm run test:workflow-visibility` is authorized under the approved Mission contract. Running `npm test` or any other test command requires separate explicit user approval.

## Acceptance criteria

- AC-1: `npm run test:workflow-visibility` is runnable and passes through all three existing focused suites: `test:attempt-progress`, `test:implement-recovery`, and `test:status-visibility`.
- AC-2: The default `npm test` path includes Attempt-progress regression coverage alongside its existing delivery-recovery and status-visibility coverage.
