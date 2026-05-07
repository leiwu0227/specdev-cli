# Workflow Status JSON Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Add `specdev status --json` as a reliable machine-readable workflow state command.

**Architecture:** Reuse the existing `continue` state detection path rather than duplicating workflow logic. Add a thin `status` command that emits a normalized JSON payload with current assignment, state, gates, artifacts, blockers, progress, and next action.

**Tech Stack:** Node.js ESM CLI, `fs-extra`, existing SpecDev command and utility modules, existing test helpers.

**Execution Mode:** inline

---

### Task 1: Add `specdev status --json`
**Mode:** full
**Skills:** [test-driven-development]
**Files:** Create `src/commands/status.js`; Modify `src/commands/dispatch.js`, `src/utils/commands.js`, `src/commands/help.js`; Test `tests/test-workflow.js`

**Step 1: Write the failing tests**
Add tests to `tests/test-workflow.js` near the existing continue-state tests:

```js
console.log('\nstatus --json:')

let statusOut = runCmd(['status', '--json', `--target=${TEST_DIR}`])
assert(statusOut.status === 0, 'status --json exits 0 for active assignment', statusOut.stderr)
let statusJson = JSON.parse(statusOut.stdout)
assert(statusJson.command === 'status', 'status payload identifies command')
assert(statusJson.assignment === '00001_feature_brainstorm', 'status includes assignment')
assert(statusJson.kind === 'assignment', 'status includes kind')
assert(statusJson.gates.brainstorm === 'approved', 'status includes brainstorm gate')
assert(statusJson.artifacts['brainstorm/proposal.md'] === 'present', 'status includes artifact status')
assert(statusJson.next_action, 'status includes next_action')

let statusText = runCmd(['status', `--target=${TEST_DIR}`])
assert(statusText.status === 0, 'status text exits 0', statusText.stderr)
assert(statusText.stdout.includes('SpecDev Status'), 'status text has heading')
assert(statusText.stdout.includes('Next Action:'), 'status text includes next action')
```

Also add a no-assignment JSON assertion after the existing `.current` clear test:

```js
let statusNoCurrent = runCmd(['status', '--json', `--target=${TEST_DIR}`])
assert(statusNoCurrent.status === 1, 'status --json exits non-zero without current assignment')
let statusNoCurrentJson = JSON.parse(statusNoCurrent.stdout)
assert(statusNoCurrentJson.command === 'status', 'blocked status payload identifies command')
assert(statusNoCurrentJson.status === 'blocked', 'blocked status preserves status')
```

**Step 2: Run tests to verify they fail**
Run: `npm test -- tests/test-workflow.js`
Expected: FAIL with `Unknown command: status` or missing status assertions.

**Step 3: Write minimal implementation**
Create `src/commands/status.js`:

```js
import { continueCommand, buildStatusPayload } from './continue.js'
import { printKeyValue, printListSection } from '../utils/output.js'

export async function statusCommand(flags = {}) {
  if (flags.json) {
    return continueCommand({ ...flags, json: true, statusPayload: true })
  }

  return continueCommand({ ...flags, statusPayload: true, statusText: true })
}
```

Modify `src/commands/continue.js` to export a pure payload adapter and support status rendering:

```js
export function buildStatusPayload(payload) {
  return {
    command: 'status',
    version: payload.version,
    status: payload.status,
    kind: payload.assignment ? 'assignment' : null,
    assignment: payload.assignment || null,
    assignment_path: payload.assignment_path || null,
    selected_by: payload.selected_by || null,
    state: payload.state,
    gates: payload.gates || null,
    artifacts: payload.artifacts || null,
    blockers: payload.blockers || [],
    progress: payload.progress || null,
    review_feedback: payload.review_feedback || null,
    review_logs: payload.review_logs || [],
    distill_pending: payload.distill_pending || null,
    next_action: payload.next_action,
  }
}
```

Enhance `buildContinuePayload()` with `gates` and `artifacts` derived from existing assignment path checks. Keep existing `continue --json` compatible by adding fields rather than removing fields.

Modify `emit()` so when `flags.statusPayload` is set it emits `buildStatusPayload(payload)`, and when `flags.statusText` is set the heading is `SpecDev Status`.

Wire command dispatch:

```js
import { statusCommand } from './status.js'
// commandHandlers.status = ...
```

Add `status` to `src/utils/commands.js` and the help workflow list.

**Step 4: Run tests to verify it passes**
Run: `npm test -- tests/test-workflow.js`
Expected: PASS for workflow tests.

**Step 5: Run broader verification**
Run: `npm test`
Expected: PASS.

**Step 6: Commit**
Run:

```bash
git add src/commands/status.js src/commands/continue.js src/commands/dispatch.js src/utils/commands.js src/commands/help.js tests/test-workflow.js .specdev/assignments/00008_feature_workflow-status-json
git commit -m "feat: add workflow status json command"
```
