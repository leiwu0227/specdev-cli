# Design: Mission implementation execution choice

Immediately after approving a Mission Brainstorm contract, SpecDev asks the user to
choose `inline` or `spawned` implementation. The explicit choice has no silent default,
is stored on the Mission, freezes before implementation, and applies to every child
Assignment and implementation repair. Existing active Missions retain their legacy
spawned behavior.

Inline execution assigns all product implementation, review repair, and bounded
implementation resolver work to the current main coding session without creating an
implementation worker session. `specdev mission run` returns structured
`action_required` obligations at those boundaries; the Mission guide fulfills them
and reruns the durable controller automatically in the same coding conversation.
Direct terminal use returns the same safe obligations when no agent driver exists.

One inline owner means child implementation is sequential and uses the Mission
worktree, even when planned children share a wave. Spawned execution preserves the
current automatic workers, bounded parallel worktrees, and recovery behavior.

Reviewers remain separate read-only Attempts in both modes. The approved contracts,
delivery artifacts, evidence, Git facts, review gates, Mission convergence, and final
verification remain authoritative and recoverable without conversational memory.
