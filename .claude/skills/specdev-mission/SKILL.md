---
name: specdev-mission
description: Create and run a Mission with explicit implementation ownership
---

Run `specdev mission create "<objective>"` and collaborate on the Mission
contract, including its exact final integrated verification command. Run
`specdev mission run M00001` to validate it, and run it again if review changed
the contract. Before requesting agreement, show the exact contract path and hash
plus the command's concise contract-preview bullets. Only after explicit
agreement run `specdev mission run M00001 --approve`.

Approval stops at an explicit implementation execution choice. Ask the user to
choose inline or spawned; never infer a default. Run the exact displayed
`specdev mission run M00001 --inline` or `--spawned` command. The choice is
frozen for the whole Mission.

For inline execution, stay in this main coding session. Whenever Mission run
returns `action_required`, read its selective context catalog and owning
artifacts, complete the bounded implementation or repair obligations directly,
and rerun the displayed Mission command. Do not create an implementation agent
or stop for routine user input. Spawned execution keeps implementation in
automatic workers; keep its controller command in the foreground until it ends
or reaches an existing explicit user gate.

When the user explicitly abandons an unwanted nonterminal Mission, run
`specdev mission abandon M00001 --reason="..."` to display the read-only plan.
Show that plan and wait for exact user confirmation before running its displayed
`--confirm=<plan-digest>` command. Abandonment preserves retained work and never
implies landing, deletion, or permission to revive the terminal Mission.

When starting a new Mission, read
`.specdev/project_notes/big_picture.md` unconditionally and search fresh living
knowledge once with Mission objective terms during planning. Record only
relevant result paths for the queue and child context. Children search again
only for child-specific unknowns or unexpected symptoms. Never bulk-load
knowledge or silently use stale/superseded entries. Default precise search uses
all terms and quoted phrases; narrow partial/noisy results and reserve
`--mode=broad` for deliberate any-term discovery. Treat matches as historical
leads and verify them in current code, including hard-coded counts, enumerated
families, and other closed-world assumptions. Route reusable constraints absent
from living knowledge through repository-evidence-bound, user-approved
`knowledge curate`; never bulk-index source or treat a match as current truth.

Keep the Mission contract proportional just like an Assignment contract. Do not
restate big-picture notes or turn implementation tasks into acceptance criteria.
Multi-child Assignment contracts are narrow deltas that inherit unchanged
Mission authority.

The controller starts with one full-scope child.
Set `Initial child plan: planned` in the contract only for a concrete
execution, dependency, decision, or verification boundary. Planned children
receive static waves. Inline implementation executes them sequentially in the
Mission worktree; spawned implementation may automatically use up to three
validated ignored worktrees for an independent wave and integrates in declared
order. Use
`--takeover` only after inspecting an interrupted controller.

Announce meaningful phases, plan changes, failed verification, and blockers
with "Specdev: <action>"; repeated read-only probes need no separate announcement.
