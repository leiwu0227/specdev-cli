# Implementation Feedback: Bounded Working Memory

## Round 1

**Verdict:** needs-changes

### Findings

1. [F1.1] **CRITICAL** — `readCurrentWorkflow` does not check the `error` field from `resolveCurrentAssignment`.

   `resolveCurrentAssignment()` never returns `null` — it returns `{ error: 'missing' }` or `{ error: 'stale', name }` on failure. The guard at `working-memory.js:67` (`if (!current) return null`) is always false. The code works accidentally because `current.path` is `undefined` for error cases, causing `scanSingleAssignment(undefined, undefined)` to throw, which the surrounding `try/catch` catches and returns `null`.

   Every other caller in the codebase (e.g., `assignment.js:73`, `continue.js:279`) checks `current.error` explicitly. This should do the same:

   ```js
   if (current.error) return null
   ```

   **Why it matters:** If `scanSingleAssignment` ever becomes defensive about `undefined` inputs (returns `null` instead of throwing), this code path would try to call `detectAssignmentState` on a null summary with an undefined path, producing garbage output in the "Current Workflow" section rather than gracefully omitting it.

2. [F1.2] **MINOR** — `formatList` wraps the empty-message in a list item (`- No completed assignments found.`), making it render as a bullet point rather than prose. Low impact since the output is machine-consumed, but worth noting for consistency with the rest of the markdown which uses prose for empty states.

### Addressed from changelog
- (none -- first round)

## Round 2

**Verdict:** approved

**Review focus:** Code efficiency — dead code, imperative vs functional, magic numbers, pure functions, Big O complexity.

### Findings

1. [F2.1] **MINOR** — Magic number `3` in `boundSections` (`working-memory.js:136,140`).

   The `while` guards use `knowledge.length > 3` and `assignments.length > 3` to stop trimming when a section is down to its structural minimum (empty line + heading + one content line). The value is correct but the meaning is implicit. A named constant like `MIN_SECTION_LINES = 3` would make the floor self-documenting.

   Not worth a code change on its own — the function is short and the meaning is clear from context. Noting for completeness.

### Addressed from changelog
- F1.1: `readCurrentWorkflow` now checks `current.error` (line 67), matching every other caller of `resolveCurrentAssignment`. Verified correct.
- F1.2: `formatList` now returns plain prose for empty states instead of a bullet item. Verified correct.

### Efficiency observations (no action needed)
- Constants are properly extracted: `MAX_WORKING_MEMORY_WORDS`, `MAX_RECENT_ASSIGNMENTS`, `KNOWLEDGE_BRANCHES`, `BIG_PICTURE_WORD_LIMIT`.
- Side effects are isolated to command handlers; `buildWorkingMemory` and its helpers are pure (read-only I/O, no mutations).
- `boundSections` rebuilds the full string on each trim iteration, but content is bounded to ~800 words, making this trivially fast.
- `readRecentCompletedAssignments` runs `detectAssignmentState` sequentially rather than in parallel. Acceptable — assignment count is small and sequential I/O is simpler.
- No dead code found. No unused imports or unreachable branches.
