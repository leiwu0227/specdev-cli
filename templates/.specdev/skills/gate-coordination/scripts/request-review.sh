#!/usr/bin/env bash
set -euo pipefail

# request-review.sh — Create a review request for an assignment gate
#
# Usage: request-review.sh <assignment-path> <gate> [notes]
#   gate: gate_3 or gate_4
# Output: Path to review_request.json
# Creates: review_request.json with version, assignment_id, gate, status=pending, timestamp, head_commit, changed_files
# Exit: 0 on success, 1 on error

ASSIGNMENT_PATH="${1:-}"
GATE="${2:-}"
NOTES="${3:-}"

if [ -z "$ASSIGNMENT_PATH" ] || [ ! -d "$ASSIGNMENT_PATH" ]; then
  echo "Error: assignment directory required" >&2
  echo "Usage: request-review.sh <assignment-path> <gate> [notes]" >&2
  exit 1
fi

if [ -z "$GATE" ]; then
  echo "Error: gate required (gate_3 or gate_4)" >&2
  echo "Usage: request-review.sh <assignment-path> <gate> [notes]" >&2
  exit 1
fi

case "$GATE" in
  gate_3|gate_4) ;;
  *)
    echo "Error: gate must be gate_3 or gate_4, got: $GATE" >&2
    exit 1
    ;;
esac

ASSIGNMENT_PATH=$(cd "$ASSIGNMENT_PATH" && pwd)
ASSIGNMENT_ID=$(basename "$ASSIGNMENT_PATH")
REQUEST_FILE="$ASSIGNMENT_PATH/review_request.json"

# Get HEAD commit if in a git repo
HEAD_COMMIT=""
if git rev-parse HEAD &>/dev/null; then
  HEAD_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
fi

# Get changed files (staged + unstaged) if in a git repo
CHANGED_FILES="[]"
if git rev-parse --is-inside-work-tree &>/dev/null; then
  CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      const files = d.trim().split('\n').filter(Boolean);
      console.log(JSON.stringify(files));
    });
  " 2>/dev/null || echo "[]")
fi

NOW=$(date -Iseconds)

# Write review_request.json
node -e "
  const fs = require('fs');
  const data = {
    version: '1',
    assignment_id: process.argv[1],
    gate: process.argv[2],
    status: 'pending',
    requested_at: process.argv[3],
    head_commit: process.argv[4],
    changed_files: JSON.parse(process.argv[5]),
    notes: process.argv[6] || ''
  };
  fs.writeFileSync(process.argv[7], JSON.stringify(data, null, 2));
" "$ASSIGNMENT_ID" "$GATE" "$NOW" "$HEAD_COMMIT" "$CHANGED_FILES" "$NOTES" "$REQUEST_FILE"

echo "$REQUEST_FILE"
