#!/usr/bin/env bash
set -euo pipefail

# scan-assignment.sh — Scan an assignment and produce a structured summary
#
# Usage: scan-assignment.sh <assignment-path>
# Output: Markdown summary (Goal, Approach, Key Decisions, Tasks Completed, Review Findings, Suggested Knowledge Categories)
# Exit: 0 on success, 1 on error

ASSIGNMENT_PATH="${1:-}"

if [ -z "$ASSIGNMENT_PATH" ] || [ ! -d "$ASSIGNMENT_PATH" ]; then
  echo "Error: assignment directory required" >&2
  echo "Usage: scan-assignment.sh <assignment-path>" >&2
  exit 1
fi

ASSIGNMENT_PATH=$(cd "$ASSIGNMENT_PATH" && pwd)
ASSIGNMENT_NAME=$(basename "$ASSIGNMENT_PATH")

echo "# Assignment Scan: $ASSIGNMENT_NAME"
echo ""

# --- Goal ---
echo "## Goal"
echo ""
if [ -f "$ASSIGNMENT_PATH/proposal.md" ]; then
  # Extract goal from proposal (first meaningful paragraph after any header)
  GOAL=$(sed -n '/^[^#]/p' "$ASSIGNMENT_PATH/proposal.md" | head -5)
  if [ -n "$GOAL" ]; then
    echo "$GOAL"
  else
    echo "_Could not extract goal from proposal.md_"
  fi
else
  echo "_No proposal.md found._"
fi
echo ""

# --- Approach ---
echo "## Approach"
echo ""
if [ -f "$ASSIGNMENT_PATH/plan.md" ]; then
  # Extract architecture/approach section
  APPROACH=$(grep -A 3 '^\*\*Architecture:\*\*\|^\*\*Approach:\*\*' "$ASSIGNMENT_PATH/plan.md" 2>/dev/null | head -5)
  if [ -n "$APPROACH" ]; then
    echo "$APPROACH"
  else
    echo "_See plan.md for approach details._"
  fi
else
  echo "_No plan.md found._"
fi
echo ""

# --- Key Decisions ---
echo "## Key Decisions"
echo ""
if [ -f "$ASSIGNMENT_PATH/context/decisions.md" ]; then
  cat "$ASSIGNMENT_PATH/context/decisions.md"
else
  echo "_No decisions.md found._"
fi
echo ""

# --- Tasks Completed ---
echo "## Tasks Completed"
echo ""
PROGRESS_FILES=$(find "$ASSIGNMENT_PATH" -name '*.progress.json' -type f 2>/dev/null || true)
if [ -n "$PROGRESS_FILES" ]; then
  for pf in $PROGRESS_FILES; do
    node -e "
      const fs = require('fs');
      const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf-8'));
      if (data.tasks) {
        data.tasks.forEach(t => {
          const status = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '→' : '○';
          console.log('- [' + status + '] Task ' + t.number + ': ' + t.status);
        });
      }
    " "$pf" 2>/dev/null || echo "_Could not parse progress file._"
  done
elif [ -f "$ASSIGNMENT_PATH/plan.md" ]; then
  TASK_COUNT=$(grep -c '^### Task [0-9]' "$ASSIGNMENT_PATH/plan.md" || true)
  echo "_$TASK_COUNT task(s) in plan (no progress tracking found)._"
else
  echo "_No progress information available._"
fi
echo ""

# --- Review Findings ---
echo "## Review Findings"
echo ""
if [ -f "$ASSIGNMENT_PATH/review_request.json" ]; then
  node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf-8'));
    console.log('- **Gate:** ' + (data.gate || 'unknown'));
    console.log('- **Status:** ' + (data.status || 'unknown'));
    console.log('- **Requested:** ' + (data.requested_at || 'unknown'));
  " "$ASSIGNMENT_PATH/review_request.json" 2>/dev/null || echo "_Could not parse review_request.json._"
else
  echo "_No review information found._"
fi
echo ""

# --- Suggested Knowledge Categories ---
echo "## Suggested Knowledge Categories"
echo ""
echo "Based on this assignment, consider capturing knowledge in:"
echo ""

# Check if there are code files to suggest codestyle
if [ -f "$ASSIGNMENT_PATH/plan.md" ]; then
  if grep -q 'Create:.*\.\(js\|ts\|py\|rs\|go\)' "$ASSIGNMENT_PATH/plan.md" 2>/dev/null; then
    echo "- **codestyle/** — Code conventions from new files created"
  fi
  if grep -qi 'architect\|component\|module\|pattern' "$ASSIGNMENT_PATH/plan.md" 2>/dev/null; then
    echo "- **architecture/** — Architecture decisions and patterns used"
  fi
  if grep -qi 'domain\|business\|rule\|constraint' "$ASSIGNMENT_PATH/plan.md" 2>/dev/null; then
    echo "- **domain/** — Domain rules and constraints discovered"
  fi
fi
echo "- **workflow/** — Process observations and improvements"
