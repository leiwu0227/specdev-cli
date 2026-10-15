# Assignment contract

Kind: change

## Objective and context

Add terminal Mission closure for user-accepted delivery with incomplete verification. Users need to retain delivered work and accepted limitations while releasing the Mission execution boundary for subsequent Adhoc work. Current completion requires verification, while abandonment records no delivery.

Context: src/commands/mission.js, src/commands/mission-abandon.js, src/utils/adhoc-focused.js, and the historical outcome at .specdev/assignments/00064_add-explicit-mission-abandonment/outcome.md. Current code remains authoritative.

## Scope and non-goals

- In scope: Mission close command, terminal lifecycle and ownership handling, status and mutation guards, focused regression coverage, and product help/template documentation.
- Non-goals: bypassing normal completion gates; changing contracts or verification results; implementing missing delivery work; publishing, merging, deleting code, or pruning artifacts/history; changing the globally installed CLI or installed workflow guides.

## Expected behavior

Support `specdev mission close <id> --outcome=accepted-with-limitations --evidence=<acceptance-note>`. Evidence is a readable written acceptance note that identifies the limitations and the user's acceptance. The initial invocation previews the exact closure plan without changing lifecycle state. An explicit user-approved confirmation with `--confirm=<plan-digest>` applies that plan. Bind the evidence contents and relevant lifecycle/ownership state to the digest; reject missing evidence, unsupported outcomes, and stale confirmation before mutation.

Record a distinct terminal accepted-with-limitations outcome and durable acceptance evidence. Report that verification remains incomplete. Resolve nonterminal owned child/controller state without marking unfinished Assignments completed or erasing their evidence. Release Mission focus and execution ownership so a subsequent Adhoc can start. Preserve unrelated ownership and focus. Refuse closure while live or ambiguous worker/controller execution makes it unsafe.

Keep normal verified completion and abandonment distinct. Terminal status/run reporting must be truthful; mutating commands must not reopen or reinterpret the closed Mission. Exact retries and interrupted closure recovery must be consistent and idempotent.

## Important decisions

Use the existing digest-bound terminal-operation pattern for explicit acceptance. Preserve the acceptance note contents in the durable record so later edits to the source note cannot change historical acceptance. Do not convert failures or missing evidence into passing verification. Retain code, contracts, artifacts, verification records, and history.

## Constraints and invariants

Use semantic lifecycle APIs, not manual RippleGraph state edits. Preserve unrelated dirty paths and installed workflow changes. Update package.json releaseDate to the current date before any repository commit. Do not run tests without explicit approval.

## Delegated and reserved authority

- Delegated: internal schema, terminal status representation, lifecycle API integration, recovery mechanics, implementation structure, and focused regression design within this contract.
- Reserved for the user: this contract's approval, test execution approval, and explicit acceptance of limitations for any real Mission closure. This Assignment does not authorize closing a real Mission.

## Risks and assumptions

Terminal status lists occur in multiple consumers. All affected ownership, status, resume, and mutation paths must agree. A partially applied closure must remain recoverable without losing evidence or touching unrelated work. A supplied note alone is not user confirmation; the exact preview must be explicitly confirmed.

## Verification authority

- Proposed focused commands: `node tests/test-mission-closure.js` (new regression coverage), `npm run test:mission-abandonment`, and `npm run test:mission-landing`.
- These commands require explicit user approval before execution; contract approval alone does not authorize tests. Additional commands and the full suite require separate approval.
- Focused closure fixtures will exercise a Mission with an active child and failed/missing verification, confirmation rejection, interruption recovery, retained artifacts, terminal guards, and successful subsequent Adhoc start.

## Acceptance criteria

- AC-1: Closure requires written user acceptance and exact explicit confirmation. Missing evidence, unsupported outcomes, stale confirmation, and live or ambiguous execution fail without lifecycle mutation.
- AC-2: Confirmed closure records accepted-with-limitations as a distinct terminal outcome and preserves acceptance evidence, contracts, verification failures, missing evidence, code, artifacts, and history. Status never claims verification passed, and normal completion/abandonment semantics remain intact.
- AC-3: Closure consistently resolves owned child/controller state and releases focus and execution ownership, allowing a subsequent Adhoc to start. Retries and interrupted recovery are idempotent, unrelated work is preserved, and closed Missions cannot be reopened by ordinary mutating commands.
