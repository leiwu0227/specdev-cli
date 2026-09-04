# Mission Execution and Waves

Parent design: `../mission_lane.md`

Mission execution converts the approved parent contract into bounded child Assignment
work while preserving one controller-owned integration boundary.

Planning starts with one full-scope child. Multiple children require a real authority,
dependency, rollback, verification, or product-ownership boundary. The persisted
queue records child objective, contract, dependencies, wave, status, attempt,
delivery, and integration facts. Replanning is allowed only through a durable gap and
cannot silently rewrite completed or approved child authority.

A wave is sequential unless every member is mutually independent. A parallel wave may
contain more than three children, but the scheduler runs no more than three at once.
Admission validates paths, dependencies, branch ancestry, worktree ownership,
reviewer policy, and final integration order. Each active parallel child receives an
ignored leased worktree and dedicated branch. Sequential children use the normal
Mission worktree and current integrated base.

The controller creates child Assignment authority, launches the worker, preserves the
Attempt result, runs candidate qualification and required review, and interprets the
strict child disposition. A reviewed success creates a child delivery commit. The
controller integrates the maximal valid prefix in declared order and verifies that
queue and Git transitions agree.

Failed evidence, review findings, conflicts, blocked providers, or required follow-up
open explicit Mission gaps. A gap records source, authority, status, resolution child,
and validation. Closing it requires evidence that the integrated parent candidate no
longer has the problem.

Final verification is selected from the approved command and execution policy. It is
run against the integrated candidate, recorded chronologically, and cannot be replaced
by child-only evidence. A negative observation remains evidence and opens follow-up
rather than being rewritten as success.

## Source Targets

- `src/utils/mission-execution.js` — maximum 550 lines — execution policy and verification evidence.
- `src/utils/mission-waves.js` — maximum 160 lines — wave normalization and integration ordering.
- `src/utils/mission-worktrees.js` — maximum 300 lines — bounded worktree and child-branch lifecycle.
- `src/utils/mission-gaps.js` — maximum 420 lines — durable convergence gaps and resolution links.
- `src/utils/mission-observation.js` — maximum 60 lines — evidence-only final observation validation.
