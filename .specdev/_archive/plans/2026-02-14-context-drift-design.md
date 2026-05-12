# Context Drift Detection & Enforcement

**Problem:** In long conversations, coding agents silently stop following the specdev workflow. The user has no way to notice or correct this.

**Solution:** Three lightweight mechanisms that work together.

---

## 1. Detection: "Using specdev:" prefix

Add an instruction to the adapter file (CLAUDE.md / AGENTS.md) requiring the agent to announce every subtask with "Using specdev: <action>". When the prefix disappears, the user knows the agent has drifted.

**Change:** Update `adapterContent()` in `src/commands/init.js` to include:

```
IMPORTANT: Before starting any subtask, announce "Using specdev: <what you're doing>".
If you stop announcing subtasks, the user will assume you've stopped following the workflow.
```

Existing projects pick this up via `specdev update`.

## 2. Enforcement: `specdev remind` command

A new CLI command that outputs a compact, phase-aware context refresh. The user runs it when they notice drift (or instructs the agent to run it periodically).

**Output format:**

```
📍 00003_feature_auth — implementation phase

   Completed: proposal.md, plan.md
   Current:   3/5 tasks done
   Next:      Complete remaining tasks, then request gate 3 review

Rules for this phase:
   • TDD: write failing test → make it pass → refactor
   • No completion claims without running tests
   • One task at a time via subagents
   • When done: specdev work request --gate=gate_3

IMPORTANT: Announce every subtask with "Using specdev: <action>"
```

**How it works:**
- Resolves current assignment using existing `resolveAssignmentPath()` from `src/utils/assignment.js`
- Scans state using existing `scanSingleAssignment()` from `src/utils/scan.js`
- Determines current phase from which phase files exist (last existing file = current phase)
- Phase-specific rules are hardcoded strings — a simple map from phase name to 3-5 bullets

**Edge cases:**
- No `.specdev/` → "Run `specdev init` first"
- No assignments → "No active assignments found"
- Multiple assignments → Uses latest (same as `specdev work`)

**Files:**
- Create: `src/commands/remind.js`
- Modify: `bin/specdev.js` (add `remind` route)

## 3. Durability: Quick-ref blockquote in `_main.md`

Add a compact rules summary at the very top of `_main.md`, before "Getting Started". Being first in the file means it survives context compression longest.

```markdown
> **Quick ref:** 5 phases (brainstorm → breakdown → implement → verify → capture).
> TDD always. No completion claims without evidence. Announce subtasks with
> "Using specdev: <action>". When stuck: `specdev remind`.
```

The existing "Rules That Always Apply" section at the bottom stays as-is.

**Files:**
- Modify: `templates/.specdev/_main.md`
