# Assignment contract

Kind: change

## Objective and context

Allow a user to accept a failed Mission with limitations through the existing Mission close command. Reference project_notes/big_picture.md for project context and Assignment 00073 for the original closure behavior.

## Scope and non-goals

- In scope: failed Mission closure, its lifecycle handling, focused regression coverage, and source documentation for the supported transition.
- Non-goals: reopen or rerun failed Missions, claim verified completion, change completed or abandoned Mission closure policy, or close a real user Mission as part of this Assignment.

## Expected behavior

A failed Mission can preview closure with `--outcome=accepted-with-limitations --evidence=<acceptance-note>` and become closed only after explicit confirmation of the exact plan digest. Status reports accepted-with-limitations and incomplete verification. Original failure details and verification history remain available. An already terminal failed runtime must not be restarted or rewritten as a successful run.

## Important decisions

Extend the existing acceptance-note, plan-digest, closure publication, and retry flow. Do not add a parallel closure command or manually edit runtime state. Keep the original Mission state in the closure record.

## Constraints and invariants

Preserve original failure details, verification evidence, runtime outputs and transition history, and product bytes. Keep existing ownership, live-execution, stale-plan, and unrelated-work safeguards. Release only owned focus. Update product source and templates rather than installed workflow guidance.

## Delegated and reserved authority

- Delegated: choose implementation details, add focused regression cases, update source documentation, and complete the Assignment review and delivery process.
- Reserved for the user: contract approval, test execution authorization, and explicit acceptance of any real Mission closure plan.

## Risks and assumptions

Mission failure and runtime termination can differ. Handle the supported failed-state combinations explicitly, without loosening protection for unrelated workflows or ambiguous ownership. Retain existing restrictions for unsupported historical execution layouts.

## Verification authority

Proposed focused commands: `node tests/test-mission-closure.js`, `npm run test:mission-abandonment`, and `npm run test:mission-landing`. Test execution requires explicit user approval under AGENTS.md. No full suite is authorized. Include regression coverage for a terminal failed runtime, preserved failure evidence, confirmation refusal, and idempotent recovery.

## Acceptance criteria

- AC-1: A supported failed Mission can preview and confirm closure through the existing acceptance-note and exact-plan flow, ending closed with accepted-with-limitations and incomplete verification.
- AC-2: Closure preserves original failure details and verification history, including a terminal failed runtime's failure state and history, without restarting execution or claiming successful verification.
- AC-3: Failed closure retains existing ownership and confirmation protections, preserves unrelated work and focus, and supports interrupted recovery and idempotent retries; completed and abandoned Mission closure restrictions remain unchanged.
