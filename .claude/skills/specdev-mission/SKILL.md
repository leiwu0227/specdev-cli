---
name: specdev-mission
description: Create and run a foreground Mission with automatic bounded waves
---

Run `specdev mission create "<objective>"` and collaborate on the Mission
contract, including its exact final integrated verification command. Run
`specdev mission run M00001` to validate it, and run it again if review changed
the contract. Before requesting agreement, show the exact contract path and hash
plus the command's concise contract-preview bullets. Only after explicit
agreement run `specdev mission run M00001 --approve`.

Keep the Mission contract proportional just like an Assignment contract. Do not
restate big-picture notes or turn implementation tasks into acceptance criteria.
Multi-child Assignment contracts are narrow deltas that inherit unchanged
Mission authority.

The controller stays in the foreground and starts with one full-scope child.
Set `Initial child plan: planned` in the contract only for a concrete
execution, dependency, decision, or verification boundary. Planned children
receive static waves; independent children in one wave automatically use up to
three validated ignored worktrees and integrate in declared order. Use
`--takeover` only after inspecting an interrupted controller.

Announce every subtask with "Specdev: <action>".
