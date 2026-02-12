#!/usr/bin/env bash
set -euo pipefail

# get-assignment-context.sh — Gather full context for an assignment
#
# Usage: get-assignment-context.sh <assignment-path>
# Output: Markdown summary (proposal, plan, progress, decisions, tasks, review status)
# Exit: 0 on success, 1 on error

ASSIGNMENT_PATH="${1:-}"

if [ -z "$ASSIGNMENT_PATH" ] || [ ! -d "$ASSIGNMENT_PATH" ]; then
  echo "Error: assignment directory required" >&2
  echo "Usage: get-assignment-context.sh <assignment-path>" >&2
  exit 1
fi

ASSIGNMENT_PATH=$(cd "$ASSIGNMENT_PATH" && pwd)
ASSIGNMENT_NAME=$(basename "$ASSIGNMENT_PATH")

echo "# Assignment Context: $ASSIGNMENT_NAME"
echo ""

# --- Proposal ---
if [ -f "$ASSIGNMENT_PATH/proposal.md" ]; then
  echo "## Proposal"
  echo ""
  cat "$ASSIGNMENT_PATH/proposal.md"
  echo ""
else
  echo "## Proposal"
  echo ""
  echo "_No proposal.md found._"
  echo ""
fi

# --- Plan ---
if [ -f "$ASSIGNMENT_PATH/plan.md" ]; then
  echo "## Plan"
  echo ""
  cat "$ASSIGNMENT_PATH/plan.md"
  echo ""
else
  echo "## Plan"
  echo ""
  echo "_No plan.md found._"
  echo ""
fi

# --- Progress ---
PROGRESS_FILES=$(find "$ASSIGNMENT_PATH" -name '*.progress.json' -type f 2>/dev/null || true)
if [ -n "$PROGRESS_FILES" ]; then
  echo "## Progress"
  echo ""
  for pf in $PROGRESS_FILES; do
    PFNAME=$(basename "$pf")
    echo "### $PFNAME"
    echo '```json'
    cat "$pf"
    echo '```'
    echo ""
  done
fi

# --- Decisions ---
if [ -f "$ASSIGNMENT_PATH/context/decisions.md" ]; then
  echo "## Decisions"
  echo ""
  cat "$ASSIGNMENT_PATH/context/decisions.md"
  echo ""
fi

# --- Tasks ---
if [ -d "$ASSIGNMENT_PATH/tasks" ]; then
  TASK_FILES=$(find "$ASSIGNMENT_PATH/tasks" -name '*.md' -type f 2>/dev/null | sort || true)
  if [ -n "$TASK_FILES" ]; then
    echo "## Tasks"
    echo ""
    for tf in $TASK_FILES; do
      TFNAME=$(echo "$tf" | sed "s|^$ASSIGNMENT_PATH/tasks/||")
      echo "### $TFNAME"
      cat "$tf"
      echo ""
    done
  fi
fi

# --- Review Status ---
if [ -f "$ASSIGNMENT_PATH/review_request.json" ]; then
  echo "## Review Status"
  echo ""
  echo '```json'
  cat "$ASSIGNMENT_PATH/review_request.json"
  echo '```'
  echo ""
fi
