# Structured Workflow Feedback Notes Implementation Plan

> **For agent:** Implement this plan task-by-task using TDD discipline.

**Goal:** Make SpecDev workflow feedback accumulate through structured Markdown notes instead of loose, ad hoc observations.

**Architecture:** Keep `capture/workflow-diff.md` as the assignment-local reflection artifact. Add a reusable workflow feedback note template under `templates/.specdev/_templates/`, update source-of-truth template guidance in `templates/.specdev/skills/core/knowledge-capture/SKILL.md` and `templates/.specdev/knowledge/_index.md`, and verify the template is installed through the normal init/update copy paths.

**Tech Stack:** Node.js ESM CLI, plain Node test scripts, Markdown templates copied from `templates/.specdev/`.

**Execution Mode:** inline

---

### Task 1: Add Installed Workflow Feedback Note Template

**Mode:** standard
**Skills:** test-driven-development
**Files:** Modify `tests/test-init.js`; create `templates/.specdev/_templates/workflow_feedback_note.md`

**Step 1: Write the failing test**
Modify `tests/test-init.js` in the `essentialFiles` array:

```js
  '.specdev/_templates/workflow_feedback_note.md',
```

After the existing `_main.md` assertions, add:

```js
const workflowFeedbackTemplate = readFileSync(join(TEST_DIR, '.specdev', '_templates', 'workflow_feedback_note.md'), 'utf-8')
assert(workflowFeedbackTemplate.includes('Status: open | mitigated | resolved'), 'workflow feedback template includes status field')
assert(workflowFeedbackTemplate.includes('Proposed Action'), 'workflow feedback template includes proposed action section')
```

**Step 2: Run test to verify it fails**
Run: `node ./tests/test-init.js`
Expected: FAIL because `.specdev/_templates/workflow_feedback_note.md` is missing.

**Step 3: Write minimal implementation**
Create `templates/.specdev/_templates/workflow_feedback_note.md`:

```markdown
# Short Workflow Feedback Title

Status: open | mitigated | resolved
Type: issue | improvement | recurring-pattern
Severity: minor | moderate | major
First seen: YYYY-MM-DD, assignment-name
Last seen: YYYY-MM-DD, assignment-name
Assignments observed: assignment-a, assignment-b

## Observation
- What happened, with concrete workflow, CLI, or skill behavior.

## Impact
- Why it matters for agents or users.

## Current Mitigation
- How agents should handle it today.

## Proposed Action
- none | monitor | update-guidance | create-assignment
```

**Step 4: Run test to verify it passes**
Run: `node ./tests/test-init.js`
Expected: PASS.

**Step 5: Commit**
Run:
```bash
git add tests/test-init.js templates/.specdev/_templates/workflow_feedback_note.md
git commit -m "feat: add workflow feedback note template"
```

### Task 2: Update Knowledge Capture Guidance

**Mode:** full
**Skills:** test-driven-development
**Files:** Modify `tests/test-init.js`, `templates/.specdev/skills/core/knowledge-capture/SKILL.md`, `templates/.specdev/knowledge/_index.md`

**Step 1: Write the failing test**
Add assertions to `tests/test-init.js` after reading installed template files:

```js
const knowledgeCaptureSkill = readFileSync(join(TEST_DIR, '.specdev', 'skills', 'core', 'knowledge-capture', 'SKILL.md'), 'utf-8')
assert(knowledgeCaptureSkill.includes('Classify workflow observations'), 'knowledge-capture explains workflow observation classification')
assert(knowledgeCaptureSkill.includes('workflow_feedback_note.md'), 'knowledge-capture references workflow feedback template')
assert(knowledgeCaptureSkill.includes('update it instead of creating a duplicate'), 'knowledge-capture explains feedback accumulation')

const knowledgeIndex = readFileSync(join(TEST_DIR, '.specdev', 'knowledge', '_index.md'), 'utf-8')
assert(knowledgeIndex.includes('project-specific process knowledge'), 'knowledge index distinguishes project workflow knowledge')
assert(knowledgeIndex.includes('SpecDev workflow itself'), 'knowledge index distinguishes SpecDev workflow feedback')
```

**Step 2: Run test to verify it fails**
Run: `node ./tests/test-init.js`
Expected: FAIL until the installed template guidance contains the new text.

**Step 3: Write minimal implementation**
In `templates/.specdev/skills/core/knowledge-capture/SKILL.md`, replace Step 5 items 4-6 with guidance that:

- writes normal project knowledge to `knowledge/codestyle/`, `knowledge/architecture/`, `knowledge/domain/`, and `knowledge/workflow/`;
- adds a `Classify workflow observations` subsection;
- sends project-local process patterns to `knowledge/workflow/`;
- sends SpecDev workflow/product issues to `knowledge/workflow_feedback/`;
- leaves one-off low-value observations only in `capture/workflow-diff.md`;
- tells agents to search existing workflow feedback first and update it instead of creating a duplicate;
- references `_templates/workflow_feedback_note.md`;
- says severe or recurring issues should use `Proposed Action: create-assignment`.

In `templates/.specdev/knowledge/_index.md`, update the `workflow/` branch description to mention project-specific process knowledge and tighten the `Workflow Feedback` section around SpecDev workflow itself.

**Step 4: Run test to verify it passes**
Run: `node ./tests/test-init.js`
Expected: PASS.

**Step 5: Commit**
Run:
```bash
git add tests/test-init.js templates/.specdev/skills/core/knowledge-capture/SKILL.md templates/.specdev/knowledge/_index.md
git commit -m "docs: structure workflow feedback accumulation"
```

### Task 3: Verify Distill Compatibility and Release Metadata

**Mode:** full
**Skills:** test-driven-development
**Files:** Modify `package.json`; verify `tests/test-distill.js`

**Step 1: Write the failing test**
No new distill behavior is intended. Use existing compatibility tests as the regression suite.

**Step 2: Run targeted tests**
Run: `node ./tests/test-init.js && node ./tests/test-update.js && node ./tests/test-distill.js`
Expected: PASS.

**Step 3: Update release metadata**
Modify `package.json`:

```json
  "releaseDate": "2026-05-10",
```

**Step 4: Run final verification**
Run: `node ./tests/test-init.js && node ./tests/test-update.js && node ./tests/test-distill.js`
Expected: PASS.

If practical, run:
```bash
npm test
```
Expected: PASS, unless the known `test-reviewloop-command.js` hang appears. If it hangs, record the blocker and rely on targeted tests.

**Step 5: Commit**
Run:
```bash
git add package.json .specdev/assignments/00016_refactor_distill-workflow
git commit -m "chore: update release date for workflow feedback format"
```
