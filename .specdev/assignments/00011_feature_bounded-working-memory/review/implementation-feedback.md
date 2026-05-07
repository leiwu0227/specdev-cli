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
