#!/usr/bin/env bash
set -euo pipefail

# poll-review.sh — Check the current review status for an assignment
#
# Usage: poll-review.sh <assignment-path>
# Output: JSON {"status": "pending|in_progress|passed|failed", "gate": "...", ...}
# Exit: 0 on success, 1 if no review_request.json

ASSIGNMENT_PATH="${1:-}"

if [ -z "$ASSIGNMENT_PATH" ] || [ ! -d "$ASSIGNMENT_PATH" ]; then
  echo "Error: assignment directory required" >&2
  echo "Usage: poll-review.sh <assignment-path>" >&2
  exit 1
fi

ASSIGNMENT_PATH=$(cd "$ASSIGNMENT_PATH" && pwd)
REQUEST_FILE="$ASSIGNMENT_PATH/review_request.json"

if [ ! -f "$REQUEST_FILE" ]; then
  echo "Error: no review_request.json found in $ASSIGNMENT_PATH" >&2
  exit 1
fi

# Read and output the current review status
node -e "
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf-8'));
  const summary = {
    status: data.status,
    gate: data.gate,
    assignment_id: data.assignment_id,
    requested_at: data.requested_at,
    head_commit: data.head_commit
  };
  console.log(JSON.stringify(summary, null, 2));
" "$REQUEST_FILE"
