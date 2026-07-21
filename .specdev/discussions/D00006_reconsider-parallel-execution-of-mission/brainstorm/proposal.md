# Proposal: Parallel Mission child execution

Large Missions that already require several child Assignments should finish faster by running semantically independent children concurrently. Parallelism is an execution optimization only: it must not encourage additional decomposition, change the approved Mission authority, or require users to configure scheduler settings.

Mission Design will place already-justified children into static waves. The foreground Mission controller will automatically run up to three children from the current wave in isolated Git worktrees, preserve the ordinary Assignment lifecycle for each child, and integrate reviewed delivery commits into the Mission branch in declared order as soon as they become eligible. RippleGraph remains a static lifecycle engine; it records the Mission's wave-level stage while each worktree runs an independent Assignment graph.
