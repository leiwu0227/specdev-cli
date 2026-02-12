#!/usr/bin/env bash
set -euo pipefail

# validate-plan.sh — Check a plan document for completeness
#
# Usage: validate-plan.sh <plan-file>
# Output: Validation report to stdout, errors to stderr
# Exit: 0 if all checks pass, 1 if any fail

PLAN_FILE="${1:-}"

if [ -z "$PLAN_FILE" ] || [ ! -f "$PLAN_FILE" ]; then
  echo "Error: plan file required and must exist" >&2
  echo "Usage: validate-plan.sh <plan-file>" >&2
  exit 1
fi

FAILURES=0
WARNINGS=0

fail() {
  echo "  FAIL: $1" >&2
  FAILURES=$((FAILURES + 1))
}

warn() {
  echo "  WARN: $1"
  WARNINGS=$((WARNINGS + 1))
}

pass() {
  echo "  OK: $1"
}

CONTENT=$(cat "$PLAN_FILE")

echo "Validating: $PLAN_FILE"
echo ""

# --- Header checks ---
echo "Header:"

if echo "$CONTENT" | grep -q '^\*\*Goal:\*\*'; then
  GOAL=$(echo "$CONTENT" | grep '^\*\*Goal:\*\*' | sed 's/\*\*Goal:\*\*\s*//')
  if [ -z "$GOAL" ] || echo "$GOAL" | grep -q '\['; then
    fail "Goal is placeholder — fill it in"
  else
    pass "Goal present"
  fi
else
  fail "missing **Goal:** in header"
fi

if echo "$CONTENT" | grep -q 'specdev:executing\|executing-plans\|executing skill'; then
  pass "Execution instruction present"
else
  fail "missing execution instruction in header (should reference specdev:executing)"
fi

# --- Task checks ---
TASK_HEADERS=$(echo "$CONTENT" | grep -c '^### Task [0-9]' || true)

if [ "$TASK_HEADERS" -eq 0 ]; then
  fail "no tasks found (expected ### Task N: headers)"
  echo ""
  echo "Result: ${FAILURES} failures, ${WARNINGS} warnings"
  exit 1
fi

echo ""
echo "Tasks: $TASK_HEADERS found"

TASK_NUM=0
while IFS= read -r line; do
  TASK_NUM=$((TASK_NUM + 1))
  TASK_NAME=$(echo "$line" | sed 's/^### Task [0-9]*:\s*//')

  # Extract task section (from this header to next task header or end)
  TASK_SECTION=$(echo "$CONTENT" | sed -n "/^### Task ${TASK_NUM}:/,/^### Task $((TASK_NUM + 1)):/p" | head -n -1)
  if [ -z "$TASK_SECTION" ]; then
    # Last task — extract to end of file
    TASK_SECTION=$(echo "$CONTENT" | sed -n "/^### Task ${TASK_NUM}:/,\$p")
  fi

  echo ""
  echo "Task $TASK_NUM: $TASK_NAME"

  # Check for **Files:** section
  if echo "$TASK_SECTION" | grep -q '^\*\*Files:\*\*'; then
    pass "Files section present"
  else
    fail "Task $TASK_NUM missing **Files:** section"
  fi

  # Check for code blocks (need at least 2: test + implementation)
  CODE_BLOCKS=$(echo "$TASK_SECTION" | grep -c '^\`\`\`' || true)
  # Code blocks come in pairs (open + close), so divide by 2
  CODE_BLOCK_COUNT=$((CODE_BLOCKS / 2))
  if [ "$CODE_BLOCK_COUNT" -ge 2 ]; then
    pass "$CODE_BLOCK_COUNT code blocks"
  else
    fail "Task $TASK_NUM has $CODE_BLOCK_COUNT code blocks (need at least 2: test + implementation)"
  fi

  # Check for Run: commands
  RUN_COMMANDS=$(echo "$TASK_SECTION" | grep -c '^Run:' || true)
  if [ "$RUN_COMMANDS" -ge 1 ]; then
    pass "$RUN_COMMANDS run commands"
  else
    fail "Task $TASK_NUM missing Run: commands (need at least 1 test command)"
  fi

  # Check for Expected: output
  EXPECTED=$(echo "$TASK_SECTION" | grep -c '^Expected:' || true)
  if [ "$EXPECTED" -ge 1 ]; then
    pass "Expected output specified"
  else
    warn "Task $TASK_NUM missing Expected: output"
  fi

  # Check for commit step
  if echo "$TASK_SECTION" | grep -q 'git commit'; then
    pass "Commit step present"
  else
    warn "Task $TASK_NUM missing commit step"
  fi

done <<< "$(echo "$CONTENT" | grep '^### Task [0-9]')"

echo ""
echo "Result: $TASK_HEADERS tasks, ${FAILURES} failures, ${WARNINGS} warnings"

if [ "$FAILURES" -gt 0 ]; then
  exit 1
fi

exit 0
