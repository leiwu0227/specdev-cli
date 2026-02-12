#!/usr/bin/env bash
set -euo pipefail

# scaffold-plan.sh — Create a plan file with the standard header template
#
# Usage: scaffold-plan.sh <plan-name> <project-root>
# Output: Path to created file on stdout
# Exit: 0 on success, 1 on error (including if file already exists)

PLAN_NAME="${1:-}"
PROJECT_ROOT="${2:-}"

if [ -z "$PLAN_NAME" ] || [ -z "$PROJECT_ROOT" ]; then
  echo "Error: plan name and project root required" >&2
  echo "Usage: scaffold-plan.sh <plan-name> <project-root>" >&2
  exit 1
fi

PROJECT_ROOT=$(cd "$PROJECT_ROOT" && pwd)
TODAY=$(date +%Y-%m-%d)
PLANS_DIR="$PROJECT_ROOT/docs/plans"
PLAN_FILE="$PLANS_DIR/${TODAY}-${PLAN_NAME}.md"

# Don't overwrite existing plans
if [ -f "$PLAN_FILE" ]; then
  echo "Error: plan already exists: $PLAN_FILE" >&2
  exit 1
fi

# Create directory if needed
mkdir -p "$PLANS_DIR"

# Write the plan template
cat > "$PLAN_FILE" << 'TEMPLATE'
# [Feature Name] Implementation Plan

> **For agent:** Use specdev:executing skill to implement this plan task-by-task.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---

### Task 1: [Component Name]

**Files:**
- Create: `exact/path/to/file.ext`
- Modify: `exact/path/to/existing.ext`
- Test: `tests/exact/path/to/test.ext`

**Step 1: Write the failing test**

```
[Complete test code here]
```

**Step 2: Run test to verify it fails**

Run: `[exact command]`
Expected: FAIL with "[specific error]"

**Step 3: Write minimal implementation**

```
[Complete implementation code here]
```

**Step 4: Run test to verify it passes**

Run: `[exact command]`
Expected: PASS

**Step 5: Commit**

```bash
git add [files]
git commit -m "[type]: [description]"
```
TEMPLATE

echo "$PLAN_FILE"
