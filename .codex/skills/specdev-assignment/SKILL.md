---
name: specdev-assignment
description: Create an Assignment and collaborate on its single contract
---

Run `specdev assignment "<objective>"`. Collaborate directly with the user in
`brainstorm/contract.md`; do not spawn a Brainstorm author.

Keep the contract proportional. Reference existing project context instead of
restating it, record only change-specific decisions and constraints, and use the
fewest independent observable acceptance criteria (normally 1-3 for a small
change and rarely more than 5). Tasks, file lists, and generic quality checks
belong in the plan, not the contract.

When the contract has no TODOs and the user is comfortable, run `specdev
checkpoint brainstorm`. Brainstorm review is optional by default:
`specdev reviewloop brainstorm`.

Review policy may be set at creation or approval with
`--brainstorm-review=optional|required` and
`--implementation-review=required|waived`; approval freezes it. A waiver never
waives acceptance evidence.

Before requesting agreement, show the exact contract path and hash plus the
command's concise contract-preview bullets covering objective, scope, and key
acceptance criteria. Also show any verdict, textual changes, and divergence
classification. If review changed the contract, run `specdev checkpoint
brainstorm` once more to present the final hash. Only after explicit user
agreement run `specdev approve brainstorm`, then `specdev implement` for the
automatic section.

Announce every subtask with "Specdev: <action>".
