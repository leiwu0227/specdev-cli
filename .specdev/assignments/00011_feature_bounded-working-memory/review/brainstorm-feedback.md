# Brainstorm Review: Bounded Working Memory

## Round 1

**Verdict:** needs-changes

### Findings

1. [F1.1] **Command family routing inconsistency.** The design says `specdev memory refresh` as a new command family, but dispatch.js uses two distinct patterns: `distill` is handled inline with an if-block before the command map (lines 43-52), while `skills` is registered in `commandHandlers` and routes subcommands internally (skills.js lines 8-27). The design does not specify which pattern to follow. Since `skills` is the more recent and cleaner pattern (dynamic imports, default action on no subcommand), the design should explicitly state that `memory` will follow the `skills` pattern — registered in `commandHandlers` with subcommand dispatch inside the command module. This avoids expanding the special-case if-block in dispatch.js.

2. [F1.2] **Nudge in `distill done` assumes modification of a finalization command without addressing idempotency.** The design says `distill done` should "print a short nudge such as `Run specdev memory refresh`." Currently `distill done` emits only JSON to stdout (lines 79-82 of distill-done.js). Printing a human-readable nudge alongside JSON would break JSON-only consumers. The design should clarify: does the nudge go to stderr, or does it become a field in the JSON payload (e.g., `"hint": "Run specdev memory refresh"`)? Recommend adding it as a JSON field to keep stdout machine-parseable.

3. [F1.3] **Bounding strategy underspecified.** The design mentions `MAX_LINES = 80` or "a word limit around 800 words" but doesn't commit to one. These two strategies have different truncation behaviors — line-based truncation can cut mid-section while word-based truncation can be applied more granularly. The design should pick one (word-based is more natural for markdown sections of variable density) and specify the truncation priority order: which sections get shortened or dropped first when the limit is hit.

4. [F1.4] **"Newest 5 completed entries" source ambiguity.** The design says recent completed assignments come from `assignment_progress.md` or "scanned assignments." These are different data sources — `assignment_progress.md` is a curated narrative while `scanAssignments()` returns directory entries. The two may disagree on ordering and completeness. Pick one authoritative source. `scanAssignments()` plus `detectAssignmentState()` is the more reliable approach since it uses actual state detection rather than a hand-edited file.

### Addressed from changelog
- (none -- first round)

## Round 2

**Verdict:** approved

### Findings

1. [F2.1] **Magic number for recent completed assignments.** The design specifies "newest 5 completed assignments" but does not extract the `5` into a named constant. Given `MAX_WORKING_MEMORY_WORDS = 800` is already a named constant, the recent-assignments count should follow the same pattern (e.g., `MAX_RECENT_ASSIGNMENTS = 5`). This is a low-cost improvement that keeps the implementation consistent with the design's own precedent.

2. [F2.2] **Knowledge note selection strategy is ambiguous.** The design says "newest or alphabetically selected notes" without committing to one. These have different efficiency profiles: alphabetical requires only `readdir` + `sort` (O(n log n) string comparisons), while "newest" requires `stat()` on each file to get modification time (O(n) syscalls + sort). Alphabetical is simpler, more deterministic, and aligns better with the design's stated goal of deterministic generation. Recommend committing to alphabetical ordering unless there is a specific reason to prefer recency.

### Addressed from changelog
- F1.1: Verified — design now specifies `memory` follows the `skills` command pattern (register in `commandHandlers`, route subcommands in `src/commands/memory.js`). Confirmed `skills.js` uses this pattern at lines 7-28 with dynamic imports for subcommands.
- F1.2: Verified — design now specifies `memory_hint` as a JSON field in `distill done` output. Confirmed current `distill-done.js` lines 79-82 emit only `status` and `marked` fields, so the new field will extend rather than break the existing schema.
- F1.3: Verified — design commits to `MAX_WORKING_MEMORY_WORDS = 800` with explicit truncation priority order (header > project summary > current workflow > recent assignments > durable knowledge).
- F1.4: Verified — design now uses `scanAssignments()` + state detection as the authoritative source. Confirmed `scanAssignments()` in `src/utils/scan.js` returns structured objects with `phases`, `context`, and `tasks`, and `detectAssignmentState()` in `src/utils/state.js` provides state classification.
