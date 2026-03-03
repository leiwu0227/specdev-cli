#!/usr/bin/env bash
set -euo pipefail

# poll-for-feedback.sh — Block until review-feedback.md appears
#
# Usage: poll-for-feedback.sh <assignment-path> <phase> [timeout-seconds]
# Blocks until review/review-feedback.md appears with matching phase
# Output: Contents of review-feedback.md
# Exit: 0 = feedback received, 1 = timeout or error

ASSIGNMENT_PATH="${1:-}"
PHASE="${2:-}"
TIMEOUT="${3:-1800}"

if [ -z "$ASSIGNMENT_PATH" ] || [ ! -d "$ASSIGNMENT_PATH" ]; then
  echo "Error: assignment directory required" >&2
  echo "Usage: poll-for-feedback.sh <assignment-path> <phase> [timeout-seconds]" >&2
  exit 1
fi

if [ -z "$PHASE" ]; then
  echo "Error: phase required (brainstorm, breakdown, implementation)" >&2
  exit 1
fi

ASSIGNMENT_PATH=$(cd "$ASSIGNMENT_PATH" && pwd)
FEEDBACK_FILE="$ASSIGNMENT_PATH/review/review-feedback.md"
ELAPSED=0
INTERVAL=5

echo "Waiting for review feedback (phase: $PHASE, timeout: ${TIMEOUT}s)..." >&2

while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  if [ -f "$FEEDBACK_FILE" ]; then
    # Check if feedback is for the right phase
    FEEDBACK_PHASE=$(grep '^\*\*Phase:\*\*' "$FEEDBACK_FILE" 2>/dev/null | sed 's/\*\*Phase:\*\* *//' | tr -d '[:space:]')
    if [ "$FEEDBACK_PHASE" = "$PHASE" ]; then
      cat "$FEEDBACK_FILE"
      exit 0
    fi
  fi
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo "Error: timeout waiting for review feedback after ${TIMEOUT}s" >&2
exit 1
