# Claude Reviewer Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Add a `claude.json` reviewer configuration that launches Claude Code as an external reviewer via `specdev reviewloop`.

**Architecture:** Config-only change. A single JSON file is added to both the local project reviewers directory and the templates directory for distribution via `specdev init`. The existing pluggable reviewer system handles everything else.

**Tech Stack:** JSON config files, Node.js test framework (existing custom test harness)

---

### Task 1: Add claude.json reviewer config to templates
**Mode:** standard
**Skills:** test-driven-development
**Files:**
- Test: `tests/test-reviewloop.js` (modify — add claude.json assertions)
- Create: `templates/.specdev/skills/core/reviewloop/reviewers/claude.json`

**Step 1: Write the failing test**

Add to `tests/test-reviewloop.js` after the cursor.json test block (after line 46):

```javascript
const claudeConfig = join(TEST_DIR, '.specdev', 'skills', 'core', 'reviewloop', 'reviewers', 'claude.json')
assert(existsSync(claudeConfig), 'claude.json reviewer config exists')

if (existsSync(claudeConfig)) {
  const claudeContent = JSON.parse(readFileSync(claudeConfig, 'utf-8'))
  assert(claudeContent.name === 'claude', 'claude.json has name=claude')
  assert(claudeContent.command && claudeContent.command.includes('claude'), 'claude.json command includes claude')
  assert(claudeContent.command && claudeContent.command.includes('--dangerously-skip-permissions'), 'claude.json command includes --dangerously-skip-permissions')
  assert(typeof claudeContent.max_rounds === 'number', 'claude.json has numeric max_rounds')
}
```

**Step 2: Run test to verify it fails**
Run: `node tests/test-reviewloop.js`
Expected: FAIL with "claude.json reviewer config exists"

**Step 3: Write minimal implementation**

Create `templates/.specdev/skills/core/reviewloop/reviewers/claude.json`:

```json
{
  "name": "claude",
  "command": "claude --dangerously-skip-permissions -p \"Run specdev review $SPECDEV_PHASE --round $SPECDEV_ROUND. Follow its instructions.\"",
  "max_rounds": 3
}
```

**Step 4: Run test to verify it passes**
Run: `node tests/test-reviewloop.js`
Expected: PASS (all assertions including new claude.json ones)

**Step 5: Commit**
```
git add templates/.specdev/skills/core/reviewloop/reviewers/claude.json tests/test-reviewloop.js
git commit -m "feat: add claude reviewer config"
```

---

### Task 2: Add claude.json to local project reviewers
**Mode:** lightweight
**Skills:** none
**Files:**
- Create: `.specdev/skills/core/reviewloop/reviewers/claude.json`

**Step 1: Create the file**

Copy the same config to `.specdev/skills/core/reviewloop/reviewers/claude.json`:

```json
{
  "name": "claude",
  "command": "claude --dangerously-skip-permissions -p \"Run specdev review $SPECDEV_PHASE --round $SPECDEV_ROUND. Follow its instructions.\"",
  "max_rounds": 3
}
```

**Step 2: Verify**
Run: `node tests/test-reviewloop.js`
Expected: PASS (all tests still pass)

**Step 3: Commit**
```
git add .specdev/skills/core/reviewloop/reviewers/claude.json
git commit -m "feat: add claude reviewer to local project"
```
