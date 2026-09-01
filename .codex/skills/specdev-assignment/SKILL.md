---
name: specdev-assignment
description: Create an Assignment and collaborate on its single contract
---

Run `specdev assignment "<objective>"`. Collaborate directly with the user in
`brainstorm/contract.md`; do not spawn a Brainstorm author.

When starting a new Assignment, read
`.specdev/project_notes/big_picture.md` unconditionally, then run one bounded
`specdev knowledge search "<objective terms>"` while shaping the contract.
Read only relevant fresh result paths, keep repository instructions and the
approved contract authoritative, and never bulk-load the knowledge directory.
Carry relevant paths into contract context or the implementation plan. Search
again with symptom terms after an unexpected failure. Precise all-term and
quoted-phrase matching is the default; narrow partial or noisy results first and
use `--mode=broad` only for deliberate any-term discovery. Results are
historical investigation leads, not current authority: inspect relevant current
code and look for hard-coded counts, enumerated families, and other closed-world
assumptions. Route reusable constraints missing from living knowledge through a
repository-evidence-bound, user-approved `knowledge curate` proposal; never
bulk-index source or publish the search result itself. Stale results require
explicit retrieval and revalidation.

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

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
