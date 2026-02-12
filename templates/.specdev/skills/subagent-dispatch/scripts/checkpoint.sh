#!/usr/bin/env bash
set -euo pipefail

# checkpoint.sh — Save, restore, or check dispatch progress state
#
# Usage: checkpoint.sh <action> <assignment-path>
#   actions: save, restore, status
# State: Creates/updates checkpoint.json in assignment directory
# Output: JSON (save/status) or markdown summary (restore)
# Exit: 0 on success, 1 on error

ACTION="${1:-}"
ASSIGNMENT_PATH="${2:-}"

if [ -z "$ACTION" ] || [ -z "$ASSIGNMENT_PATH" ]; then
  echo "Error: action and assignment path required" >&2
  echo "Usage: checkpoint.sh <action> <assignment-path>" >&2
  echo "  actions: save, restore, status" >&2
  exit 1
fi

if [ ! -d "$ASSIGNMENT_PATH" ]; then
  echo "Error: assignment directory not found: $ASSIGNMENT_PATH" >&2
  exit 1
fi

ASSIGNMENT_PATH=$(cd "$ASSIGNMENT_PATH" && pwd)
CHECKPOINT_FILE="$ASSIGNMENT_PATH/checkpoint.json"

case "$ACTION" in
  save)
    NOW=$(date -Iseconds)

    # Count completed tasks from progress file if it exists
    COMPLETED=0
    TOTAL=0
    PROGRESS_FILES=$(find "$ASSIGNMENT_PATH" -name '*.progress.json' -type f 2>/dev/null || true)
    if [ -n "$PROGRESS_FILES" ]; then
      for pf in $PROGRESS_FILES; do
        RESULT=$(node -e "
          const fs = require('fs');
          const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf-8'));
          const completed = data.tasks ? data.tasks.filter(t => t.status === 'completed').length : 0;
          const total = data.tasks ? data.tasks.length : 0;
          console.log(completed + ' ' + total);
        " "$pf" 2>/dev/null || echo "0 0")
        COMPLETED=$((COMPLETED + $(echo "$RESULT" | cut -d' ' -f1)))
        TOTAL=$((TOTAL + $(echo "$RESULT" | cut -d' ' -f2)))
      done
    fi

    # Get HEAD commit
    HEAD_COMMIT=""
    if git rev-parse HEAD &>/dev/null; then
      HEAD_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
    fi

    node -e "
      const fs = require('fs');
      const existing = fs.existsSync(process.argv[1])
        ? JSON.parse(fs.readFileSync(process.argv[1], 'utf-8'))
        : { created_at: process.argv[2], saves: 0 };
      const data = {
        ...existing,
        updated_at: process.argv[2],
        saves: (existing.saves || 0) + 1,
        completed_tasks: parseInt(process.argv[3], 10),
        total_tasks: parseInt(process.argv[4], 10),
        head_commit: process.argv[5],
        assignment: process.argv[6]
      };
      fs.writeFileSync(process.argv[1], JSON.stringify(data, null, 2));
      console.log(JSON.stringify(data, null, 2));
    " "$CHECKPOINT_FILE" "$NOW" "$COMPLETED" "$TOTAL" "$HEAD_COMMIT" "$(basename "$ASSIGNMENT_PATH")"
    ;;

  restore)
    if [ ! -f "$CHECKPOINT_FILE" ]; then
      echo "No checkpoint found at $CHECKPOINT_FILE" >&2
      exit 1
    fi

    node -e "
      const fs = require('fs');
      const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf-8'));
      console.log('# Checkpoint: ' + (data.assignment || 'unknown'));
      console.log('');
      console.log('- **Last saved:** ' + (data.updated_at || 'unknown'));
      console.log('- **Progress:** ' + (data.completed_tasks || 0) + '/' + (data.total_tasks || 0) + ' tasks completed');
      console.log('- **Head commit:** ' + (data.head_commit || 'unknown'));
      console.log('- **Save count:** ' + (data.saves || 0));
      console.log('');
      console.log('Resume from task ' + ((data.completed_tasks || 0) + 1) + '.');
    " "$CHECKPOINT_FILE"
    ;;

  status)
    if [ ! -f "$CHECKPOINT_FILE" ]; then
      node -e "
        console.log(JSON.stringify({
          exists: false,
          message: 'No checkpoint found'
        }, null, 2));
      "
    else
      node -e "
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf-8'));
        data.exists = true;
        console.log(JSON.stringify(data, null, 2));
      " "$CHECKPOINT_FILE"
    fi
    ;;

  *)
    echo "Error: action must be save, restore, or status" >&2
    echo "Usage: checkpoint.sh <action> <assignment-path>" >&2
    exit 1
    ;;
esac
